import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, loadOnce } from "../src/lib/data";
import { loadGazetteer } from "../src/lib/places";
import { Icon } from "./ui";

export type Suggestion = { name: string; sub: string; kind: "country" | "state" | "city" | "landmark"; rank: number };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Every name the map understands: countries, states, cities and landmarks, from the bundled data. */
const loadSuggestions = () =>
  loadOnce<(Suggestion & { key: string })[]>("app:suggestions", async () => {
    const [g, states] = await Promise.all([
      loadGazetteer(),
      fetchJson<{ objects: { states: { geometries: { properties: { name: string; country: string } }[] } } }>("data/states.json"),
    ]);
    const out: (Suggestion & { key: string })[] = [];
    const seen = new Set<string>();
    const add = (s: Suggestion) => {
      const k = `${s.kind}:${norm(s.name)}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ ...s, key: norm(s.name) });
    };
    for (const p of g.all) {
      if (p.kind === "country") add({ name: p.name, sub: "Country", kind: "country", rank: 1e12 + p.pop });
      else if (p.kind === "landmark") add({ name: p.name, sub: [p.region, p.country].filter(Boolean).join(", "), kind: "landmark", rank: 5e9 });
      else if (p.kind === "city") add({ name: p.name, sub: [p.region, p.country].filter(Boolean).join(", "), kind: "city", rank: p.pop });
    }
    for (const { properties: s } of states.objects.states.geometries) {
      if (!s.name) continue;
      const india = s.country === "India";
      add({ name: india ? s.name : `${s.name}, ${s.country}`, sub: `State · ${s.country}`, kind: "state", rank: india ? 9e9 : 1e9 });
    }
    return out;
  });

export const useSuggestions = () => {
  const [list, setList] = useState<(Suggestion & { key: string })[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadSuggestions()
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);
  return list;
};

export function searchPlaces(list: (Suggestion & { key: string })[], q: string, kinds?: Suggestion["kind"][], limit = 9) {
  const n = norm(q);
  if (!n) return [];
  const pre: (Suggestion & { key: string })[] = [];
  const mid: (Suggestion & { key: string })[] = [];
  for (const s of list) {
    if (kinds && !kinds.includes(s.kind)) continue;
    if (s.key.startsWith(n)) pre.push(s);
    else if (n.length > 2 && s.key.includes(n)) mid.push(s);
    if (pre.length > 400) break;
  }
  const score = (s: Suggestion & { key: string }) => (s.key === n ? 1e15 : 0) + s.rank;
  pre.sort((a, b) => score(b) - score(a));
  mid.sort((a, b) => score(b) - score(a));
  return [...pre, ...mid].slice(0, limit);
}

/**
 * Text box for a place with suggestions. Free text still works: "19.07, 72.87",
 * "Base Camp (28.0026, 86.8528)" or "Springfield, United States".
 */
export const PlaceInput: React.FC<{ value: string; onChange: (v: string) => void; kinds?: Suggestion["kind"][]; placeholder?: string; autoFocus?: boolean }> = ({
  value,
  onChange,
  kinds,
  placeholder = "City, state, country or lat, lon",
  autoFocus,
}) => {
  const list = useSuggestions();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setDraft(value), [value]);
  const results = useMemo(() => (list && open ? searchPlaces(list, draft, kinds) : []), [list, open, draft, kinds]);
  const pick = (s: string) => {
    setDraft(s);
    onChange(s);
    setOpen(false);
  };
  return (
    <div className="ac" ref={ref}>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          if (draft !== value) onChange(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            setHi((h) => Math.min(h + 1, results.length - 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setHi((h) => Math.max(h - 1, 0));
            e.preventDefault();
          } else if (e.key === "Enter") {
            if (open && results[hi]) pick(results[hi].name);
            else onChange(draft);
            e.preventDefault();
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length ? (
        <div className="ac-menu" role="listbox">
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.name}:${r.sub}`}
              type="button"
              className={i === hi ? "hi" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r.name);
              }}
            >
              <Icon name={r.kind === "country" ? "globe" : r.kind === "state" ? "area" : r.kind === "landmark" ? "sparkle" : "pin"} size={14} />
              <span style={{ minWidth: 0, display: "grid" }}>
                <span>{r.name}</span>
                {r.sub && r.kind !== "country" ? <span className="sub">{r.sub}</span> : null}
              </span>
              <small>{r.kind}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** Ordered list of places (route stops, arrow points, frame-these-places lists). */
export const PlaceList: React.FC<{ value: string[]; onChange: (v: string[]) => void; addLabel?: string; min?: number }> = ({ value, onChange, addLabel = "Add stop", min = 0 }) => (
  <div className="list">
    {value.map((v, i) => (
      <div className="listrow" key={i}>
        <PlaceInput value={v} onChange={(nv) => onChange(value.map((x, j) => (j === i ? nv : x)))} />
        <button className="btn sm icon ghost" title="Move up" disabled={i === 0} onClick={() => onChange(swap(value, i, i - 1))}>
          <Icon name="up" />
        </button>
        <button className="btn sm icon ghost" title="Move down" disabled={i === value.length - 1} onClick={() => onChange(swap(value, i, i + 1))}>
          <Icon name="down" />
        </button>
        <button className="btn sm icon ghost danger" title="Remove" disabled={value.length <= min} onClick={() => onChange(value.filter((_, j) => j !== i))}>
          <Icon name="x" />
        </button>
      </div>
    ))}
    <button className="btn sm" onClick={() => onChange([...value, ""])}>
      <Icon name="plus" />
      {addLabel}
    </button>
  </div>
);

const swap = <T,>(a: T[], i: number, j: number) => {
  const b = [...a];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};
