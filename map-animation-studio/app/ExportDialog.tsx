import React, { useEffect, useRef, useState } from "react";
import { FORMATS, type FormatName } from "../src/lib/schema";
import { api, type OutputFile, type RenderJob, type RenderQuality } from "./api";
import { Dialog, Icon, Select } from "./ui";
import { FPS, renderProps, type Project } from "./model";

const QUALITIES: { id: RenderQuality; name: string; desc: string }[] = [
  { id: "max", name: "Highest quality MP4", desc: "H.264, CRF 12, slow preset, lossless frames, BT.709, 320 kbps audio. Best for YouTube." },
  { id: "prores", name: "ProRes 4444 (.mov)", desc: "Master for Premiere Pro / DaVinci Resolve grading. Very large files." },
  { id: "draft", name: "Quick draft MP4", desc: "Faster, smaller, for checking timing." },
];

const fmtBytes = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

const STAGE_TEXT: Record<RenderJob["status"], string> = {
  queued: "Waiting…",
  bundling: "Preparing the renderer (first export takes a minute)…",
  browser: "Downloading the render browser (first time only)…",
  rendering: "Rendering frames…",
  done: "Done",
  error: "Export failed",
  cancelled: "Cancelled",
};

export const ExportDialog: React.FC<{ project: Project; online: boolean; onClose: () => void }> = ({ project, online, onClose }) => {
  const [quality, setQuality] = useState<RenderQuality>("max");
  const [format, setFormat] = useState<FormatName>(project.format);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (online) api.outputs().then(setOutputs).catch(() => {});
  }, [online, job?.status]);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  const start = async () => {
    setError(null);
    try {
      const j = await api.startRender({ name: project.name, props: { ...renderProps(project), format }, quality });
      setJob(j);
      timer.current = window.setInterval(async () => {
        try {
          const s = await api.renderStatus(j.id);
          setJob(s);
          if (["done", "error", "cancelled"].includes(s.status) && timer.current) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
        } catch (e) {
          setError((e as Error).message);
        }
      }, 700);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const busy = job && !["done", "error", "cancelled"].includes(job.status);
  const [w, h] = FORMATS[format];
  const frames = Math.round(project.durationSec * FPS);
  const elapsed = job ? (job.finishedAt ?? Date.now()) - job.startedAt : 0;
  const eta = job && job.status === "rendering" && job.progress > 0.03 ? (elapsed / job.progress) * (1 - job.progress) : null;

  return (
    <Dialog title="Export video" onClose={() => !busy && onClose()} wide>
      {!online ? (
        <p className="hint" style={{ color: "var(--warn)" }}>
          Exporting needs the studio server on your computer. Close this page and start the studio with <b>Start Map Studio</b> (or <kbd>npm start</kbd>), then open it again.
        </p>
      ) : null}
      {!job || job.status === "error" || job.status === "cancelled" ? (
        <>
          <div className="sec">
            {QUALITIES.map((q) => (
              <label key={q.id} className={`opt ${quality === q.id ? "sel" : ""}`}>
                <input type="radio" name="q" checked={quality === q.id} onChange={() => setQuality(q.id)} />
                <b>{q.name}</b>
                <small>{q.desc}</small>
              </label>
            ))}
          </div>
          <div className="grid2">
            <label className="f">
              <span className="fl">Frame size</span>
              <Select options={Object.keys(FORMATS) as FormatName[]} value={format} onChange={setFormat} />
            </label>
            <div className="f">
              <span className="fl">Output</span>
              <span className="hint" style={{ paddingTop: 6 }}>
                {w}×{h} · {FPS} fps · {project.durationSec.toFixed(1)} s ({frames} frames)
              </span>
            </div>
          </div>
          {job?.status === "error" ? <pre style={{ whiteSpace: "pre-wrap", color: "var(--danger)", background: "#1d1418", padding: 10, borderRadius: 8, maxHeight: 200, overflow: "auto", margin: 0 }}>{job.error}</pre> : null}
          {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
          <div className="rowf" style={{ justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
            <button className="btn pri" onClick={start} disabled={!online}>
              <Icon name="export" />
              Export {quality === "prores" ? ".mov" : ".mp4"}
            </button>
          </div>
        </>
      ) : (
        <div className="sec">
          <div className="fl">
            <span>{job.status === "rendering" ? `${job.stage || STAGE_TEXT.rendering} ${job.renderedFrames}/${job.totalFrames}` : STAGE_TEXT[job.status]}</span>
            <b>{Math.round(job.progress * 100)}%</b>
          </div>
          <div className="pbar">
            <i style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
          <span className="hint">
            {fmtDur(elapsed)} elapsed{eta !== null ? ` · about ${fmtDur(eta)} left` : ""}
          </span>
          {job.status === "done" && job.url ? (
            <>
              <video src={job.url} controls autoPlay muted />
              <p className="hint">Saved to {job.output}</p>
              <div className="rowf" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn" onClick={() => api.reveal(job.output?.split(/[\\/]/).pop())}>
                  <Icon name="folder" />
                  Show in folder
                </button>
                <a className="btn" href={job.url} download>
                  <Icon name="download" />
                  Download
                </a>
                <button className="btn" onClick={() => setJob(null)}>
                  Export again
                </button>
                <button className="btn pri" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <div className="rowf" style={{ justifyContent: "flex-end" }}>
              <span className="hint" style={{ marginRight: "auto" }}>You can keep this window open; editing during export is paused.</span>
              <button className="btn danger" onClick={() => api.cancelRender(job.id).catch(() => {})}>
                Cancel export
              </button>
            </div>
          )}
        </div>
      )}
      {outputs.length ? (
        <div className="sec">
          <h3>
            Earlier exports
            <span className="sp" />
            <button className="btn sm ghost" onClick={() => api.reveal()}>
              <Icon name="folder" />
              Open folder
            </button>
          </h3>
          <div className="plist" style={{ maxHeight: 180 }}>
            {outputs.slice(0, 12).map((o) => (
              <div className="prow" key={o.name}>
                <Icon name="film" size={16} />
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</b>
                <span className="sp" />
                <small>{fmtBytes(o.size)}</small>
                <a className="btn sm ghost" href={o.url} target="_blank" rel="noreferrer">
                  Play
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
};
