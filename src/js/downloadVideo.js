
// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
export async function downloadVideo(iOSSafari, webcam, subjID, mrec) {

  try {
    debugger;
    if (!iOSSafari && (webcam === "true"))  {
        mrec.stopRecorder();

        // give some time to create Video Blob

        const day = new Date().toISOString().substring(0, 10);
        const time = new Date().toISOString().substring(11, 19);
        // save video on server

        // save video locally
        setTimeout(() => {
          mrec.downloadVideo(
          `prabat-${subjID}-${day}-${time}`,
        );
        }, 2000);
            
      }
    } catch (error) {
      console.error('Error uploading video:', error);
    }
}
