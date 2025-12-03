// import { pause } from "./js/pause.js";

export const allAudios = [];

export function playAudio(audio) {
  allAudios.forEach(function (a) {
    a.pause();
    a.currentTime = 0;
  });

  if (!audio) return;
  // audio.play();

  try {
    audio.play();  // try to play the audio
  } catch (err) {
    // ❗ This runs if Safari blocked the play()
    // showAudioUnlockPrompt(el);  // show your "Tap to enable sound" overlay
    alert("Please interact with the page to enable audio playback.");
  }
}