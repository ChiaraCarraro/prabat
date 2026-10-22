// ---------------------------------------------------------------------------------------------------------------------
// Generate the list of audio files or pictures of one language, which the study checks/preloads
// before it starts (see src/js/preloadAudios.js and src/js/preloadImages.js).
//
// Usage (from the project folder):
//   bun run generateAudioJSON ger     -> writes public/audio/audio-ger.json    from public/audio/ger/
//   bun run generateImageJSON ger     -> writes public/images/images-ger.json  from public/images/ger/
// or directly:
//   bun run src/scripts/generateAssetList.js <audio|images> <language folder> [output file]
//
// Run it again whenever files are added, renamed or removed in a language folder.
// ---------------------------------------------------------------------------------------------------------------------
import fs from "fs";
import path from "path";

const ASSET_TYPES = {
  audio: { extensions: /\.(mp3|wav|m4a)$/i, listName: (lang) => `audio-${lang}.json` },
  images: {
    extensions: /\.(png|jpe?g|gif|webp|svg|avif)$/i,
    listName: (lang) => `images-${lang}.json`,
  },
};
const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db"]);

const [type, lang, outputArg] = process.argv.slice(2);
const assetType = ASSET_TYPES[type];
if (!assetType || !lang) {
  console.error("Usage: bun run src/scripts/generateAssetList.js <audio|images> <language folder>");
  console.error("Example: bun run src/scripts/generateAssetList.js audio ger");
  process.exit(1);
}

const projectRoot = process.cwd();
const folder = path.resolve(projectRoot, "public", type, lang);
const output = outputArg
  ? path.resolve(projectRoot, outputArg)
  : path.resolve(projectRoot, "public", type, assetType.listName(lang));

// All files below a folder, including sub folders
async function* listFiles(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_FILES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* listFiles(fullPath);
    } else {
      yield fullPath;
    }
  }
}

if (!fs.existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

const files = [];
for await (const file of listFiles(folder)) {
  if (assetType.extensions.test(file)) files.push(file);
}

// Paths relative to public/, with forward slashes and no leading slash, e.g. "audio/ger/cat.mp3",
// so they work wherever the study is installed
const list = files
  .map((file) => `${type}/${lang}/${path.relative(folder, file).split(path.sep).join("/")}`)
  .sort((a, b) => a.localeCompare(b));

await fs.promises.writeFile(output, JSON.stringify(list, null, 2), "utf8");
console.log(`Wrote ${list.length} ${type} file(s) to ${output}`);
