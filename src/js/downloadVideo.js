// ---------------------------------------------------------------------------------------------------------------------
// Save the webcam recording on the participant's device (only if the webcam was switched on).
// Called at the end of the study by prabat.js, after the recording has been stopped.
// ---------------------------------------------------------------------------------------------------------------------
import { downloadLastRecording } from "./mediaRecorderServices";
import { buildFileName } from "./studyOutput.js";

export async function downloadVideo(webcam, subjID) {
  try {
    if (webcam === "true") {
      const fileName = buildFileName(subjID);
      // wait 2 s so the recorder has finished creating the video file
      setTimeout(() => {
        downloadLastRecording(fileName);
      }, 2000);
    }
  } catch (error) {
    console.error("Error downloading video:", error);
  }
}
