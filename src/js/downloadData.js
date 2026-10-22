// ---------------------------------------------------------------------------------------------------------------------
// Save the responses as a CSV file on the participant's device (normal browser download).
// Called at the end of the study by prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
import { buildCsv, buildFileName } from "./studyOutput.js";

export async function downloadData(responses, subjID) {
  const csvContent = buildCsv(responses, subjID);

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8," });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", `${buildFileName(subjID)}.csv`);
  link.click();
}
