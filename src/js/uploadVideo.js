
// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
export async function uploadVideo(iOSSafari, webcam, subjID, mrec) {

  try {
    debugger;
    if (!iOSSafari && (webcam === "true")) {
        mrec.stopRecorder();

        // give some time to create Video Blob

        const day = new Date().toISOString().substring(0, 10);
        const time = new Date().toISOString().substring(11, 19);
        // save video on server
        
        setTimeout(() => {
          mrec.uploadVideo(
          {
            fname: `prabat-${subjID}-${day}-${time}`
          },
          './data/upload_video.php',
        );
        }, 2000);     
      }
      
      
    } catch (error) {
      console.error('Error uploading video:', error);
    }
}
