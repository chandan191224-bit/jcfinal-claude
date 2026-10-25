// Talks to the local server (server/server.mjs). Every call fails soft when the app runs without it.

export type MediaItem = { path: string; name: string; size: number; kind: "image" | "video" | "audio" | "data"; mtime: number };
export type ProjectInfo = { file: string; name: string; mtime: number };
export type RenderJob = {
  id: string;
  status: "queued" | "bundling" | "browser" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  stage: string;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  output: string | null;
  url: string | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};
export type RenderQuality = "max" | "prores" | "draft";
export type OutputFile = { name: string; url: string; size: number; mtime: number };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) msg = b.error;
    } catch {
      // not JSON
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  async health(): Promise<{ ok: boolean; version: string; platform: string } | null> {
    try {
      return await json(await fetch("/api/health"));
    } catch {
      return null;
    }
  },
  listMedia: async () => json<MediaItem[]>(await fetch("/api/media")),
  upload: async (file: File, onProgress?: (f: number) => void) =>
    new Promise<MediaItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/media?name=${encodeURIComponent(file.name)}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 300) reject(new Error(body.error ?? xhr.statusText));
          else resolve(body as MediaItem);
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed. Is the studio server running?"));
      xhr.send(file);
    }),
  deleteMedia: async (path: string) => json(await fetch(`/api/media?path=${encodeURIComponent(path)}`, { method: "DELETE" })),
  flags: async () => json<string[]>(await fetch("/api/flags")),
  listProjects: async () => json<ProjectInfo[]>(await fetch("/api/projects")),
  loadProject: async (file: string) => json<Record<string, unknown>>(await fetch(`/api/projects/${encodeURIComponent(file)}`)),
  saveProject: async (file: string, data: unknown) =>
    json<ProjectInfo>(await fetch(`/api/projects/${encodeURIComponent(file)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data, null, 2) })),
  deleteProject: async (file: string) => json(await fetch(`/api/projects/${encodeURIComponent(file)}`, { method: "DELETE" })),
  startRender: async (body: { name: string; props: unknown; quality: RenderQuality }) =>
    json<RenderJob>(await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  renderStatus: async (id: string) => json<RenderJob>(await fetch(`/api/render/${id}`)),
  cancelRender: async (id: string) => json(await fetch(`/api/render/${id}/cancel`, { method: "POST" })),
  outputs: async () => json<OutputFile[]>(await fetch("/api/outputs")),
  reveal: async (name?: string) => json(await fetch("/api/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })),
};
