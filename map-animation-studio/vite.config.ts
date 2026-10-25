import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * @remotion/web-renderer measures a 3D-transformed element with getBoundingClientRect(), which
 * returns the box *after* the transform, then crops the untransformed layer with it. For the
 * tilted map plane that cuts off corners of the map. Measure with the transforms switched off
 * instead, so the crop is in the same (untransformed) space as the rest of the calculation.
 */
const fixWebRenderer3d = (): Plugin => ({
  name: "fix-web-renderer-3d-crop",
  enforce: "pre",
  transform(code, id) {
    if (!id.includes("web-renderer") || !code.includes("const unclampedBiggestBoundingClientRect = getBiggestBoundingClientRect(element);")) return null;
    return code
      // The tilted map is a big texture shrunk onto the frame: without mipmaps thin roads and
      // borders flicker or vanish. WebGL2 allows mipmaps on any texture size.
      .replace(
        `const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true
  }) ?? undefined;`,
        `const gl = canvas.getContext("webgl2", { premultipliedAlpha: true }) ?? canvas.getContext("webgl", { premultipliedAlpha: true }) ?? undefined;`,
      )
      .replace(
        "gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);",
        `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const __an = gl.getExtension("EXT_texture_filter_anisotropic");
    if (__an) gl.texParameterf(gl.TEXTURE_2D, __an.TEXTURE_MAX_ANISOTROPY_EXT, gl.getParameter(__an.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
  }`,
      )
      .replace(
      "const unclampedBiggestBoundingClientRect = getBiggestBoundingClientRect(element);",
      `const __saved = [];
  for (let __n = element; __n && __n.style; __n = __n.parentElement) {
    __saved.push([__n, __n.style.transform, __n.style.translate, __n.style.scale, __n.style.rotate]);
    __n.style.transform = "none"; __n.style.translate = "none"; __n.style.scale = "none"; __n.style.rotate = "none";
  }
  const unclampedBiggestBoundingClientRect = getBiggestBoundingClientRect(element);
  for (const [__n, t, tr, sc, ro] of __saved) { __n.style.transform = t; __n.style.translate = tr; __n.style.scale = sc; __n.style.rotate = ro; }`,
    );
  },
});

// The editor app lives in app/ and reuses the animation engine in src/ and the data in public/.
export default defineConfig({
  root: "app",
  publicDir: "../public",
  plugins: [fixWebRenderer3d(), react()],
  server: { fs: { allow: [".."] } },
  build: { outDir: "../app-dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  optimizeDeps: {
    include: ["react", "react-dom", "remotion", "@remotion/player", "three", "@react-three/fiber", "zod"],
    // Kept out of pre-bundling so the patch above applies in development too.
    exclude: ["@remotion/web-renderer"],
  },
});
