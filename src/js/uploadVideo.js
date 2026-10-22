// ---------------------------------------------------------------------------------------------------------------------
// Send the webcam recording to the server in chunks (public/data/upload_video.php joins them).
// Currently NOT used: the server upload is switched off in prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
import { uploadLastRecordingInChunks } from "./mediaRecorderServices";
import { buildFileName } from "./studyOutput.js";

export async function uploadVideo(webcam, subjID) {
  try {
    if (webcam === "true") {
      try {
        await uploadLastRecordingInChunks("./data/upload_video.php", {
          filename: buildFileName(subjID),
        });
      } catch (error) {
        console.log("Error is in upload video");
      }
    }
  } catch (error) {
    console.error("Error uploading video:", error);
  }
}
