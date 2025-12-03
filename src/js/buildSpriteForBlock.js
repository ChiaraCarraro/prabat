// generic helper: given a block name (e.g. "DiscourseNovelty"),
// build one fused AudioBuffer and a timing map from its transition slides.
export async function buildSpriteForBlock(blockName) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

  // find all transition slides for this block, in DOM order
  const slides = Array.from(
    document.querySelectorAll(`.trials.transitionSlide.${blockName}`)
  );

  if (!slides.length) {
    throw new Error(`No transitionSlide divs found for block "${blockName}"`);
  }

  // collect clips: label -> url from <audio class="prompt">
  const clips = []; // [{ label, url }, ...]

  for (const slide of slides) {
    const prompt = slide.querySelector("audio.prompt");
    if (!prompt) continue;

    const url = prompt.src;
    const filename = url.split("/").pop();     // e.g. "DiscNovLook.mp3"
    const label = filename.replace(/\.[^.]+$/, ""); // "DiscNovLook"

    clips.push({ label, url });
  }

  if (!clips.length) {
    throw new Error(`No prompt audios found for block "${blockName}"`);
  }

  // load & decode all clips
  const decoded = [];
  for (const { label, url } of clips) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arrayBuf);
    decoded.push({ label, buf });
  }

  // create one big buffer
  const numChannels = decoded[0].buf.numberOfChannels;
  const sampleRate = decoded[0].buf.sampleRate;

  let totalLength = 0;
  decoded.forEach(({ buf }) => {
    totalLength += buf.length;
  });

  const bigBuffer = ctx.createBuffer(numChannels, totalLength, sampleRate);

  // build timing map and copy audio
  const timing = {}; // { label: { start, duration } in seconds }
  let offset = 0;

  for (const { label, buf } of decoded) {
    const length = buf.length;

    for (let ch = 0; ch < numChannels; ch++) {
      const dst = bigBuffer.getChannelData(ch);
      const src = buf.getChannelData(ch);
      dst.set(src, offset);
    }

    const startSeconds = offset / sampleRate;
    const durationSeconds = length / sampleRate;

    timing[label] = {
      start: startSeconds,
      duration: durationSeconds,
    };

    offset += length;
  }

  return {
    ctx,
    audioBuffer: bigBuffer,
    timing,
  };
}
