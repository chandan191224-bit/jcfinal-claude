import React, { useState } from "react";
import { FOLDERS, TEMPLATES, type TemplateDef } from "../src/registry";
import { LAYER_META, LAYER_ORDER, humanize, templateDuration, type LayerType } from "./model";
import { Icon, LAYER_ICON } from "./ui";
import { Thumb, UploadZone, useMedia } from "./Media";
import type { MediaItem } from "./assets";

type Tab = "add" | "templates" | "media";

export const Library: React.FC<{
  onAdd: (type: LayerType) => void;
  onAddScene: (t: TemplateDef) => void;
  onNewFromTemplate: (t: TemplateDef) => void;
  onUseMedia: (m: MediaItem) => void;
}> = ({ onAdd, onAddScene, onNewFromTemplate, onUseMedia }) => {
  const [tab, setTab] = useState<Tab>("add");
  const [q, setQ] = useState("");
  const { items, upload, uploading, remove } = useMedia();
  const groups: [string, LayerType[]][] = [
    ["On the map", LAYER_ORDER.filter((t) => LAYER_META[t].group === "map")],
    ["On screen", LAYER_ORDER.filter((t) => LAYER_META[t].group === "screen")],
    ["Sound and scenes", LAYER_ORDER.filter((t) => LAYER_META[t].group === "audio" || LAYER_META[t].group === "scene")],
  ];
  const ql = q.toLowerCase();
  return (
    <aside className="panel">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "add"} onClick={() => setTab("add")}>
          Add
        </button>
        <button role="tab" aria-selected={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </button>
        <button role="tab" aria-selected={tab === "media"} onClick={() => setTab("media")}>
          Media
        </button>
      </div>
      <div className="scroll">
        {tab === "add" ? (
          <div className="pad">
            <p className="hint">Click to add at the playhead. Every layer gets its own bar on the timeline and can be keyframed.</p>
            {groups.map(([name, types]) => (
              <div className="sec" key={name}>
                <h3>{name}</h3>
                <div className="addgrid">
                  {types.map((t) => (
                    <button key={t} className="addbtn" onClick={() => onAdd(t)} title={LAYER_META[t].desc}>
                      <span className={`ic g-${LAYER_META[t].group}`}>
                        <Icon name={LAYER_ICON[t]} />
                      </span>
                      <b>{LAYER_META[t].label}</b>
                      <small>{LAYER_META[t].desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : tab === "templates" ? (
          <div className="pad">
            <input className="search" type="search" placeholder="Search 30 animations" value={q} onChange={(e) => setQ(e.target.value)} />
            {Object.entries(FOLDERS).map(([f, name]) => {
              const list = TEMPLATES.filter((t) => t.folder === f && (!ql || t.id.toLowerCase().includes(ql) || t.desc.toLowerCase().includes(ql) || name.toLowerCase().includes(ql)));
              if (!list.length) return null;
              return (
                <div className="sec" key={f}>
                  <h3>{name}</h3>
                  {list.map((t) => (
                    <div className="tpl" key={t.id}>
                      <b>{humanize(t.id)}</b>
                      <small>{t.desc}</small>
                      <div className="acts">
                        <button className="btn sm" onClick={() => onAddScene(t)} title="Add as a scene layer at the playhead">
                          <Icon name="plus" />
                          Add to timeline
                        </button>
                        <button className="btn sm ghost" onClick={() => onNewFromTemplate(t)} title="Start a new project from it">
                          New project
                        </button>
                        <span className="hint" style={{ marginLeft: "auto", alignSelf: "center" }}>
                          {templateDuration(t)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pad">
            <UploadZone accept="image/*,video/*,audio/*,.gpx,.geojson,.json" onFiles={(f) => upload(f)} busy={uploading} />
            {items.length ? (
              <div className="media-grid">
                {items.map((m) => (
                  <div key={m.path} className="mitem" style={{ position: "relative" }}>
                    <button className="mitem" style={{ border: 0, borderRadius: 0 }} onClick={() => onUseMedia(m)} title={`${m.name} · click to add to the timeline at the playhead`}>
                      <Thumb path={m.path} kind={m.kind} />
                      <span>{m.name}</span>
                    </button>
                    <button
                      className="btn sm icon"
                      style={{ position: "absolute", top: 4, right: 4, background: "rgba(10,12,16,.75)" }}
                      onClick={() => window.confirm(`Remove ${m.name} from the studio?`) && remove(m.path)}
                      aria-label={`Remove ${m.name}`}
                      title="Remove"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">Your photos, videos and sounds appear here. They are kept inside this browser (nothing is uploaded to the internet). Click one to add it to the timeline.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
