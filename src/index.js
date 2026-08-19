// German-only branch: skip the language selection screen entirely and
// go straight to id.html with the language fixed to German.
const studyChoices = { lang: "ger" };
localStorage.setItem("storedChoices", JSON.stringify(studyChoices));

window.location.replace("./id.html");

