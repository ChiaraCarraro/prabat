
import { uploadLastRecordingInChunks } from "./mediaRecorderServices";
// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
export async function uploadVideo(webcam, subjID) {

  try {
    debugger;
   if ((webcam === "true"))  {
        // give some time to create Video Blob

        const day = new Date().toISOString().substring(0, 10);
        const time = new Date().toISOString().substring(11, 19);
        try {
          await uploadLastRecordingInChunks('./data/upload_video.php', { filename: `gdp-prabat-${subjID}-${day}-${time}` })
        } catch (error) {
          console.log("Error is in upload video");
        }
      }
      
      
    } catch (error) {
      console.error('Error uploading video:', error);
    }
}
