import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { TEMPLATE_BY_ID, type TemplateDef } from "../src/registry";
import { projects, type MediaItem, type ProjectInfo } from "./assets";
import {
  FPS,
  addKeyAt,
  blankProject,
  cameraKeyAt,
  exampleProject,
  newLayer,
  normalizeProject,
  nudgeLayer,
  projectFromTemplate,
  r3,
  sceneLayer,
  slug,
  splitLayer,
  type Layer,
  type LayerType,
  type Project,
} from "./model";
import { storage, useHistory } from "./store";
import { Stage, Transport, type Gesture } from "./Stage";
import { Timeline, type Sel } from "./Timeline";
import { Library } from "./Library";
import { AnimatePanel, CameraPanel, LayerPanel, ProjectPanel } from "./Inspector";
import { ExportDialog } from "./ExportDialog";
import { MediaProvider, useMedia } from "./Media";
import { Dialog, Icon, Menu } from "./ui";

type ITab = "layer" | "animate" | "camera" | "project";
const LS_PROJECT = "map-studio:project";
const LS_FILE = "map-studio:file";
const LS_TL = "map-studio:timeline-height";

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

const extend = (p: Project): Project => {
  const end = Math.max(0, ...p.layers.map((l) => l.endSec));
  return end > p.durationSec + 1e-6 ? { ...p, durationSec: Math.min(600, Math.ceil(end * 10) / 10) } : p;
};

