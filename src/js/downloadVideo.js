import { downloadLastRecording } from "./mediaRecorderServices";
// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
export async function downloadVideo(webcam, subjID) {

  try {
    debugger;
    if (webcam === "true")  {

        // give some time to create Video Blob

        const day = new Date().toISOString().substring(0, 10);
        const time = new Date().toISOString().substring(11, 19);
        // save video on server

        // save video locally
        setTimeout(() => {
         downloadLastRecording(
          `gdp-prabat-${subjID}-${day}-${time}`,
        );
        }, 2000);
            
      }
    } catch (error) {
      console.error('Error downloading video:', error);
    }
}
