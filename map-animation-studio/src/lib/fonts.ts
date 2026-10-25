import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as oswald } from "@remotion/google-fonts/Oswald";
import { loadFont as fell } from "@remotion/google-fonts/IMFellEnglish";
import { loadFont as fellSc } from "@remotion/google-fonts/IMFellEnglishSC";
import { loadFont as mono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as rajdhani } from "@remotion/google-fonts/Rajdhani";
import { loadFont as shareTech } from "@remotion/google-fonts/ShareTechMono";
import { loadFont as teko } from "@remotion/google-fonts/Teko";
import { loadFont as poppins } from "@remotion/google-fonts/Poppins";
import { loadFont as orbitron } from "@remotion/google-fonts/Orbitron";
import { loadFont as playfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as caveat } from "@remotion/google-fonts/Caveat";
import { loadFont as bebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as hind } from "@remotion/google-fonts/Hind";

// Loaded once at import; Remotion holds rendering until every font is ready.
const opts = { ignoreTooManyRequestsWarning: true } as const;
inter("normal", { weights: ["400", "600", "800"], subsets: ["latin", "latin-ext"], ...opts });
oswald("normal", { weights: ["400", "600", "700"], subsets: ["latin"], ...opts });
fell("normal", { weights: ["400"], subsets: ["latin"], ...opts });
fellSc("normal", { weights: ["400"], subsets: ["latin"], ...opts });
mono("normal", { weights: ["400", "700"], subsets: ["latin"], ...opts });
rajdhani("normal", { weights: ["500", "700"], subsets: ["latin"], ...opts });
shareTech("normal", { weights: ["400"], subsets: ["latin"], ...opts });
teko("normal", { weights: ["500", "600"], subsets: ["latin"], ...opts });
poppins("normal", { weights: ["500", "700", "800"], subsets: ["latin"], ...opts });
orbitron("normal", { weights: ["500", "800"], subsets: ["latin"], ...opts });
playfair("normal", { weights: ["700"], subsets: ["latin"], ...opts });
caveat("normal", { weights: ["700"], subsets: ["latin"], ...opts });
bebas("normal", { weights: ["400"], subsets: ["latin"], ...opts });
hind("normal", { weights: ["400", "600", "700"], subsets: ["devanagari", "latin"], ...opts });

/** CSS font stack with Devanagari fallback so Hindi labels render correctly in every theme. */
export const font = (name: string) => `"${name}", "Hind", "Inter", sans-serif`;
