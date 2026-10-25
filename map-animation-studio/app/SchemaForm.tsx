import React from "react";
import type { z } from "zod";
import { THEMES } from "../src/lib/themes";
import { ColorInput, Field, Icon, NumberInput, Seg, Select, Slider, Toggle } from "./ui";
import { PlaceInput, PlaceList } from "./PlaceInput";
import { MediaField, type MediaFieldKind } from "./Media";
import { humanize } from "./model";

/*
 * Builds an editor for any template from its zod schema, so every setting of every animation is
 * editable without hand-written forms. Field names decide the special inputs (places, colours,
 * media); everything else follows the zod type.
 */

type AnyZ = z.ZodType & { def: { type: string; [k: string]: unknown }; description?: string };

const PLACE_KEYS = new Set(["from", "to", "target", "place", "focus", "landmark", "fixedCenter", "startFrom"]);
const PLACE_LIST_KEYS = new Set(["stops", "via", "frame", "regions", "clipTo", "peaks", "places"]);
const COLOR_KEYS = new Set(["color", "accent", "outline", "routeColor", "trailColor", "table"]);
const MEDIA_KEYS: Record<string, MediaFieldKind> = { media: "visual", endMedia: "visual", music: "audio", trackFile: "track", buildingsFile: "track" };
const LABELS: Record<string, string> = {
  sfx: "Sound effects",
  sfxVolume: "Sound volume",
  durationSec: "Length (seconds)",
  dateTimeUtc: "Date and time (UTC)",
  startUtc: "Start (UTC)",
  borders: "Borders",
  routeColor: "Route colour",
  routeWidth: "Route width",
  realHours: "Real travel time (hours)",
  introSec: "Intro (s)",
  outroSec: "Outro (s)",
  stopPauseSec: "Pause at stops (s)",
  radiusKm: "Radius (km)",
  atSec: "At (s)",
  startSec: "Start (s)",
  endSec: "End (s)",
  heightKm: "Height (km)",
  distanceKm: "Distance (km)",
  cameraDistanceKm: "Camera distance (km)",
  cameraHeightKm: "Camera height (km)",
  beatTimesSec: "Beat times (s)",
  trackFile: "GPX / GeoJSON track",
  buildingsFile: "Buildings GeoJSON",
};
export const BASE_KEYS = new Set(["format", "durationSec"]);

const unwrap = (s: AnyZ): AnyZ => {
  let x = s;
  while (x.def.type === "optional" || x.def.type === "default" || x.def.type === "nullable") x = x.def.innerType as AnyZ;
  return x;
};

const checksOf = (s: AnyZ) => {
  const out: { min?: number; max?: number; step?: number } = {};
  for (const c of (s.def.checks as { _zod: { def: { check: string; value: number } } }[] | undefined) ?? []) {
    const d = c._zod.def;
    if (d.check === "greater_than") out.min = d.value;
    if (d.check === "less_than") out.max = d.value;
    if (d.check === "multiple_of") out.step = d.value;
  }
  return out;
};

const labelFor = (key: string) => LABELS[key] ?? humanize(key).replace(/ sec$/, " (s)").replace(/ km$/, " (km)");

const defaultFor = (s: AnyZ): unknown => {
  const t = unwrap(s);
  switch (t.def.type) {
    case "string":
      return "";
    case "number": {
      const c = checksOf(t);
      return c.min !== undefined && c.min > 0 ? c.min : 0;
    }
    case "boolean":
      return false;
    case "enum":
      return (t as unknown as { options: string[] }).options[0];
    case "array":
      return [];
    case "object":
      return Object.fromEntries(Object.entries((t as unknown as z.ZodObject).shape).map(([k, v]) => [k, defaultFor(v as AnyZ)]));
    default:
      return null;
  }
};