export const App: React.FC = () => {
  const hist = useHistory<Project>(() => {
    const saved = storage.get<Partial<Project>>(LS_PROJECT);
    return saved ? normalizeProject(saved) : exampleProject();
  });
  const project = hist.value;
  const update = hist.update;
  const deferred = useDeferredValue(project);

  const playerRef = useRef<PlayerRef | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [sel, setSelRaw] = useState<Sel>({ kind: "none" });
  const [itab, setItab] = useState<ITab>("project");
  const [recording, setRecording] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const [warnings, setWarnings] = useState<{ msg: string; at: number }[]>([]);
  const [dialog, setDialog] = useState<"export" | "open" | "help" | null>(null);
  const [file, setFile] = useState<string | null>(() => storage.get<string>(LS_FILE));
  const [savedRev, setSavedRev] = useState<Project | null>(null);
  const [tlH, setTlH] = useState(() => storage.get<number>(LS_TL) ?? Math.round(window.innerHeight * 0.33));

  const say = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad });
    window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), bad ? 6000 : 2600);
  }, []);
  const sayBad = useCallback((m: string) => say(m, true), [say]);

  /* ---------- selection ---------- */

  const setSel = useCallback((s: Sel) => {
    setSelRaw(s);
    if (s.kind === "cam") setItab("camera");
    else if (s.kind === "layer") setItab((t) => (s.key !== null ? "animate" : t === "animate" ? "animate" : "layer"));
  }, []);
  const selLayerIndex = sel.kind === "layer" && sel.i < project.layers.length ? sel.i : -1;
  const selLayer = selLayerIndex >= 0 ? project.layers[selLayerIndex] : null;
  useEffect(() => {
    if (sel.kind === "layer" && sel.i >= project.layers.length) setSelRaw({ kind: "none" });
    if (sel.kind === "cam" && sel.key !== null && sel.key >= project.camera.length) setSelRaw({ kind: "cam", key: null });
  }, [sel, project.layers.length, project.camera.length]);

  /* ---------- player ---------- */

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, []);
  const seek = useCallback((f: number) => {
    playerRef.current?.seekTo(f);
    setFrame(f);
  }, []);
  const t = frame / FPS;

  /* ---------- server, autosave, warnings ---------- */

  useEffect(() => {
    const id = window.setTimeout(() => storage.set(LS_PROJECT, project), 300);
    document.title = `${project.name || "Untitled"} · Map Animation Studio`;
    return () => window.clearTimeout(id);
  }, [project]);

  useEffect(() => storage.set(LS_FILE, file), [file]);
  useEffect(() => storage.set(LS_TL, tlH), [tlH]);

  const save = useCallback(
    async (quiet = false, as?: string) => {
      const name = as ?? file ?? `${slug(project.name)}.json`;
      try {
        const info = await projects.save(name, project.name, project);
        setFile(info.file);
        setSavedRev(project);
        if (!quiet) say(`Saved “${project.name}”. Find it under Project → Open.`);
      } catch (e) {
        sayBad(`Could not save: ${(e as Error).message}`);
      }
    },
    [file, project, say, sayBad],
  );
  // Autosave once the project has been saved.
  useEffect(() => {
    if (!file || savedRev === project || exporting) return;
    const id = window.setTimeout(() => save(true), 2500);
    return () => window.clearTimeout(id);
  }, [file, project, savedRev, save, exporting]);

  useEffect(() => {
    const h = (e: Event) => {
      const msg = String((e as CustomEvent).detail ?? "");
      setWarnings((w) => [...w.filter((x) => x.msg !== msg), { msg, at: Date.now() }].slice(-3));
    };
    window.addEventListener("map-studio-error", h);
    const id = window.setInterval(() => setWarnings((w) => (w.some((x) => Date.now() - x.at > 14000) ? w.filter((x) => Date.now() - x.at <= 14000) : w)), 1000);
    return () => {
      window.removeEventListener("map-studio-error", h);
      window.clearInterval(id);
    };
  }, []);

  /* ---------- editing actions ---------- */

  const addLayer = useCallback(
    (l: Layer) => {
      update((p) => extend({ ...p, layers: [...p.layers, l] }));
      setSelRaw({ kind: "layer", i: project.layers.length, key: null });
      setItab("layer");
    },
    [update, project.layers.length],
  );
  const onAdd = (type: LayerType) => addLayer(newLayer(type, r3(Math.min(t, Math.max(0, project.durationSec - 0.5)))));
  const onAddScene = (tp: TemplateDef) => addLayer(sceneLayer(tp, r3(t)));
  const confirmReplace = () => savedRev === project || window.confirm("Replace the current project? (Save it first if you want to keep it.)");
  const loadProject = (p: Project, f: string | null) => {
    hist.reset(p);
    setFile(f);
    setSavedRev(f ? p : null);
    setSelRaw({ kind: "none" });
    setItab("project");
    seek(0);
  };
  const onNewFromTemplate = (tp: TemplateDef) => {
    if (!confirmReplace()) return;
    loadProject(projectFromTemplate(tp), null);
  };
  const addMedia = (m: MediaItem) => {
    const k = m.kind;
    if (k === "data") return sayBad("GPX/GeoJSON files are used from layer settings (route track, custom area).");
    const at = r3(t);
    addLayer(k === "audio" ? newLayer("sfx", at, { name: m.name, media: m.path, endSec: at + 5 }) : newLayer(k === "video" ? "video" : "image", at, { name: m.name, media: m.path }));
  };
  const media = useRef<{ upload: (f: File[]) => Promise<MediaItem[]> } | null>(null);
  const onDropFiles = async (files: File[]) => {
    if (!media.current) return;
    const up = await media.current.upload(files);
    up.forEach(addMedia);
  };

  const doSplit = useCallback(() => {
    if (selLayerIndex < 0) return;
    const parts = splitLayer(project.layers[selLayerIndex], t);
    if (!parts) return say("Put the playhead inside the selected layer to split it.");
    update((p) => ({ ...p, layers: [...p.layers.slice(0, selLayerIndex), parts[0], parts[1], ...p.layers.slice(selLayerIndex + 1)] }));
    setSelRaw({ kind: "layer", i: selLayerIndex + 1, key: null });
  }, [selLayerIndex, project.layers, t, update, say]);

  const addKey = useCallback(() => {
    if (sel.kind === "cam" || (selLayerIndex < 0 && itab === "camera")) {
      const k = cameraKeyAt(project, t);
      update((p) => ({ ...p, camera: [...p.camera, k] }));
      setSel({ kind: "cam", key: project.camera.length });
      return;
    }
    if (selLayerIndex < 0) return say("Select a layer (or the camera row) first.");
    const l = project.layers[selLayerIndex];
    const local = t - l.startSec;
    if (local < 0 || local > l.endSec - l.startSec) return say("Move the playhead inside the layer to add a keyframe.");
    const r = addKeyAt(l, local);
    update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === selLayerIndex ? { ...x, keys: r.keys } : x)) }));
    setSel({ kind: "layer", i: selLayerIndex, key: r.index });
  }, [sel, selLayerIndex, itab, project, t, update, setSel, say]);

  const addCamKey = () => {
    const k = cameraKeyAt(project, t);
    update((p) => ({ ...p, camera: [...p.camera, k] }));
    setSel({ kind: "cam", key: project.camera.length });
  };

  const deleteSelection = useCallback(() => {
    if (sel.kind === "layer" && selLayerIndex >= 0) {
      if (sel.key !== null) {
        update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === selLayerIndex ? { ...x, keys: x.keys.filter((_, m) => m !== sel.key) } : x)) }));
        setSelRaw({ kind: "layer", i: selLayerIndex, key: null });
      } else {
        update((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== selLayerIndex) }));
        setSelRaw({ kind: "none" });
      }
    } else if (sel.kind === "cam" && sel.key !== null) {
      update((p) => ({ ...p, camera: p.camera.filter((_, m) => m !== sel.key) }));
      setSelRaw({ kind: "cam", key: null });
    }
  }, [sel, selLayerIndex, update]);

  const dragBase = useRef<{ layer: Layer; i: number; local: number; tag: string } | null>(null);
  const onGesture = (g: Gesture) => {
    if (selLayerIndex < 0) return;
    const i = selLayerIndex;
    const setKeys = (p: Project, keys: Layer["keys"]) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, keys } : x)) });
    if (g.phase === "start") {
      const l = project.layers[i];
      dragBase.current = { layer: l, i, local: t - l.startSec, tag: `stage:${Date.now()}` };
    } else if (g.phase === "move" && dragBase.current) {
      const b = dragBase.current;
      update((p) => setKeys(p, nudgeLayer(b.layer, b.local, g.delta, recording)), b.tag);
    } else if (g.phase === "end") {
      dragBase.current = null;
    } else if (g.phase === "wheel") {
      update((p) => {
        const l = p.layers[i];
        return setKeys(p, nudgeLayer(l, t - l.startSec, g.delta, recording));
      }, `wheel:${i}`);
    }
  };

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const total = Math.max(1, Math.round(project.durationSec * FPS));
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setDialog("open");
        return;
      }
      if (isTyping(e) || dialog) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) hist.redo();
        else hist.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        hist.redo();
      } else if (mod && e.key.toLowerCase() === "d" && selLayer) {
        e.preventDefault();
        update((p) => ({ ...p, layers: [...p.layers.slice(0, selLayerIndex + 1), { ...JSON.parse(JSON.stringify(selLayer)), name: `${selLayer.name} copy` }, ...p.layers.slice(selLayerIndex + 1)] }));
        setSelRaw({ kind: "layer", i: selLayerIndex + 1, key: null });
      } else if (e.key === " ") {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(Math.max(0, frame - (e.shiftKey ? FPS : 1)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(Math.min(total - 1, frame + (e.shiftKey ? FPS : 1)));
      } else if (e.key === "Home") seek(0);
      else if (e.key === "End") seek(total - 1);
      else if (e.key === "Delete" || e.key === "Backspace") deleteSelection();
      else if (e.key.toLowerCase() === "k" && !mod) addKey();
      else if (e.key.toLowerCase() === "s" && !mod) doSplit();
      else if (e.key.toLowerCase() === "r" && !mod) setRecording((r) => !r);
      else if (e.key === "Escape") setSelRaw({ kind: "none" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [project.durationSec, frame, dialog, hist, selLayer, selLayerIndex, update, seek, deleteSelection, addKey, doSplit, save]);

  /* ---------- splitter ---------- */

  const onSplitter = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = tlH;
    const move = (ev: PointerEvent) => setTlH(Math.max(130, Math.min(window.innerHeight * 0.72, h0 - (ev.clientY - y0))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dirty = savedRev !== project;
  const selKey = sel.kind === "layer" ? sel.key : null;

  return (
    <MediaProvider onError={sayBad}>
      <MediaBridge target={media} />
      <div className="app">
        <header className="top">
          <div className="brand">
            <i />
            Map Animation Studio
          </div>
          <input className="pname" value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }), "name")} aria-label="Project name" />
          {file ? <span className={`chip ${dirty ? "warn" : "ok"}`}>{dirty ? "Saving…" : "Saved"}</span> : <span className="chip">Not saved yet</span>}
          <button className="btn icon ghost" onClick={hist.undo} disabled={!hist.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button className="btn icon ghost" onClick={hist.redo} disabled={!hist.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Icon name="redo" />
          </button>
          <span className="sp" />
          <Menu
            align="right"
            button={(open) => (
              <button className="btn" onClick={open}>
                <Icon name="file" />
                <span className="hide-sm">Project</span>
                <Icon name="down" />
              </button>
            )}
          >
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close();
                    if (confirmReplace()) loadProject(blankProject(), null);
                  }}
                >
                  New blank map
                </button>
                <button
                  onClick={() => {
                    close();
                    if (confirmReplace()) loadProject(exampleProject(), null);
                  }}
                >
                  New from example (Delhi → Mumbai)
                </button>
                <hr />
                <button
                  onClick={() => {
                    close();
                    setDialog("open");
                  }}
                >
                  Open…<small>Ctrl+O</small>
                </button>
                <button
                  onClick={() => {
                    close();
                    save();
                  }}
                >
                  Save<small>Ctrl+S</small>
                </button>
                <button
                  onClick={() => {
                    close();
                    const n = window.prompt("Save a copy as", `${slug(project.name)}-copy`);
                    if (n) save(false, `${slug(n)}.json`);
                  }}
                >
                  Save a copy…
                </button>
                <hr />
                <button
                  onClick={() => {
                    close();
                    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${slug(project.name)}.mapstudio.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Download project file
                </button>
                <label className="menu-file" style={{ display: "flex", padding: "7px 9px", borderRadius: 7, cursor: "pointer" }}>
                  Open project file…
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      close();
                      if (!f || !confirmReplace()) return;
                      try {
                        loadProject(normalizeProject(JSON.parse(await f.text())), null);
                        say(`Opened ${f.name}`);
                      } catch (err) {
                        sayBad(`Not a project file: ${(err as Error).message}`);
                      }
                    }}
                  />
                </label>
                <hr />
                <button
                  onClick={() => {
                    close();
                    setDialog("help");
                  }}
                >
                  Keyboard shortcuts
                </button>
              </>
            )}
          </Menu>
          <button className="btn pri" onClick={() => setDialog("export")} title="Render an MP4">
            <Icon name="export" />
            Export
          </button>
        </header>

        <div className="work">
          <Library onAdd={onAdd} onAddScene={onAddScene} onNewFromTemplate={onNewFromTemplate} onUseMedia={addMedia} />
          <section className="center">
            <Stage project={deferred} playerRef={playerRef} selected={selLayer} recording={recording} warnings={warnings.map((w) => w.msg)} onGesture={onGesture} onDropFiles={onDropFiles} loop={loop} />
            <Transport playerRef={playerRef} frame={frame} playing={playing} project={project} loop={loop} setLoop={setLoop} seek={seek}>
              <button className="btn sm" onClick={addKey} title="Add a keyframe at the playhead (K)">
                <Icon name="key" />
                Keyframe
              </button>
              <button className={`btn sm ${recording ? "on rec" : ""}`} onClick={() => setRecording(!recording)} title="Record: moves on the preview become keyframes (R)">
                <Icon name="rec" />
                Rec
              </button>
            </Transport>
          </section>
          <aside className="panel">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={itab === "layer"} disabled={!selLayer} onClick={() => setItab("layer")}>
                Layer
              </button>
              <button role="tab" aria-selected={itab === "animate"} disabled={!selLayer} onClick={() => setItab("animate")}>
                Animate
              </button>
              <button role="tab" aria-selected={itab === "camera"} onClick={() => setItab("camera")}>
                Camera
              </button>
              <button role="tab" aria-selected={itab === "project"} onClick={() => setItab("project")}>
                Project
              </button>
            </div>
            <div className="scroll">
              {itab === "layer" && selLayer ? (
                <LayerPanel project={project} i={selLayerIndex} update={update} frame={frame} setSel={setSel} onSplit={doSplit} />
              ) : itab === "animate" && selLayer ? (
                <AnimatePanel project={project} i={selLayerIndex} keyIndex={selKey} update={update} frame={frame} seek={seek} setSel={setSel} recording={recording} setRecording={setRecording} />
              ) : itab === "camera" ? (
                <CameraPanel project={project} keyIndex={sel.kind === "cam" ? sel.key : null} update={update} frame={frame} seek={seek} setSel={setSel} onAdd={addCamKey} />
              ) : itab === "project" ? (
                <ProjectPanel project={project} update={update} />
              ) : (
                <div className="empty-note">Select a layer on the timeline.</div>
              )}
            </div>
          </aside>
        </div>

        <div className="split" onPointerDown={onSplitter} title="Drag to resize the timeline" />
        <div style={{ height: tlH, minHeight: 0 }}>
          <Timeline
            project={project}
            update={update}
            frame={frame}
            seek={seek}
            sel={sel}
            setSel={setSel}
            toolbar={
              <>
                <Menu
                  up
                  button={(open) => (
                    <button className="btn sm" onClick={open}>
                      <Icon name="plus" />
                      Add layer
                    </button>
                  )}
                >
                  {(close) =>
                    (["highlight", "region-media", "route", "pin", "radar", "callout", "text", "location-card", "image", "video", "flag", "counter", "sfx"] as LayerType[]).map((ty) => (
                      <button
                        key={ty}
                        onClick={() => {
                          close();
                          onAdd(ty);
                        }}
                      >
                        {newLayer(ty, 0).name}
                      </button>
                    ))
                  }
                </Menu>
                <button className="btn sm" onClick={addCamKey} title="Add a camera keyframe at the playhead">
                  <Icon name="camera" />
                  Camera key
                </button>
                <button className="btn sm" onClick={doSplit} disabled={!selLayer} title="Split the selected layer at the playhead (S)">
                  <Icon name="split" />
                  Split
                </button>
                <button className="btn sm ghost danger" onClick={deleteSelection} disabled={sel.kind === "none"} title="Delete the selection (Del)">
                  <Icon name="trash" />
                </button>
              </>
            }
          />
        </div>
      </div>

      {dialog === "export" ? <ExportDialog project={project} onBusy={setExporting} onClose={() => setDialog(null)} /> : null}
      {dialog === "open" ? (
        <OpenDialog
          onClose={() => setDialog(null)}
          onOpen={async (info) => {
            if (!confirmReplace()) return;
            try {
              const raw = await projects.load(info.file);
              loadProject(normalizeProject(raw as Partial<Project>), info.file);
              setDialog(null);
              say(`Opened ${info.name}`);
            } catch (e) {
              sayBad(`Could not open: ${(e as Error).message}`);
            }
          }}
          onTemplate={(id) => {
            const tp = TEMPLATE_BY_ID.get(id);
            if (tp && confirmReplace()) {
              loadProject(projectFromTemplate(tp), null);
              setDialog(null);
            }
          }}
        />
      ) : null}
      {dialog === "help" ? <HelpDialog onClose={() => setDialog(null)} /> : null}
      {toast ? <div className={`toast ${toast.bad ? "bad" : ""}`}>{toast.msg}</div> : null}
    </MediaProvider>
  );
};

