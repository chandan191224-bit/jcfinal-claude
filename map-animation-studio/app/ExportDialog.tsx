import React, { useEffect, useRef, useState } from "react";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { FORMATS, type FormatName } from "../src/lib/schema";
import { MapComposer } from "../src/scenes/composer/MapComposer";
import { Dialog, Icon, Select } from "./ui";
import { FPS, renderProps, slug, type Project } from "./model";

/*
 * Renders the video inside the browser, frame by frame (not in real time, so nothing is dropped),
 * and encodes it with the computer's own video encoder (WebCodecs). The result downloads as a file.
 */

type Quality = "max" | "small" | "webm";
const QUALITIES: { id: Quality; name: string; desc: string }[] = [
  { id: "max", name: "Highest quality MP4", desc: "H.264 at a very high bitrate (about 40 Mbit/s at 1080p, 120 at 4K) with 320 kbps AAC sound. Best for YouTube uploads and editing." },
  { id: "small", name: "Smaller MP4", desc: "H.264 at about 16 Mbit/s at 1080p. Good for sharing and previews." },
  { id: "webm", name: "WebM (VP9)", desc: "For browsers or computers that can't make MP4." },
];

const bitrateFor = (q: Quality, w: number, h: number) => {
  const bpp = q === "max" ? 0.65 : 0.26; // bits per pixel per frame
  return Math.round(Math.min(q === "max" ? 120e6 : 40e6, w * h * FPS * bpp));
};

const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
const fmtBytes = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);

type State =
  | { kind: "setup"; note?: string }
  | { kind: "checking" }
  | { kind: "rendering"; progress: number; frames: number; startedAt: number; eta: number | null }
  | { kind: "done"; url: string; file: string; size: number; took: number }
  | { kind: "error"; message: string };

export const ExportDialog: React.FC<{ project: Project; onClose: () => void; onBusy: (b: boolean) => void }> = ({ project, onClose, onBusy }) => {
  const [quality, setQuality] = useState<Quality>("max");
  const [format, setFormat] = useState<FormatName>(project.format);
  const [state, setState] = useState<State>({ kind: "setup" });
  const abort = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const [w, h] = FORMATS[format];
  const total = Math.max(1, Math.round(project.durationSec * FPS));

  useEffect(
    () => () => {
      abort.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const busy = state.kind === "rendering" || state.kind === "checking";
  useEffect(() => onBusy(busy), [busy, onBusy]);

  const start = async (q: Quality = quality) => {
    setState({ kind: "checking" });
    const container = q === "webm" ? "webm" : "mp4";
    const videoCodec = q === "webm" ? "vp9" : "h264";
    try {
      const can = await canRenderMediaOnWeb({ width: w, height: h, container, videoCodec } as Parameters<typeof canRenderMediaOnWeb>[0]);
      if (!can.canRender) {
        const why = can.issues.map((i) => i.message).join(" ");
        if (q !== "webm") {
          setQuality("webm");
          setState({ kind: "setup", note: `This browser can't make MP4 here (${why}). WebM is selected instead; Chrome or Edge on Windows normally can make MP4.` });
        } else setState({ kind: "error", message: `This browser can't export video: ${why} Use the latest Chrome or Edge.` });
        return;
      }
      const ac = new AbortController();
      abort.current = ac;
      const startedAt = Date.now();
      setState({ kind: "rendering", progress: 0, frames: 0, startedAt, eta: null });
      const result = await renderMediaOnWeb({
        composition: { component: MapComposer as unknown as React.FC<Record<string, unknown>>, id: "MapComposer", width: w, height: h, fps: FPS, durationInFrames: total },
        inputProps: { ...renderProps(project), format } as unknown as Record<string, unknown>,
        container,
        videoCodec,
        videoBitrate: bitrateFor(q, w, h),
        audioCodec: q === "webm" ? "opus" : "aac",
        audioBitrate: 320000,
        keyframeIntervalInSeconds: 2,
        signal: ac.signal,
        delayRenderTimeoutInMilliseconds: 120000,
        licenseKey: "free-license",
        onProgress: (p) => {
          const elapsed = Date.now() - startedAt;
          setState({ kind: "rendering", progress: p.progress, frames: p.renderedFrames, startedAt, eta: p.progress > 0.03 ? (elapsed / p.progress) * (1 - p.progress) : null });
        },
      } as Parameters<typeof renderMediaOnWeb>[0]);
      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const file = `${slug(project.name)}${format !== project.format ? `-${slug(format)}` : ""}.${container}`;
      setState({ kind: "done", url, file, size: blob.size, took: Date.now() - startedAt });
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
    } catch (e) {
      if (abort.current?.signal.aborted) setState({ kind: "setup", note: "Export cancelled." });
      else setState({ kind: "error", message: (e as Error).message || String(e) });
    } finally {
      abort.current = null;
    }
  };

  return (
    <Dialog title="Export video" onClose={() => !busy && onClose()} wide>
      {state.kind === "setup" || state.kind === "error" ? (
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
                {w}×{h} · {FPS} fps · {project.durationSec.toFixed(1)} s ({total} frames) · {(bitrateFor(quality, w, h) / 1e6).toFixed(0)} Mbit/s
              </span>
            </div>
          </div>
          {state.kind === "setup" && state.note ? <p className="hint" style={{ color: "var(--warn)" }}>{state.note}</p> : null}
          {state.kind === "error" ? (
            <pre style={{ whiteSpace: "pre-wrap", color: "var(--danger)", background: "#1d1418", padding: 10, borderRadius: 8, maxHeight: 200, overflow: "auto", margin: 0 }}>{state.message}</pre>
          ) : null}
          <p className="hint">The video is made on this computer, frame by frame, so every frame is perfect even if the preview stutters. Keep this tab open (and visible) until it finishes.</p>
          <div className="rowf" style={{ justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
            <button className="btn pri" onClick={() => start()}>
              <Icon name="export" />
              Export {quality === "webm" ? ".webm" : ".mp4"}
            </button>
          </div>
        </>
      ) : state.kind === "checking" ? (
        <p className="hint">Preparing…</p>
      ) : state.kind === "rendering" ? (
        <div className="sec">
          <div className="fl">
            <span>
              Rendering frame {Math.min(total, state.frames)} of {total}
            </span>
            <b>{Math.round(state.progress * 100)}%</b>
          </div>
          <div className="pbar">
            <i style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <span className="hint">
            {fmtDur(Date.now() - state.startedAt)} elapsed{state.eta !== null ? ` · about ${fmtDur(state.eta)} left` : ""}
          </span>
          <div className="rowf" style={{ justifyContent: "flex-end" }}>
            <span className="hint" style={{ marginRight: "auto" }}>Keep this tab in front while it works.</span>
            <button className="btn danger" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="sec">
          <video src={state.url} controls autoPlay muted />
          <p className="hint">
            Saved as <b>{state.file}</b> ({fmtBytes(state.size)}) in your Downloads folder · made in {fmtDur(state.took)}.
          </p>
          <div className="rowf" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            <a className="btn" href={state.url} download={state.file}>
              <Icon name="download" />
              Download again
            </a>
            <button className="btn" onClick={() => setState({ kind: "setup" })}>
              Export another
            </button>
            <button className="btn pri" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