const ValueField: React.FC<{ k: string; schema: AnyZ; value: unknown; onChange: (v: unknown) => void; depth: number }> = ({ k, schema, value, onChange, depth }) => {
  const s = unwrap(schema);
  const hint = schema.description ?? s.description;
  const label = labelFor(k);
  switch (s.def.type) {
    case "string": {
      const v = typeof value === "string" ? value : "";
      if (PLACE_KEYS.has(k))
        return (
          <Field label={label} hint={hint}>
            <PlaceInput value={v} onChange={onChange} />
          </Field>
        );
      if (COLOR_KEYS.has(k))
        return (
          <Field label={label} hint={hint && !/colou?r/i.test(hint) ? hint : undefined}>
            <ColorInput value={v} onChange={onChange} />
          </Field>
        );
      if (MEDIA_KEYS[k])
        return (
          <Field label={label} hint={hint}>
            <MediaField kind={MEDIA_KEYS[k]} value={v} onChange={onChange} />
          </Field>
        );
      const long = ["note", "caption", "subtitle", "subtext"].includes(k) || v.length > 40;
      return (
        <Field label={label} hint={hint}>
          {long ? <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={2} /> : <input type="text" value={v} onChange={(e) => onChange(e.target.value)} />}
        </Field>
      );
    }
    case "number": {
      const c = checksOf(s);
      const v = typeof value === "number" ? value : 0;
      if (c.min !== undefined && c.max !== undefined && c.max - c.min <= 20000) return <Slider label={label} value={v} min={c.min} max={c.max} step={c.step} onChange={onChange} hint={hint} />;
      return (
        <Field label={label} hint={hint}>
          <NumberInput value={v} min={c.min} max={c.max} step={c.step} onChange={onChange} />
        </Field>
      );
    }
    case "boolean":
      return (
        <div className="f">
          <Toggle label={label} checked={Boolean(value)} onChange={onChange} />
          {hint ? <span className="hint">{hint}</span> : null}
        </div>
      );
    case "enum": {
      const options = (s as unknown as { options: string[] }).options;
      const v = String(value ?? options[0]);
      const labels = k === "theme" ? Object.fromEntries(options.map((o) => [o, (THEMES as Record<string, { name: string }>)[o]?.name ?? o])) : undefined;
      return (
        <Field label={label} hint={hint}>
          {options.length <= 4 && options.join("").length < 34 ? <Seg options={options} value={v} onChange={onChange} labels={labels} /> : <Select options={options} value={v} onChange={onChange} labels={labels} />}
        </Field>
      );
    }
    case "array": {
      const el = unwrap(s.def.element as AnyZ);
      const arr = Array.isArray(value) ? value : [];
      if (el.def.type === "string") {
        if (PLACE_LIST_KEYS.has(k))
          return (
            <Field label={label} hint={hint}>
              <PlaceList value={arr as string[]} onChange={onChange} addLabel="Add place" />
            </Field>
          );
        if (k === "photos")
          return (
            <Field label={label} hint={hint}>
              <div className="list">
                {(arr as string[]).map((m, i) => (
                  <div className="listrow" key={i}>
                    <MediaField kind="visual" value={m} onChange={(nv) => onChange(arr.map((x, j) => (j === i ? nv : x)))} />
                    <button className="btn sm icon ghost danger" onClick={() => onChange(arr.filter((_, j) => j !== i))} aria-label="Remove">
                      <Icon name="x" />
                    </button>
                  </div>
                ))}
                <button className="btn sm" onClick={() => onChange([...arr, ""])}>
                  <Icon name="plus" />
                  Add photo
                </button>
              </div>
            </Field>
          );
        return (
          <Field label={label} hint={hint ?? "One per line"}>
            <textarea value={(arr as string[]).join("\n")} rows={Math.min(6, Math.max(2, arr.length))} onChange={(e) => onChange(e.target.value.split("\n"))} />
          </Field>
        );
      }
      if (el.def.type === "number")
        return (
          <Field label={label} hint={hint ?? "Numbers separated by commas"}>
            <input
              type="text"
              defaultValue={(arr as number[]).join(", ")}
              onBlur={(e) =>
                onChange(
                  e.target.value
                    .split(/[,\s]+/)
                    .map(Number)
                    .filter((n) => Number.isFinite(n) && e.target.value.trim() !== ""),
                )
              }
            />
          </Field>
        );
      if (el.def.type === "object")
        return <ObjectList label={label} hint={hint} schema={el as unknown as z.ZodObject} value={arr as Record<string, unknown>[]} onChange={onChange} depth={depth} />;
      return <JsonField label={label} value={value} onChange={onChange} />;
    }
    case "object":
      return (
        <details className="card2" open={depth === 0}>
          <summary>{label}</summary>
          <div className="body">
            <SchemaForm schema={s as unknown as z.ZodObject} value={(value ?? {}) as Record<string, unknown>} onChange={onChange} depth={depth + 1} />
          </div>
        </details>
      );
    default:
      return <JsonField label={label} value={value} onChange={onChange} />;
  }
};

