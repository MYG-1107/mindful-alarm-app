// State & UI References
let timerWorker = null;
let audioCtx = null;
let wakeLock = null;
let initialDurationMs = 0;
let formattedDurationStr = "";

const display = document.getElementById("display");
const statusBadge = document.getElementById("statusBadge");
const hoursInput = document.getElementById("hours");
const minutesInput = document.getElementById("minutes");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const notifyBtn = document.getElementById("notifyBtn");

const voiceToggle = document.getElementById("voiceToggle");
const chimeToggle = document.getElementById("chimeToggle");

// Initialize Web Worker
function initWorker() {
  if (window.Worker) {
    timerWorker = new Worker("js/timer-worker.js");
    timerWorker.onmessage = handleWorkerMessage;
  } else {
    alert("Web Workers are required for accurate background timing.");
  }
}

// Format milliseconds into HH:MM:SS or MM:SS
function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Synthesize Tibetan Singing Bowl Bell Sound via Web Audio API
function playChimeSound() {
  if (!chimeToggle.checked) return;
  
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Bell base frequency (440Hz / Warm tone)
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);

  // Exponential audio decay (bell envelope)
  gain.gain.setValueAtTime(0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 3.5);
}

// Speak voice announcement via Web Speech API
function speakCompletion(text) {
  if (!voiceToggle.checked || !("speechSynthesis" in window)) return;
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${text} completed`);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Send OS Notification
function triggerNotification(text) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ZenTimer Complete", {
      body: `${text} session completed!`,
      icon: "https://fav.farm/🧘"
    });
  }
}

// Request Screen Wake Lock
async function requestWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.log("Wake Lock request failed:", err.message);
    }
  }
}

// Release Screen Wake Lock
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

// Worker Message Handler
function handleWorkerMessage(e) {
  const { type, remaining } = e.data;

  if (type === "tick") {
    display.textContent = formatTime(remaining);
  } else if (type === "complete") {
    display.textContent = "00:00";
    statusBadge.textContent = "Completed";
    statusBadge.style.backgroundColor = "var(--success-color)";
    statusBadge.style.color = "#fff";

    startBtn.disabled = false;
    pauseBtn.disabled = true;

    releaseWakeLock();
    playChimeSound();
    speakCompletion(formattedDurationStr);
    triggerNotification(formattedDurationStr);
  } else if (type === "paused") {
    statusBadge.textContent = "Paused";
  } else if (type === "reset") {
    statusBadge.textContent = "Ready";
    statusBadge.style.backgroundColor = "var(--border-color)";
    statusBadge.style.color = "var(--text-muted)";
  }
}

// Start Timer Event
function startTimer() {
  const hrs = parseInt(hoursInput.value) || 0;
  const mins = parseInt(minutesInput.value) || 0;
  initialDurationMs = ((hrs * 60) + mins) * 60 * 1000;

  if (initialDurationMs <= 0) return;

  let parts = [];
  if (hrs > 0) parts.push(`${hrs} hour${hrs > 1 ? "s" : ""}`);
  if (mins > 0) parts.push(`${mins} minute${mins > 1 ? "s" : ""}`);
  formattedDurationStr = parts.join(" ") || "Timer";

  // Unlock audio permissions on browser gesture
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // Prime Web Speech synthesis
  if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }

  timerWorker.postMessage({ action: "start", durationMs: initialDurationMs });

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  statusBadge.textContent = "Running";
  statusBadge.style.backgroundColor = "var(--accent-color)";
  statusBadge.style.color = "var(--bg-color)";

  requestWakeLock();
}

// Pause Timer Event
function pauseTimer() {
  timerWorker.postMessage({ action: "pause" });
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  releaseWakeLock();
}

// Reset Timer Event
function resetTimer() {
  timerWorker.postMessage({ action: "reset" });
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  const hrs = parseInt(hoursInput.value) || 0;
  const mins = parseInt(minutesInput.value) || 0;
  display.textContent = formatTime(((hrs * 60) + mins) * 60 * 1000);
  releaseWakeLock();
}

// Handle Preset Buttons
document.querySelectorAll(".btn-preset").forEach(btn => {
  btn.addEventListener("click", (e) => {
    hoursInput.value = 0;
    minutesInput.value = e.target.dataset.mins;
    resetTimer();
  });
});

// Request Notification Permission
notifyBtn.addEventListener("click", () => {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        notifyBtn.textContent = "✓ Desktop Notifications Enabled";
        notifyBtn.style.color = "var(--success-color)";
      }
    });
  }
});

// Event Listeners
startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
hoursInput.addEventListener("change", resetTimer);
minutesInput.addEventListener("change", resetTimer);

// Initialize on Load
initWorker();
