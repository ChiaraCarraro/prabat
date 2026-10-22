// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR ENFORCING FULLSCREEN
// ---------------------------------------------------------------------------------------------------------------------
export const openFullscreen = () => {
  const elem = document.documentElement;
  let request;
  if (elem.requestFullscreen) {
    request = elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    /* Safari */
    request = elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    /* IE11 */
    request = elem.msRequestFullscreen();
  }

  // Keep phones in landscape. Only works in fullscreen and only on some
  // browsers (e.g. Android Chrome); elsewhere #rotate-overlay asks the user.
  Promise.resolve(request)
    .then(() => screen.orientation?.lock?.("landscape"))
    .catch(() => {});
};
