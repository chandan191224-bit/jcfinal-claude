import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { Video } from "@remotion/media";
import { isVideoFile, resolveMedia } from "../lib/media";
import { font } from "../lib/fonts";

/** Full-frame footage or photo. With no file, shows a labelled placeholder so the slot is obvious in Studio. */
export const MediaFill: React.FC<{ src: string; label?: string; volume?: number; style?: React.CSSProperties; trimBeforeSec?: number }> = ({
  src,
  label = "Your footage",
  volume = 0,
  style,
  trimBeforeSec = 0,
}) => {
  if (!src) {
    return (
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1f3b4d 0%, #3a6b5a 45%, #c9a46a 100%)",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.85)", font: `600 42px ${font("Inter")}`, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.4)" }}>
          {label}
          <div style={{ font: `400 24px ${font("JetBrains Mono")}`, marginTop: 10, opacity: 0.8 }}>put a file in public/media and set its path</div>
        </div>
      </AbsoluteFill>
    );
  }
  const url = resolveMedia(src);
  return (
    <AbsoluteFill style={style}>
      {isVideoFile(src) ? (
        <Video src={url} volume={volume} muted={volume === 0} trimBefore={Math.round(trimBeforeSec * 30)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </AbsoluteFill>
  );
};
