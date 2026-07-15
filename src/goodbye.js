import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";

// Read stored choices from localStorage
const storedChoices = localStorage.getItem("storedChoices");

let studyChoices = {};

if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in localStorage");
}

// Read language from localStorage
// fallback should probably be "ger", because that is your default elsewhere
const lang = studyChoices?.lang ?? "ger";

const webcam = studyChoices?.webcam ?? false;
const subjID = studyChoices?.ID ?? "testID";

// Load localized text
(async () => {
  await loadLanguage(lang);
})();

// -------------------------------------------------------------------------------------

// document.addEventListener("DOMContentLoaded", () => {
//   const button = document.getElementById("confirm-btn");
//   const checkbox = document.getElementById("confirm-checkbox");
//   const pDelete = document.getElementById("p-delete");
//   const aDownload = document.getElementById("a-download");
//   const storedChoices = localStorage.getItem("storedChoices");
//   let studyChoices;

//   if (storedChoices) {
//     studyChoices = JSON.parse(storedChoices);
//   } else {
//     console.error("No data found in local storage");
//   }
//   const subjID = studyChoices.ID || "testID";

//   const handleChecked = () => {
//     button.disabled = !checkbox.checked;
//   };

//   // document
//   //   .querySelector(".mdc-checkbox")
//   //   .addEventListener("click", handleChecked);

//   // function for response logging, creating json file on server
//   function downloadData(safe, ID) {
//     fetch("data/data.php", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ data: JSON.stringify(safe), fname: ID }),
//     })
//       .then((response) => response.json())
//       .then((data) => {
//         console.log("Success:", data);
//       })
//       .catch((error) => {
//         console.error("Error:", error);
//       });
//   }

//   const handleConfirmClick = (event) => {
//     event.preventDefault();

//     pDelete.innerHTML =
//       "<strong>Wir werden Ihre Daten löschen. Danke!</strong>";

//     const date = new Date();

//     const toSave = {
//       // get ID out of URL parameter
//       subjID: studyChoices.ID || "testID",
//       deleteData: true,
//       timestamp: date.toISOString(),
//       epoch: date.getTime(),
//     };
//     const toSaveID = `DELETE${subjID}`;
//     downloadData(toSave, toSaveID);
//   };

//   button.addEventListener("click", handleConfirmClick, {
//     capture: false,
//     once: true,
//   });

//   // define what happens on button click
//   const handleDownloadClick = () => {
//     window.open("images/thanks.pdf");
//   };

//   aDownload.addEventListener("click", handleDownloadClick, { capture: false });
// });
