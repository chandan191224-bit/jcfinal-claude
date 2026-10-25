import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchJson } from "../src/lib/data";
import { SFX } from "../src/fx/Sfx";
import { assetNames, assetUrl, kindOf, media, type MediaItem } from "./assets";
import { Dialog, Icon } from "./ui";

export { kindOf };

/* ---------- shared media library state (stored in this browser) ---------- */

type MediaCtx = {
  items: MediaItem[];
  refresh: () => void;
  upload: (files: FileList | File[]) => Promise<MediaItem[]>;
  remove: (path: string) => Promise<void>;
  uploading: string | null;
  online: boolean;
};

const Ctx = createContext<MediaCtx>({ items: [], refresh: () => {}, upload: async () => [], remove: async () => {}, uploading: null, online: true });
export const useMedia = () => useContext(Ctx);

export const MediaProvider: React.FC<{ onError: (m: string) => void; children: React.ReactNode }> = ({ onError, children }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const refresh = useCallback(() => {
    media
      .list()
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  const upload = useCallback(
    async (files: FileList | File[]) => {
      const done: MediaItem[] = [];
      for (const f of Array.from(files)) {
        try {
          setUploading(f.name);
          done.push(await media.add(f));
        } catch (e) {
          onError(`Could not add ${f.name}: ${(e as Error).message}`);
        }
      }
      setUploading(null);
      refresh();
      return done;
    },
    [onError, refresh],
  );
  const remove = useCallback(
    async (path: string) => {
      await media.remove(path);
      refresh();
    },
    [refresh],
  );
  const v = useMemo(() => ({ items, refresh, upload, remove, uploading, online: true }), [items, refresh, upload, remove, uploading]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};

export const mediaUrl = (path: string) => (/^(https?:|data:|blob:)/.test(path) ? path : (assetUrl(path) ?? `/${path.replace(/^\/?public\//, "").replace(/^\//, "")}`));

export const Thumb: React.FC<{ path: string; kind?: MediaItem["kind"] }> = ({ path, kind = kindOf(path) }) => (
  <div className="mthumb">
    {kind === "image" ? <img src={mediaUrl(path)} alt="" loading="lazy" /> : kind === "video" ? <video src={`${mediaUrl(path)}#t=0.5`} muted preload="metadata" /> : <Icon name={kind === "audio" ? "music" : "file"} size={26} />}
  </div>
);

/* ---------- flags ---------- */

type CountryTopo = { objects: { countries: { geometries: { properties: { name: string; en: string; iso2: string } }[] } } };
const EXTRA_FLAGS: Record<string, string> = { eu: "European Union", un: "United Nations", "gb-eng": "England", "gb-sct": "Scotland", "gb-wls": "Wales", "gb-nir": "Northern Ireland", asean: "ASEAN", arab: "Arab League" };

export const useFlags = () => {
  const [flags, setFlags] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const topo = await fetchJson<CountryTopo>("data/countries-ind-lo.json");
      const names = new Map<string, string>();
      for (const g of topo.objects.countries.geometries) {
        const c = g.properties;
        if (c.iso2 && /^[a-z]{2}$/.test(c.iso2)) names.set(c.iso2, c.en && c.en.length < c.name.length ? c.en : c.name);
      }
      const embedded = assetNames("flags/").filter((n) => n.endsWith(".svg")).map((n) => n.slice(6, -4));
      const codes = embedded.length ? embedded : [...names.keys(), ...Object.keys(EXTRA_FLAGS)];
      const list = codes.map((code) => ({ code, name: names.get(code) ?? EXTRA_FLAGS[code] ?? code.toUpperCase() })).sort((a, b) => a.name.localeCompare(b.name));
      if (alive) setFlags(list);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return flags;
};

export const flagUrl = (code: string) => mediaUrl(`flags/${code}.svg`);

export const FlagGrid: React.FC<{ value: string; onPick: (code: string) => void }> = ({ value, onPick }) => {
  const flags = useFlags();
  const [q, setQ] = useState("");
  const shown = flags.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || f.code === q.toLowerCase());
  return (
    <div className="sec">
      <input className="search" type="text" placeholder="Search flags" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flaggrid">
        {shown.map((f) => (
          <button key={f.code} type="button" className={value === f.code ? "sel" : ""} onClick={() => onPick(f.code)} title={f.name}>
            <img src={flagUrl(f.code)} alt="" loading="lazy" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ---------- picker dialog ---------- */

export const MediaPicker: React.FC<{ title?: string; accept: MediaItem["kind"][]; allowFlags?: boolean; value: string; onPick: (v: string) => void; onClose: () => void }> = ({
  title = "Choose media",
  accept,
  allowFlags,
  value,
  onPick,
  onClose,
}) => {
  const { items, upload, uploading } = useMedia();
  const [tab, setTab] = useState<"files" | "flags">(allowFlags && (value.startsWith("flag") || !accept.length) ? "flags" : "files");
  const [url, setUrl] = useState("");
  const shown = items.filter((m) => accept.includes(m.kind));
  const acceptAttr = accept.map((k) => (k === "image" ? "image/*" : k === "video" ? "video/*" : k === "audio" ? "audio/*" : ".json,.geojson,.gpx")).join(",");
  return (
    <Dialog title={title} onClose={onClose} wide>
      {allowFlags ? (
        <div className="tabs" role="tablist" style={{ margin: "-6px 0 0" }}>
          <button role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}>
            Your files
          </button>
          <button role="tab" aria-selected={tab === "flags"} onClick={() => setTab("flags")}>
            Flags
          </button>
        </div>
      ) : null}
      {tab === "flags" ? (
        <FlagGrid
          value={value.startsWith("flag:") ? value.slice(5) : ""}
          onPick={(c) => {
            onPick(`flag:${c}`);
            onClose();
          }}
        />
      ) : (
        <>
          <UploadZone accept={acceptAttr} onFiles={async (f) => {
            const up = await upload(f);
            if (up[0] && accept.includes(up[0].kind)) {
              onPick(up[0].path);
              onClose();
            }
          }} busy={uploading} />
          {shown.length ? (
            <div className="media-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {shown.map((m) => (
                <button
                  key={m.path}
                  className={`mitem ${m.path === value ? "sel" : ""}`}
                  onClick={() => {
                    onPick(m.path);
                    onClose();
                  }}
                >
                  <Thumb path={m.path} kind={m.kind} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">No files yet. Add photos or videos above; they are kept in this browser, ready next time you open the studio.</p>
          )}
          <div className="rowf">
            <input type="text" placeholder="…or paste a link (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button
              className="btn"
              disabled={!/^https?:\/\//.test(url)}
              onClick={() => {
                onPick(url);
                onClose();
              }}
            >
              Use link
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
};

export const UploadZone: React.FC<{ accept: string; onFiles: (f: File[]) => void; busy: string | null; disabled?: boolean }> = ({ accept, onFiles, busy, disabled }) => {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Icon name="upload" size={22} />
      <span>{busy ? `Adding ${busy}…` : "Drop photos, videos or audio here"}</span>
      <label className={`btn sm ${disabled ? "" : "pri"}`} style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
        Choose files
        <input
          type="file"
          multiple
          accept={accept}
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
};

/* ---------- field ---------- */

export type MediaFieldKind = "region" | "image" | "video" | "visual" | "flag" | "sound" | "audio" | "track";

const SOUND_LABELS: Record<string, string> = {
  whoosh: "Whoosh",
  "whoosh-down": "Whoosh down",
  swish: "Swish",
  "zoom-in": "Zoom in",
  impact: "Impact",
  pop: "Pop",
  ping: "Ping",
  beep: "Beep",
  typing: "Typing",
  static: "Static",
  paper: "Paper",
  riser: "Riser",
  "plane-flyby": "Plane fly-by",
  engine: "Engine",
  tick: "Tick",
};

/** A media value: a file in public/, a link, a flag ("flag" / "flag:jp") or a built-in sound. */
export const MediaField: React.FC<{ kind: MediaFieldKind; value: string; onChange: (v: string) => void }> = ({ kind, value, onChange }) => {
  const [picker, setPicker] = useState(false);
  const accept: MediaItem["kind"][] =
    kind === "image" ? ["image"] : kind === "video" ? ["video"] : kind === "audio" || kind === "sound" ? ["audio"] : kind === "track" ? ["data"] : ["image", "video"];
  if (kind === "sound") {
    const builtIn = (SFX as readonly string[]).includes(value);
    return (
      <div className="grid2">
        <select value={builtIn ? value : "__file"} onChange={(e) => (e.target.value === "__file" ? setPicker(true) : onChange(e.target.value))}>
          {SFX.map((s) => (
            <option key={s} value={s}>
              {SOUND_LABELS[s] ?? s}
            </option>
          ))}
          <option value="__file">{builtIn ? "Your audio file…" : value.split("/").pop()}</option>
        </select>
        <button className="btn" onClick={() => setPicker(true)}>
          <Icon name="music" />
          Audio file…
        </button>
        {picker ? <MediaPicker title="Choose audio" accept={accept} value={value} onPick={onChange} onClose={() => setPicker(false)} /> : null}
      </div>
    );
  }
  const isFlag = value === "flag" || value.startsWith("flag:");
  const label = !value
    ? kind === "flag"
      ? "Flag of the country above"
      : "Nothing chosen"
    : value === "flag"
      ? "The area's own flag"
      : value.startsWith("flag:")
        ? `Flag: ${value.slice(5).toUpperCase()}`
        : value.split("/").pop();
  return (
    <div className="sec">
      <div className="rowf" style={{ alignItems: "stretch" }}>
        <div style={{ width: 64, flex: "none", borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
          {value.startsWith("flag:") ? (
            <div className="mthumb">
              <img src={flagUrl(value.slice(5))} alt="" />
            </div>
          ) : value && !isFlag ? (
            <Thumb path={value} />
          ) : (
            <div className="mthumb">
              <Icon name={isFlag || kind === "flag" ? "flag" : "image"} size={20} />
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          <div className="rowf" style={{ flexWrap: "wrap" }}>
            {kind === "region" ? (
              <button className={`btn sm ${value === "flag" ? "on" : ""}`} onClick={() => onChange("flag")}>
                Own flag
              </button>
            ) : null}
            {kind === "region" || kind === "flag" ? (
              <button className="btn sm" onClick={() => setPicker(true)}>
                {kind === "flag" ? "Pick flag…" : "Pick…"}
              </button>
            ) : (
              <button className="btn sm" onClick={() => setPicker(true)}>
                Choose…
              </button>
            )}
            {value && kind !== "region" ? (
              <button className="btn sm ghost" onClick={() => onChange("")}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {picker ? (
        <MediaPicker
          title={kind === "flag" ? "Choose a flag" : kind === "region" ? "Fill the area with" : "Choose media"}
          accept={kind === "flag" ? [] : accept}
          allowFlags={kind === "region" || kind === "flag"}
          value={value}
          onPick={onChange}
          onClose={() => setPicker(false)}
        />
      ) : null}
    </div>
  );
};
