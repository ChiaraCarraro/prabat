// ---------------------------------------------------------------------------------------------------------------------
// STUDY OUTPUT: the CSV with the responses and the names of the saved files.
// Used by downloadData.js / uploadData.js (CSV) and downloadVideo.js / uploadVideo.js (video name).
// ---------------------------------------------------------------------------------------------------------------------

// Target objects of the trials that go into the analysis (column "analyze" = true)
const ANALYZE_TARGETS = [
  "dog_brown_shoes",
  "black_ball",
  "still_umbrella",
  "novelMutex",
  "balloon",
  "weird_tshirt2",
  "glass_of_water",
  "pear",
  "truck_B",
  "few",
  "normal_bottle",
  "novel_J",
  "plate_apple",
  "novel_G",
  "Gesture_item1_option2",
  "boy_B_withDrawing_NoBack_talking",
  "umbrella",
  "carrot_cake",
  "Gesture_item2_option2",
];

// CSV columns: the CSV header name and the field of a response it is taken from
const CSV_COLUMNS = [
  { header: "id", field: "subjID" },
  { header: "trial", field: "trial" },
  { header: "targetObject", field: "targetObject" },
  { header: "chosenObject", field: "chosenObject" },
  { header: "chosen_position", field: "chosenPosition" },
  { header: "chosenCategory", field: "chosenCategory" },
  { header: "correct", field: "correct" },
  { header: "analyze", field: "analyze" },
  { header: "timestamp", field: "timestamp" },
  { header: "responsetime_ms", field: "responseTime" },
  { header: "repeated", field: "repeatCount" },
  { header: "browser", field: "browser" },
  { header: "OS", field: "OS" },
];

/**
 * Turn the list of responses into CSV text (one row per response).
 * Adds the participant ID and the derived columns "correct" and "analyze" to each response.
 */
export function buildCsv(responses, subjID) {
  responses.forEach((response) => {
    response.subjID = subjID;
    response.correct = response.targetObject === response.chosenObject;
    response.analyze = ANALYZE_TARGETS.includes(response.targetObject);
  });

  const rows = [CSV_COLUMNS.map((column) => column.header)];
  responses.forEach((response) => {
    rows.push(CSV_COLUMNS.map((column) => response[column.field]));
  });

  return rows.map((row) => row.join(",") + "\n").join("");
}

/**
 * File name (without extension) for the saved data: "prabat-<ID>-<YYYY-MM-DD>-<hh:mm:ss>".
 * Date and time are in UTC.
 */
export function buildFileName(subjID) {
  const now = new Date().toISOString();
  const day = now.substring(0, 10);
  const time = now.substring(11, 19);
  return `prabat-${subjID}-${day}-${time}`;
}
