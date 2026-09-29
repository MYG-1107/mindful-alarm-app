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
const silentAudio = document.getElementById("silentAudio");

const gdprBanner = document.getElementById("gdprBanner");
const gdprAccept = document.getElementById("gdprAccept");
const gdprDecline = document.getElementById("gdprDecline");
const manageConsentBtn = document.getElementById("manageConsentBtn");

// Initialize Web Worker
function initWorker() {
  if (window.Worker) {
    timerWorker = new Worker("js/timer-worker.js");
    timerWorker.onmessage = handleWorkerMessage;
  } else {
    alert("Web Workers are required for accurate background timing.");
  }
}

// GDPR Consent Logic
function checkGdprConsent() {
  const consent = localStorage.getItem("zen_gdpr_consent");
  if (!consent) {
    gdprBanner.classList.remove("hidden");
  } else if (consent === "granted") {
    loadSavedSettings();
  }
}

function saveSettings() {
  if (localStorage.getItem("zen_gdpr_consent") === "granted") {
    localStorage.setItem("zen_voice_pref", voiceToggle.checked);
    localStorage.setItem("zen_chime_pref", chimeToggle.checked);
  }
}

function loadSavedSettings() {
  const savedVoice = localStorage.getItem("zen_voice_pref");
  const savedChime = localStorage.getItem("zen_chime_pref");
  if (savedVoice !== null) voiceToggle.checked = savedVoice === "true";
  if (savedChime !== null) chimeToggle.checked = savedChime === "true";
}

gdprAccept.addEventListener("click", () => {
  localStorage.setItem("zen_gdpr_consent", "granted");
  gdprBanner.classList.add("hidden");
  saveSettings();
});

gdprDecline.addEventListener("click", () => {
  localStorage.setItem("zen_gdpr_consent", "denied");
  gdprBanner.classList.add("hidden");
});

manageConsentBtn.addEventListener("click", () => {
  gdprBanner.classList.remove("hidden");
});

// Format milliseconds to MM:SS or HH:MM:SS
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

// Play Tibetan Singing Bowl Bell Sound via Web Audio API
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

  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);

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

// Trigger Mobile & Desktop System Notification
function triggerNotification(text) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ZenTimer Session Complete", {
      body: `${text} meditation session completed!`,
      icon: "https://fav.farm/🧘"
    });
  }
}

// Mobile Lock Screen Audio Keep-Alive Session
function startBackgroundAudioSession() {
  if (silentAudio) {
    silentAudio.play().catch(err => console.log("Audio unlock required:", err));
  }

  // Register Media Session API for mobile lock screen display
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Meditation Session",
      artist: "ZenTimer",
      album: formattedDurationStr || "Active Session",
      artwork: [{ src: "https://fav.farm/🧘", sizes: "96x96", type: "image/png" }]
    });

    navigator.mediaSession.setActionHandler("pause", pauseTimer);
    navigator.mediaSession.setActionHandler("stop", resetTimer);
  }
}

function stopBackgroundAudioSession() {
  if (silentAudio) {
    silentAudio.pause();
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
  }
}

// Request Screen Wake Lock
async function requestWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.log("Wake Lock exception:", err.message);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

// Worker Message Handling
function handleWorkerMessage(e) {
  const { type, remaining } = e.data;

  if (type === "tick") {
    const formatted = formatTime(remaining);
    display.textContent = formatted;

    // Update Media Session position state on lock screen
    if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: initialDurationMs / 1000,
          playbackRate: 1.0,
          position: Math.max(0, (initialDurationMs - remaining) / 1000)
        });
      } catch (err) {
        // Ignore position state rounding errors
      }
    }
  } else if (type === "complete") {
    display.textContent = "00:00";
    statusBadge.textContent = "Completed";
    statusBadge.style.backgroundColor = "var(--success-color)";
    statusBadge.style.color = "#fff";

    startBtn.disabled = false;
    pauseBtn.disabled = true;

    stopBackgroundAudioSession();
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

// Control Events
function startTimer() {
  const hrs = parseInt(hoursInput.value) || 0;
  const mins = parseInt(minutesInput.value) || 0;
  initialDurationMs = ((hrs * 60) + mins) * 60 * 1000;

  if (initialDurationMs <= 0) return;

  let parts = [];
  if (hrs > 0) parts.push(`${hrs} hour${hrs > 1 ? "s" : ""}`);
  if (mins > 0) parts.push(`${mins} minute${mins > 1 ? "s" : ""}`);
  formattedDurationStr = parts.join(" ") || "Timer";

  // Audio Context unlock gesture
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }

  startBackgroundAudioSession();
  timerWorker.postMessage({ action: "start", durationMs: initialDurationMs });

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  statusBadge.textContent = "Running";
  statusBadge.style.backgroundColor = "var(--accent-color)";
  statusBadge.style.color = "#0f172a";

  requestWakeLock();
}

function pauseTimer() {
  timerWorker.postMessage({ action: "pause" });
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBackgroundAudioSession();
  releaseWakeLock();
}

function resetTimer() {
  timerWorker.postMessage({ action: "reset" });
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  const hrs = parseInt(hoursInput.value) || 0;
  const mins = parseInt(minutesInput.value) || 0;
  display.textContent = formatTime(((hrs * 60) + mins) * 60 * 1000);
  stopBackgroundAudioSession();
  releaseWakeLock();
}

// Event Listeners
document.querySelectorAll(".btn-preset").forEach(btn => {
  btn.addEventListener("click", (e) => {
    hoursInput.value = 0;
    minutesInput.value = e.target.dataset.mins;
    resetTimer();
  });
});

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

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
hoursInput.addEventListener("change", resetTimer);
minutesInput.addEventListener("change", resetTimer);

voiceToggle.addEventListener("change", saveSettings);
chimeToggle.addEventListener("change", saveSettings);

// Boot
initWorker();
checkGdprConsent();
