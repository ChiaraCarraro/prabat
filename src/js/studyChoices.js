// ---------------------------------------------------------------------------------------------------------------------
// PARTICIPANT CHOICES (language, participant ID, webcam yes/no)
// The start pages save them in the browser's localStorage under "storedChoices";
// every later page reads them from there. Used by index.js, id.js, instructions.js,
// prabat.js and goodbye.js.
// ---------------------------------------------------------------------------------------------------------------------
const STORAGE_KEY = "storedChoices";

/**
 * Read the saved choices, e.g. { lang: "ger", ID: "P001", webcam: "true" }.
 * Returns an empty object when nothing has been saved yet.
 */
export function getStudyChoices() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    console.error("No data found in local storage");
    return {};
  }
  return JSON.parse(stored);
}

/** Save (replace) the choices. */
export function saveStudyChoices(choices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
}
