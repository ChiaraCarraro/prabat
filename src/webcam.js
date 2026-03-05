import './css/style.css';
const button = document.getElementById('continue-button');

// // Needs JSON.parse to convert the string back to an object, otherwise we get e.g. "\"test\""
// const subjID = JSON.parse(localStorage.getItem('subjID')) || 'test';

// // Use the German/Leipzig default settings
// const webcam = 'true';
// const saving = 'upload';

// Check if the URL contains any parameters
const urlParams = new URLSearchParams(window.location.search);
console.log(urlParams.toString());
if (urlParams.toString()) {
  // If there are URL parameters, save them in an object
  const storedChoices = {};
  urlParams.forEach((value, key) => {
    storedChoices[key] = value;
  });

  // Save the object to localStorage for persistence
  localStorage.setItem('storedChoices', JSON.stringify(storedChoices));

  // Hide the URL parameter after saving it in local storage
  window.history.replaceState(null, document.title, window.location.pathname);
} else {
  console.log('No URL parameters found.');
}


const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}

// get and store parameters. If local storage is empty, set default values
studyChoices.ID = studyChoices?.ID ?? 'testID';
studyChoices.webcam = (studyChoices?.webcam=="true").toString();

console.log("Study Choices:", studyChoices);

const handleContinueClick = (event) => {
  event.preventDefault();
  window.location.href = `./instructions.html`;
};


button.addEventListener('click', handleContinueClick, { capture: false });
