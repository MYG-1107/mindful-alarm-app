(() => {
  "use strict";
  const networkStatus = document.getElementById("networkStatus");
  const appNotice = document.getElementById("appNotice");
  let noticeTimer;
  function showNotice(message, kind="info", persistent=false) {
    if (!appNotice) return;
    clearTimeout(noticeTimer); appNotice.hidden=false; appNotice.dataset.kind=kind; appNotice.innerHTML=message;
    if (!persistent) noticeTimer=setTimeout(()=>{appNotice.hidden=true;},6500);
  }
  function updateConnection() {
    if (!networkStatus) return;
    const online = navigator.onLine;
    networkStatus.textContent = online ? "Online" : "Offline-ready";
    networkStatus.classList.toggle("online", online);
    networkStatus.classList.toggle("offline", !online);
    if (!online) showNotice("<strong>Offline mode:</strong> the cached app can still run after it has been opened once. Browser audio and permission rules still apply.","offline");
  }
  addEventListener("online", updateConnection); addEventListener("offline", updateConnection); updateConnection();
  addEventListener("beforeunload", (event) => {
    const start=document.getElementById("startBtn"), pause=document.getElementById("pauseBtn");
    if (start?.disabled && pause && !pause.disabled) { event.preventDefault(); event.returnValue="A ZenTimer session is running."; }
  });
  document.addEventListener("zentimer-storage-unavailable", () => showNotice("<strong>Local history is unavailable:</strong> the core timer remains usable, but saved routines and session history may not persist in this browser mode.","warning",true));
  if (!("indexedDB" in window)) showNotice("<strong>Storage note:</strong> this browser does not support IndexedDB, so the timer will work without persistent history.","warning",true);
  addEventListener("error", (event) => { if (event?.message) showNotice("<strong>Optional feature warning:</strong> the main timer remains available, but one background feature may have failed.","warning"); });
  addEventListener("unhandledrejection", () => showNotice("<strong>Optional feature warning:</strong> the main timer remains available, but one background feature could not finish.","warning"));
})();