/** Hands the media context's upload function to the App (which sits outside the provider). */
const MediaBridge: React.FC<{ target: React.MutableRefObject<{ upload: (f: File[]) => Promise<MediaItem[]> } | null> }> = ({ target }) => {
  const m = useMedia();
  target.current = { upload: m.upload };
  return null;
};

const OpenDialog: React.FC<{ onClose: () => void; onOpen: (p: ProjectInfo) => void; onTemplate: (id: string) => void }> = ({ onClose, onOpen, onTemplate }) => {
  const [list, setList] = useState<ProjectInfo[] | null>(null);
  const refresh = () =>
    projects
      .list()
      .then(setList)
      .catch(() => setList([]));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <Dialog title="Open project" onClose={onClose}>
      {list && list.length === 0 ? <p className="hint">No saved projects yet. Press Save (Ctrl+S) and your projects appear here. They are kept in this browser; use Project → Download project file for a copy you can move to another computer.</p> : null}
      <div className="plist">
        {(list ?? []).map((p) => (
          <div className="prow" key={p.file}>
            <Icon name="file" size={16} />
            <div style={{ display: "grid", minWidth: 0 }}>
              <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <small>
                {p.file} · {new Date(p.mtime).toLocaleString()}
              </small>
            </div>
            <span className="sp" />
            <button className="btn sm ghost danger" onClick={() => window.confirm(`Delete “${p.name}”?`) && projects.remove(p.file).then(refresh)} aria-label={`Delete ${p.name}`}>
              <Icon name="trash" />
            </button>
            <button className="btn sm pri" onClick={() => onOpen(p)}>
              Open
            </button>
          </div>
        ))}
      </div>
      <div className="sec">
        <h3>Start from</h3>
        <div className="rowf" style={{ flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => onTemplate("MapComposer")}>
            Example map
          </button>
          <button className="btn sm" onClick={() => onTemplate("PulsingMarkers")}>
            Pulsing markers
          </button>
          <button className="btn sm" onClick={() => onTemplate("FlightPath")}>
            Flight path
          </button>
          <button className="btn sm" onClick={() => onTemplate("RegionMediaFill")}>
            Flag in a country
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const HelpDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const rows: [string, string][] = [
    ["Space", "Play / pause"],
    ["← / →", "One frame back / forward (Shift: one second)"],
    ["Home / End", "Go to start / end"],
    ["K", "Add a keyframe at the playhead"],
    ["R", "Record: drags on the preview become keyframes"],
    ["S", "Split the selected layer at the playhead"],
    ["Del", "Delete the selected layer or keyframe"],
    ["Ctrl+D", "Duplicate the selected layer"],
    ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo"],
    ["Ctrl+S", "Save (kept in this browser; Project → Open lists them)"],
    ["Ctrl+wheel on the timeline", "Zoom the timeline"],
    ["Alt while dragging", "No snapping"],
    ["Drag / wheel / Shift+wheel on the preview", "Move / scale / rotate the selected layer"],
    ["Double-click the camera row", "Add a camera keyframe there"],
  ];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <div className="plist">
        {rows.map(([k, v]) => (
          <div className="prow" key={k}>
            <kbd>{k}</kbd>
            <span className="sp" />
            <span>{v}</span>
          </div>
        ))}
      </div>
    </Dialog>
  );
};
