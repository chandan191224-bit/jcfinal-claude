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

/** Present when running as the installed desktop app (see desktop/preload.cjs). */
type Desktop = {
  isDesktop: true;
  saveVideo: (data: ArrayBuffer, name: string, transcode: boolean, durationSec: number) => Promise<string | null>;
  canTranscode: () => Promise<boolean>;
  reveal: (p: string) => Promise<void>;
  onTranscodeProgress: (fn: (v: number) => void) => () => void;
};
const desktop = (window as unknown as { mapStudioDesktop?: Desktop }).mapStudioDesktop;
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
  | { kind: "saving"; progress: number | null }
  | { kind: "done"; url: string; file: string; size: number; took: number; savedTo: string | null; blob: Blob; transcode: boolean }
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

  const busy = state.kind === "rendering" || state.kind === "checking" || state.kind === "saving";
  useEffect(() => onBusy(busy), [busy, onBusy]);

  const start = async (q: Quality = quality) => {
    setState({ kind: "checking" });
    let container: "mp4" | "webm" = q === "webm" ? "webm" : "mp4";
    let videoCodec: "h264" | "vp9" = q === "webm" ? "vp9" : "h264";
    let transcode = false;
    try {
      const check = () => canRenderMediaOnWeb({ width: w, height: h, container, videoCodec } as Parameters<typeof canRenderMediaOnWeb>[0]);
      const codecProblem = (r: Awaited<ReturnType<typeof check>>) =>
        r.issues.some((i) => i.severity === "error" && ["video-codec-unsupported", "audio-codec-unsupported", "container-codec-mismatch"].includes(i.type));
      let can = await check();
      // The desktop app can always make MP4: if this computer's encoder can't do H.264, render a
      // near-lossless VP9 master and let ffmpeg turn it into H.264.
      if (codecProblem(can) && desktop && q !== "webm" && (await desktop.canTranscode())) {
        container = "webm";
        videoCodec = "vp9";
        transcode = true;
        can = await check();
      }
      if (!can.canRender) {
        const why = can.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ");
        if (!codecProblem(can)) {
          setState({ kind: "error", message: `This computer can't export right now: ${why}\nUpdate the graphics driver, or restart the studio and try again.` });
        } else if (q !== "webm" && !desktop) {
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
        videoBitrate: transcode ? bitrateFor("max", w, h) * 2 : bitrateFor(q, w, h),
        audioCodec: container === "webm" ? "opus" : "aac",
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
      const file = `${slug(project.name)}${format !== project.format ? `-${slug(format)}` : ""}.${transcode ? "mp4" : container}`;
      const took = Date.now() - startedAt;
      if (desktop) {
        const savedTo = await saveDesktop(blob, file, transcode);
        setState({ kind: "done", url, file, size: blob.size, took, savedTo, blob, transcode });
      } else {
        setState({ kind: "done", url, file, size: blob.size, took, savedTo: null, blob, transcode });
        const a = document.createElement("a");
        a.href = url;
        a.download = file;
        a.click();
      }
    } catch (e) {
      if (abort.current?.signal.aborted) setState({ kind: "setup", note: "Export cancelled." });
      else setState({ kind: "error", message: (e as Error).message || String(e) });
    } finally {
      abort.current = null;
    }
  };

  async function saveDesktop(blob: Blob, file: string, transcode: boolean) {
    if (!desktop) return null;
    setState({ kind: "saving", progress: transcode ? 0 : null });
    const off = desktop.onTranscodeProgress((v) => setState({ kind: "saving", progress: v }));
    try {
      return await desktop.saveVideo(await blob.arrayBuffer(), file, transcode, project.durationSec);
    } finally {
      off();
    }
  }

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
      ) : state.kind === "saving" ? (
        <div className="sec">
          <div className="fl">
            <span>{state.progress === null ? "Saving…" : "Making the MP4…"}</span>
            {state.progress !== null ? <b>{Math.round(state.progress * 100)}%</b> : null}
          </div>
          {state.progress !== null ? (
            <div className="pbar">
              <i style={{ width: `${Math.round(state.progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
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
            {desktop ? (
              state.savedTo ? (
                <>
                  Saved to <b>{state.savedTo}</b> · made in {fmtDur(state.took)}.
                </>
              ) : (
                <>Not saved yet. Use “Save as…” to choose where.</>
              )
            ) : (
              <>
                Saved as <b>{state.file}</b> ({fmtBytes(state.size)}) in your Downloads folder · made in {fmtDur(state.took)}.
              </>
            )}
          </p>
          <div className="rowf" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            {desktop ? (
              <>
                {state.savedTo ? (
                  <button className="btn" onClick={() => desktop.reveal(state.savedTo!)}>
                    <Icon name="folder" />
                    Show in folder
                  </button>
                ) : null}
                <button
                  className="btn"
                  onClick={async () => {
                    const s0 = state;
                    const savedTo = await saveDesktop(s0.blob, s0.file, s0.transcode);
                    setState({ ...s0, savedTo: savedTo ?? s0.savedTo });
                  }}
                >
                  <Icon name="save" />
                  Save as…
                </button>
              </>
            ) : (
              <a className="btn" href={state.url} download={state.file}>
                <Icon name="download" />
                Download again
              </a>
            )}
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
