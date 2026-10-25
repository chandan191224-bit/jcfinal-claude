import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { loadEmbeddedAssets, media } from "./assets";

const root = createRoot(document.getElementById("root")!);

const Splash: React.FC<{ text: string; error?: boolean }> = ({ text, error }) => (
  <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
      <div style={{ font: "700 22px var(--f-display)", display: "flex", gap: 10, alignItems: "center" }}>
        <i style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--head)", display: "inline-block" }} />
        Map Animation Studio
      </div>
      <div style={{ color: error ? "var(--danger)" : "var(--muted)", maxWidth: 520 }}>{text}</div>
    </div>
  </div>
);

(async () => {
  root.render(<Splash text="Loading…" />);
  try {
    // Unpack the built-in map data (single-file build) and your saved media before the engine asks for them.
    await loadEmbeddedAssets((m) => root.render(<Splash text={m} />));
    await media.restore().catch(() => 0);
    const { App } = await import("./App");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (e) {
    root.render(<Splash error text={`The studio could not start: ${(e as Error).message}. Open this file in the latest Google Chrome or Microsoft Edge.`} />);
  }
})();