const JsonField: React.FC<{ label: string; value: unknown; onChange: (v: unknown) => void }> = ({ label, value, onChange }) => (
  <Field label={label} hint="JSON">
    <textarea
      defaultValue={JSON.stringify(value, null, 1)}
      rows={3}
      onBlur={(e) => {
        try {
          onChange(JSON.parse(e.target.value));
        } catch {
          // keep the previous value until the JSON is valid
        }
      }}
    />
  </Field>
);

const itemTitle = (v: Record<string, unknown>, i: number) => {
  for (const k of ["label", "name", "target", "caption", "from", "title"]) if (typeof v[k] === "string" && v[k]) return `${i + 1}. ${String(v[k])}${k === "from" && v.to ? ` → ${String(v.to)}` : ""}`;
  return `Item ${i + 1}`;
};

const ObjectList: React.FC<{ label: string; hint?: string; schema: z.ZodObject; value: Record<string, unknown>[]; onChange: (v: unknown) => void; depth: number }> = ({ label, hint, schema, value, onChange, depth }) => (
  <div className="sec">
    <h3>
      {label}
      <span className="sp" />
      <button className="btn sm" onClick={() => onChange([...value, value.length ? JSON.parse(JSON.stringify(value[value.length - 1])) : defaultFor(schema as unknown as AnyZ)])}>
        <Icon name="plus" />
        Add
      </button>
    </h3>
    {hint ? <p className="hint">{hint}</p> : null}
    {value.map((item, i) => (
      <details className="card2" key={i}>
        <summary>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemTitle(item, i)}</span>
          <button className="btn sm icon ghost" disabled={i === 0} onClick={(e) => (e.preventDefault(), onChange(move(value, i, i - 1)))} aria-label="Move up">
            <Icon name="up" />
          </button>
          <button className="btn sm icon ghost" disabled={i === value.length - 1} onClick={(e) => (e.preventDefault(), onChange(move(value, i, i + 1)))} aria-label="Move down">
            <Icon name="down" />
          </button>
          <button className="btn sm icon ghost danger" onClick={(e) => (e.preventDefault(), onChange(value.filter((_, j) => j !== i)))} aria-label="Remove">
            <Icon name="trash" />
          </button>
        </summary>
        <div className="body">
          <SchemaForm schema={schema} value={item} onChange={(nv) => onChange(value.map((x, j) => (j === i ? nv : x)))} depth={depth + 1} />
        </div>
      </details>
    ))}
  </div>
);

const move = <T,>(a: T[], i: number, j: number) => {
  const b = [...a];
  const [x] = b.splice(i, 1);
  b.splice(j, 0, x);
  return b;
};

export const SchemaForm: React.FC<{ schema: z.ZodObject; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; skip?: Set<string>; depth?: number }> = ({
  schema,
  value,
  onChange,
  skip,
  depth = 0,
}) => (
  <>
    {Object.entries(schema.shape).map(([k, s]) =>
      skip?.has(k) ? null : <ValueField key={k} k={k} schema={s as AnyZ} value={value[k] ?? defaultFor(s as AnyZ)} onChange={(v) => onChange({ ...value, [k]: v })} depth={depth} />,
    )}
  </>
);
