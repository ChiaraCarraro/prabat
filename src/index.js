import "./css/landingpages.css";
let selectedLang = document.getElementById("language-select").value;

// Language dropdown
document.getElementById("language-select").addEventListener("change", (e) => {
  selectedLang = e.target.value;
});

const button = document.getElementById("start-button");
// Continue button click
const handleContinueClick = (event) => {
  event.preventDefault();

  // Store choices in localStorage
  const studyChoices = {
    lang: selectedLang,
  };
  localStorage.setItem("storedChoices", JSON.stringify(studyChoices));

  // Redirect to instructions with selected language
  window.location.href = `./id.html`;
};

button.addEventListener("click", handleContinueClick);
