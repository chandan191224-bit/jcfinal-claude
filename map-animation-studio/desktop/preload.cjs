// The small, safe bridge between the editor page and the desktop app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mapStudioDesktop", {
  isDesktop: true,
  /** Asks where to save, writes the video, and (for WebM input) re-encodes it to H.264 MP4 first. */
  saveVideo: (data, name, transcode, durationSec) => ipcRenderer.invoke("save-video", { data, name, transcode, durationSec }),
  canTranscode: () => ipcRenderer.invoke("can-transcode"),
  reveal: (p) => ipcRenderer.invoke("reveal", p),
  version: () => ipcRenderer.invoke("version"),
  onTranscodeProgress: (fn) => {
    const h = (_e, v) => fn(v);
    ipcRenderer.on("transcode-progress", h);
    return () => ipcRenderer.removeListener("transcode-progress", h);
  },
});
