let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let lastRecordedBlob = null;
let stopPromiseResolve = null;

/**
 * Initialize camera + (optionally) microphone and attach to a <video> element.
 *
 * @param {MediaStreamConstraints} [constraints] - Optional getUserMedia constraints.
 * @returns {Promise<MediaStream>}
 */
export async function initMedia(constraints) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("getUserMedia is not supported in this browser.");
  }

  // Stop any existing stream tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  const defaultConstraints = {
    audio: true,
    video: {
      width: { ideal: 640, max: 640 },   // lower resolution
      height: { ideal: 480, max: 480 },
      frameRate: { ideal: 10, max: 15 }, // low-ish fps
      facingMode: "user",
    },
  };

  const finalConstraints = constraints || defaultConstraints;
  
  
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
    
  } catch (err) {

    if (String(err).includes("No AVAudioSessionCaptureDevice")) {
      console.warn("iOS cannot access microphone. Retrying without audio...");
      
      // Retry video-only
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 640 },   // lower resolution
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 10, max: 15 }, // low-ish fps
          facingMode: "user",
        },
        audio: false
      });
    } else {
      throw err;
    }
  }
  
  return mediaStream;
}

/**
 * Start recording the existing mediaStream.
 */
export function startRecording() {
  if (!mediaStream) {
    throw new Error("Media stream is not initialized. Call initMedia() first.");
  }

  // Reset previous recording
  recordedChunks = [];
  lastRecordedBlob = null;

  let supportedMimeType = "video/webm";

  const recorderOptions = {
    mimeType: supportedMimeType,
    videoBitsPerSecond: 150_000, // 150 kbps – quite low quality
  };

  const recorderOptionsWithoutMimeType = {
    videoBitsPerSecond: 150_000, // 150 kbps – quite low quality
  };
  
  try {
    mediaRecorder = supportedMimeType
      ? new MediaRecorder(mediaStream, recorderOptions)
      : new MediaRecorder(mediaStream);
  } catch (err) {
    console.error("Failed to create MediaRecorder:", err);
    mediaRecorder = new MediaRecorder(mediaStream, recorderOptionsWithoutMimeType);
    //throw err;
  }

  mediaRecorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = event => {
    console.error("MediaRecorder error:", event.error);
  };

  mediaRecorder.onstop = () => {
    lastRecordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    if (stopPromiseResolve) {
      stopPromiseResolve(lastRecordedBlob);
      stopPromiseResolve = null;
    }
  };

  mediaRecorder.start(); // You can add timeslice if you want data every X ms
}

/**
 * Stop recording and return a Promise that resolves to the recorded Blob.
 *
 * @returns {Promise<Blob>}
 */
export function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    //return Promise.reject(new Error("No active recording to stop."));
    console.warn("stopRecording called but there is no active recording.");
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    stopPromiseResolve = resolve;
    mediaRecorder.stop();
  });
}

/**
 * Get the last recorded Blob (if any).
 *
 * @returns {Blob|null}
 */
export function getLastRecordingBlob() {
  return lastRecordedBlob;
}

/**
 * Create an object URL from the last recorded Blob.
 *
 * @returns {string|null} - URL for use in <video src>, <a href>, etc.
 */
export function getLastRecordingUrl() {
  if (!lastRecordedBlob) return null;
  return URL.createObjectURL(lastRecordedBlob);
}

/**
 * Download the last recorded video as a file.
 *
 * @param {string} [filename="recording.webm"]
 */
export function downloadLastRecording(filename = "recording.webm") {
  if (!lastRecordedBlob) {
    throw new Error("No recording available to download.");
  }

  const url = URL.createObjectURL(lastRecordedBlob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Upload the last recorded video in chunks to a server endpoint.
 *
 * The server receives each chunk as a normal file upload, plus metadata:
 *   - uploadId       : unique ID for this upload
 *   - chunkIndex     : index of this chunk (0-based)
 *   - totalChunks    : total number of chunks
 *   - originalFilename: final file name (e.g. "recording.webm")
 *
 * @param {string} endpointUrl - Your PHP chunk handler (e.g. "/upload_chunked.php").
 * @param {Object} [options]
 * @param {string} [options.fieldName="vidfile"] - FormData field name (matches PHP $_FILES[...] key).
 * @param {string} [options.filename="recording.webm"] - Final desired file name.
 * @param {number} [options.chunkSize=1024*1024] - Chunk size in bytes (default 1MB).
 * @param {Object} [options.additionalData] - Extra key/value pairs to send with every chunk.
 * @param {RequestInit} [options.fetchOptions] - Extra fetch options (headers, etc.).
 * @param {Function} [options.onProgress] - Callback(progress, info) where progress is 0–1.
 * @returns {Promise<Response>} - The response of the **last** chunk request.
 */
export async function uploadLastRecordingInChunks(
  endpointUrl,
  {
    fieldName = "vidfile",
    filename = "recording.webm",
    chunkSize = 1024 * 1024 * 5, // 5MB
    additionalData = {},
    fetchOptions = {},
    onProgress
  } = {}
) {
  if (!lastRecordedBlob) {
    throw new Error("No recording available to upload.");
  }

  const totalSize = lastRecordedBlob.size;
  const totalChunks = Math.ceil(totalSize / chunkSize);

  // Unique ID for this upload (so the server can group chunks)
  const uploadId =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  let uploadedBytes = 0;
  let lastResponse = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = lastRecordedBlob.slice(start, end);

    const formData = new FormData();
    formData.append(fieldName, chunk, filename);

    // Chunk metadata
    formData.append("uploadId", uploadId);
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("totalChunks", totalChunks.toString());
    formData.append("originalFilename", filename);

    // Any extra fields you want
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(endpointUrl, {
      method: "POST",
      body: formData,
      ...fetchOptions
    });

    if (!response.ok) {
      throw new Error(
        `Chunk upload failed at index ${chunkIndex} with status ${response.status}`
      );
    }

    lastResponse = response;

    uploadedBytes = end;
    if (typeof onProgress === "function") {
      const progress = uploadedBytes / totalSize;
      onProgress(progress, {
        uploadedBytes,
        totalBytes: totalSize,
        chunkIndex,
        totalChunks,
        uploadId
      });
    }
  }

  return lastResponse;
}



/**
 * Stop the current media stream (camera/mic).
 * Useful when leaving the page or after user is done.
 */
export function stopMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

/**
 * Check if the browser supports MediaRecorder.
 *
 * @returns {boolean}
 */
export function isMediaRecorderSupported() {
  return typeof MediaRecorder !== "undefined";
}
