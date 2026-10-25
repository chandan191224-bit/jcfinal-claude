/**
 * Highest-quality MP4 defaults. These apply to `npx remotion render` and to the Render button
 * in Remotion Studio.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// Frames are captured as lossless PNG, then encoded once to H.264.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
// CRF 12 is visually lossless (YouTube re-encodes anyway, so a clean master matters most).
Config.setCrf(12);
Config.setX264Preset("slow");
Config.setPixelFormat("yuv420p"); // plays everywhere: YouTube, Premiere, DaVinci, phones
Config.setColorSpace("bt709");
Config.setAudioBitrate("320k");
// WebGL (3D terrain, globes) via ANGLE; works on Windows, macOS and Linux.
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Map tiles and textures can take a while to load on the first frame.
Config.setDelayRenderTimeoutInMilliseconds(120000);
