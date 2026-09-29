let timerInterval = null;
let targetTime = null;
let remainingMs = 0;

self.onmessage = function (e) {
  const { action, durationMs } = e.data;

  if (action === "start") {
    if (remainingMs > 0) {
      targetTime = Date.now() + remainingMs;
    } else {
      targetTime = Date.now() + durationMs;
    }

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      const remaining = targetTime - Date.now();
      remainingMs = remaining;

      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        remainingMs = 0;
        self.postMessage({ type: "complete" });
      } else {
        self.postMessage({ type: "tick", remaining });
      }
    }, 100);
  } 
  
  else if (action === "pause") {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (targetTime) {
      remainingMs = Math.max(0, targetTime - Date.now());
    }
    self.postMessage({ type: "paused", remaining: remainingMs });
  } 
  
  else if (action === "reset") {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    targetTime = null;
    remainingMs = 0;
    self.postMessage({ type: "reset" });
  }
};
