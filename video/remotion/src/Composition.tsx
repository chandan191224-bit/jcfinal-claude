import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  CanvasImage,
  Composition,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import data from "./shots.json";

const FPS = 30;
const FADE = 8; // frames of cross-fade between pictures

type Shot = (typeof data.shots)[number];

// Slow "Ken Burns" camera move on every picture. The direction changes from shot to shot
// so consecutive images never move the same way.
const MOVES = [
  { from: [1.0, "0px 0px"], to: [1.12, "-30px -10px"] },
  { from: [1.14, "30px 0px"], to: [1.02, "0px 0px"] },
  { from: [1.04, "-40px 0px"], to: [1.12, "40px 0px"] },
  { from: [1.12, "0px 30px"], to: [1.04, "0px -20px"] },
  { from: [1.02, "30px -20px"], to: [1.13, "-20px 10px"] },
] as const;

const Picture: React.FC<{ shot: Shot; frames: number }> = ({ shot, frames }) => {
  const frame = useCurrentFrame();
  const move = MOVES[shot.n % MOVES.length];
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, FADE], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.67, 1) }),
      }}
    >
      <CanvasImage
        src={staticFile(`images/${shot.image}.jpg`)}
        style={{
          width: "100%",
          height: "100%",
          scale: interpolate(frame, [0, frames], [move.from[0], move.to[0]], { ...clamp, output: "perceptual-scale" }),
          translate: interpolate(frame, [0, frames], [move.from[1], move.to[1]], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

export const DelhiHistory: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {data.shots.map((shot) => {
        const from = Math.round(shot.start * FPS);
        const frames = Math.round(shot.duration * FPS) + FADE;
        return (
          <Sequence key={shot.n} name={`Image ${shot.image}`} from={from} durationInFrames={frames} premountFor={FPS}>
            <Picture shot={shot} frames={frames} />
          </Sequence>
        );
      })}
      {/* soft vignette for a cinematic look */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)" }} />
      {/* fade in from black at the start, out to black at the end */}
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [0, 20, durationInFrames - 45, durationInFrames - 1], [1, 0, 0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      {data.audio.map((a) => (
        <Sequence key={a.file} name={a.file} from={Math.round(a.start * FPS)} durationInFrames={Math.ceil(a.duration * FPS) + 2}>
          <Audio src={staticFile(`audio/${a.file}`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="DelhiHistory"
      component={DelhiHistory}
      durationInFrames={Math.round(data.total * FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
