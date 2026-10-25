import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The editor app lives in app/ and reuses the animation engine in src/ and the data in public/.
export default defineConfig({
  root: "app",
  publicDir: "../public",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  build: { outDir: "../app-dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  optimizeDeps: { include: ["react", "react-dom", "remotion", "@remotion/player", "three", "@react-three/fiber", "zod"] },
});
