// Generates the app icons (favicon, home-screen icons) from public/favicon.svg during the build.
import { defineConfig, minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset,
  // path starts where index is
  images: ["../public/favicon.svg"],
});
