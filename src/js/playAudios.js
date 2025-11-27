export const allAudios = [];

export function playAudio(audio) {
  allAudios.forEach(a => {
    a.pause();
    a.currentTime = 0;
  });

  audio.play();
}