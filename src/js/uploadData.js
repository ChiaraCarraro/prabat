// ---------------------------------------------------------------------------------------------------------------------
// Send the responses as a CSV file to the server (public/data/data.php saves it there).
// Currently NOT used: the server upload is switched off in prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
import { buildCsv, buildFileName } from "./studyOutput.js";

export async function uploadData(responses, subjID) {
  const csvContent = buildCsv(responses, subjID);

  const formData = new FormData();
  formData.append(
    "csvFile",
    new Blob([csvContent], { type: "text/csv" }),
    `${buildFileName(subjID)}.csv`
  );

  fetch("./data/data.php", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.text())
    .then((result) => {
      console.log("Success:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
