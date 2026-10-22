// ---------------------------------------------------------------------------------------------------------------------
// LANGUAGE SETTINGS
// One place that says which files each language uses. To add a language, add a row here
// (see README.md for the full checklist).
//
//   imageFolder: folder in public/images/ with the pictures for this language
//   audioList:   list in public/audio/ of the audio files checked before the study starts
//   imageList:   list in public/images/ of the pictures preloaded before the study starts
//
// The audio files themselves are always in public/audio/<language code>/.
// ---------------------------------------------------------------------------------------------------------------------
const LANGUAGES = {
  ger: { imageFolder: "ger", audioList: "audio-ger.json", imageList: "images-ger.json" },
  en: { imageFolder: "ger", audioList: "audio-ger.json", imageList: "images-ger.json" },
  ch: { imageFolder: "ger", audioList: "audio-ch.json", imageList: "images-ger.json" },
  tr: { imageFolder: "tr", audioList: "audio-tr.json", imageList: "images-ger.json" },
  sw: { imageFolder: "ki", audioList: "audio-sw.json", imageList: "images-ki.json" },
  ki: { imageFolder: "ki", audioList: "audio-ki.json", imageList: "images-ki.json" },
};

/** Settings for a language code (e.g. "ger"); an empty object for unknown codes. */
export function getLanguageSettings(lang) {
  return LANGUAGES[lang] ?? {};
}
