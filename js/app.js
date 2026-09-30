(() => {
  "use strict";

  const DB_NAME = "ZenTimerDB";
  const DB_VERSION = 1;
  const ROUTINE_KEY = "zen-routines";
  const CONSENT_KEY = "zen-local-consent";

  const state = {
    worker: null,
    audioCtx: null,
    ambientNodes: [],
    ambientGain: null,
    customAudioUrl: null,
    wakeLock: null,
    deferredInstallPrompt: null,
    sequence: [],
    loops: 1,
    running: false,
    paused: false,
    sessionTotalMs: 0,
    sessionElapsedMs: 0,
    currentStage: 0,
    currentLoop: 1,
    formattedDuration: "",
    intervalNextMs: 0,
    visualAlarmActive: false,
    pendingCompletion: null,
    zenStartedAt: null,
    zenClockTimer: null,
    zenPhaseTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const display = $("display");
  const statusBadge = $("statusBadge");
  const hoursInput = $("hours");
  const minutesInput = $("minutes");
  const stageProgressBar = $("stageProgressBar");
  const currentStageName = $("currentStageName");
  const stageCounter = $("stageCounter");
  const loopCounter = $("loopCounter");
  const sessionElapsed = $("sessionElapsed");
  const sessionTotal = $("sessionTotal");
  const startBtn = $("startBtn");
  const pauseBtn = $("pauseBtn");
  const resetBtn = $("resetBtn");
  const ambientSelect = $("ambientSelect");
  const intervalToggle = $("intervalToggle");
  const intervalMinutes = $("intervalMinutes");
  const chimeToggle = $("chimeToggle");
  const voiceToggle = $("voiceToggle");
  const visualAlarmToggle = $("visualAlarmToggle");
  const notifyBtn = $("notifyBtn");
  const routineTemplate = $("routineTemplate");
  const routineLoops = $("routineLoops");
  const routineList = $("routineList");
  const routineDurationChip = $("routineDurationChip");
  const blockName = $("blockName");
  const blockMinutes = $("blockMinutes");
  const blockSeconds = $("blockSeconds");
  const savedRoutineSelect = $("savedRoutineSelect");
  const reflectionModal = $("reflectionModal");
  const reflectionSummary = $("reflectionSummary");
  const focusRating = $("focusRating");
  const reflectionNote = $("reflectionNote");
  const recentSessions = $("recentSessions");
  const totalHours = $("totalHours");
  const currentStreak = $("currentStreak");
  const longestStreak = $("longestStreak");
  const sessionCount = $("sessionCount");
  const weeklyHeatmap = $("weeklyHeatmap");
  const monthlyHeatmap = $("monthlyHeatmap");
  const dropZone = $("dropZone");
  const audioFileInput = $("audioFileInput");
  const customAudio = $("customAudio");
  const silentAudio = $("silentAudio");
  const customAudioName = $("customAudioName");
  const previewAudioBtn = $("previewAudioBtn");
  const deleteAudioBtn = $("deleteAudioBtn");
  const gdprBanner = $("gdprBanner");
  const zenOverlay = $("zenOverlay");
  const breathPhase = $("breathPhase");
  const zenStage = $("zenStage");
  const zenClock = $("zenClock");
  const visualAlert = $("visualAlert");
  const appShell = $("appShell");

  function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
    return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }

  function formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rest = mins % 60;
      return `${hrs}h ${rest ? `${rest}m` : ""}`.trim();
    }
    if (mins > 0) return `${mins}m ${secs ? `${secs}s` : ""}`.trim();
    return `${secs}s`;
  }

  function dateKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0,0,0,0);
    return copy;
  }

  function localStorageAllowed() {
    return localStorage.getItem(CONSENT_KEY) !== "temporary";
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("stats")) db.createObjectStore("stats", { keyPath: "id" });
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "id" });
        if (!db.objectStoreNames.contains("routines")) db.createObjectStore("routines", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbPut(storeName, value) {
    if (!localStorageAllowed()) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbAdd(storeName, value) {
    if (!localStorageAllowed()) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).add(value);
      req.onsuccess = () => resolve(req.result);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbGet(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbAll(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbDelete(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function clearStore(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  function setStatus(text, kind = "") {
    statusBadge.textContent = text;
    statusBadge.className = "status-badge";
    if (kind) statusBadge.classList.add(kind);
  }

  function makeSingleSequence() {
    const hrs = Math.max(0, Number.parseInt(hoursInput.value, 10) || 0);
    const mins = Math.max(0, Math.min(59, Number.parseInt(minutesInput.value, 10) || 0));
    const durationMs = ((hrs * 60) + mins) * 60 * 1000;
    return durationMs > 0 ? [{ name: "Focused Session", durationMs }] : [];
  }

  function routineTotalMs() {
    return state.sequence.reduce((sum, item) => sum + item.durationMs, 0) * state.loops;
  }

  function renderRoutine() {
    routineList.innerHTML = "";
    if (!state.sequence.length) {
      routineList.innerHTML = `<div class="routine-empty">No routine blocks yet — the single timer will be used.</div>`;
    } else {
      state.sequence.forEach((block, index) => {
        const row = document.createElement("div");
        row.className = "routine-item";
        row.innerHTML = `
          <div class="routine-index">${index + 1}</div>
          <div><strong>${escapeHtml(block.name)}</strong><br><small>${formatDuration(block.durationMs)}</small></div>
          <div class="routine-actions">
            <button class="tiny-btn" data-action="up" data-index="${index}" title="Move up">↑</button>
            <button class="tiny-btn" data-action="down" data-index="${index}" title="Move down">↓</button>
          </div>
          <div class="routine-actions">
            <button class="tiny-btn" data-action="delete" data-index="${index}" title="Remove">×</button>
          </div>`;
        routineList.appendChild(row);
      });
    }
    routineDurationChip.textContent = formatDuration(routineTotalMs() || getSingleDurationMs());
    syncTimerPreview();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
  }

  function getSingleDurationMs() {
    return makeSingleSequence()[0]?.durationMs || 0;
  }

  function activeSequence() {
    return state.sequence.length ? state.sequence : makeSingleSequence();
  }

  function setSequence(sequence, loops = 1) {
    state.sequence = sequence.map((item) => ({ name: item.name, durationMs: Math.max(1000, item.durationMs) }));
    state.loops = Math.max(1, Math.min(12, Number.parseInt(loops, 10) || 1));
    routineLoops.value = state.loops;
    renderRoutine();
    resetTimer(false);
  }

  function syncTimerPreview() {
    const seq = activeSequence();
    const total = seq.reduce((sum, item) => sum + item.durationMs, 0) * state.loops;
    sessionTotal.textContent = `${formatDuration(total)} total`;
    if (!state.running) {
      display.textContent = formatTime(seq[0]?.durationMs || 0);
      currentStageName.textContent = seq[0]?.name || "Single Timer";
      stageCounter.textContent = `1 / ${Math.max(1, seq.length)}`;
      loopCounter.textContent = `Loop 1 / ${state.loops}`;
      stageProgressBar.style.width = "0%";
    }
  }

  function addRoutineBlock() {
    const name = blockName.value.trim() || "Focus Block";
    const mins = Math.max(0, Number.parseInt(blockMinutes.value, 10) || 0);
    const secs = Math.max(0, Math.min(59, Number.parseInt(blockSeconds.value, 10) || 0));
    const durationMs = (mins * 60 + secs) * 1000;
    if (durationMs < 1000) return;
    state.sequence.push({ name, durationMs });
    blockName.value = "";
    blockMinutes.value = "";
    blockSeconds.value = "";
    renderRoutine();
  }

  function applyTemplate(name) {
    const templates = {
      morning: [
        ["Meditation", 20*60000],
        ["Breathwork", 5*60000],
        ["Journaling", 10*60000]
      ],
      pomodoro: [
        ["Deep Work", 25*60000],
        ["Short Break", 5*60000]
      ],
      deepwork: [
        ["Deep Work", 50*60000],
        ["Recovery Break", 10*60000]
      ]
    };
    const blocks = templates[name];
    if (!blocks) return;
    state.sequence = blocks.map(([label, durationMs]) => ({ name: label, durationMs }));
    state.loops = name === "pomodoro" ? 4 : 1;
    routineLoops.value = state.loops;
    routineTemplate.value = "";
    renderRoutine();
    resetTimer(false);
  }

  async function saveRoutine() {
    if (!localStorageAllowed()) return;
    const name = prompt("Name this routine:", "My Routine");
    if (!name?.trim() || !state.sequence.length) return;
    await idbAdd("routines", { id: uid(), name: name.trim(), loops: state.loops, sequence: state.sequence });
    await refreshSavedRoutines();
  }

  async function refreshSavedRoutines() {
    savedRoutineSelect.innerHTML = `<option value="">Choose a saved routine…</option>`;
    if (!localStorageAllowed()) return;
    const routines = await idbAll("routines");
    routines.sort((a,b) => a.name.localeCompare(b.name));
    routines.forEach((routine) => {
      const option = document.createElement("option");
      option.value = routine.id;
      option.textContent = `${routine.name} · ${routine.loops}×`;
      savedRoutineSelect.appendChild(option);
    });
  }

  async function loadSavedRoutine(id) {
    if (!id) return;
    const routine = await idbGet("routines", id);
    if (routine) setSequence(routine.sequence, routine.loops);
    savedRoutineSelect.value = "";
  }

  async function deleteSavedRoutine() {
    const id = savedRoutineSelect.value;
    if (!id) return;
    await idbDelete("routines", id);
    await refreshSavedRoutines();
  }

  function ensureWorker() {
    if (state.worker) return;
    state.worker = new Worker("js/timer-worker.js");
    state.worker.onmessage = onWorkerMessage;
  }

  function prepareSession() {
    const seq = activeSequence();
    if (!seq.length) return false;
    state.sequence = seq;
    state.sessionTotalMs = seq.reduce((sum, item) => sum + item.durationMs, 0) * state.loops;
    state.formattedDuration = formatDuration(state.sessionTotalMs);
    state.sessionElapsedMs = 0;
    state.currentStage = 0;
    state.currentLoop = 1;
    state.intervalNextMs = Number(intervalMinutes.value) * 60000;
    sessionElapsed.textContent = "0m elapsed";
    sessionTotal.textContent = `${state.formattedDuration} total`;
    return true;
  }

  async function startTimer() {
    clearVisualAlarm();
    const wasPaused = state.paused;
    if (!state.running && !state.paused && !prepareSession()) return;
    await unlockAudio();
    if (silentAudio) silentAudio.play().catch(() => {});
    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "ZenTimer Session", artist: "ZenTimer", album: state.formattedDuration });
      try { navigator.mediaSession.setActionHandler("pause", pauseTimer); } catch {}
      try { navigator.mediaSession.setActionHandler("stop", resetTimer); } catch {}
    }
    await startAmbient();
    await requestWakeLock();
    ensureWorker();

    state.running = true;
    state.paused = false;
    setStatus("Running", "running");
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    state.worker.postMessage({
      action: "start",
      sequence: state.sequence,
      loopCount: state.loops,
      resume: wasPaused
    });
  }

  function pauseTimer() {
    if (!state.worker || !state.running) return;
    state.worker.postMessage({ action: "pause" });
    state.running = false;
    state.paused = true;
    setStatus("Paused", "paused");
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopAmbient();
    if (silentAudio) silentAudio.pause();
    releaseWakeLock();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }

  function resetTimer(updateRoutine = true) {
    if (state.worker) state.worker.postMessage({ action: "reset" });
    state.running = false;
    state.paused = false;
    state.sessionElapsedMs = 0;
    state.currentStage = 0;
    state.currentLoop = 1;
    stopAmbient();
    if (silentAudio) silentAudio.pause();
    releaseWakeLock();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    clearVisualAlarm();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    setStatus("Ready");
    if (updateRoutine) {
      state.sequence = state.sequence; // keep builder content
    }
    syncTimerPreview();
    sessionElapsed.textContent = "0m elapsed";
  }

  function onWorkerMessage(event) {
    const { type, remaining, stageIndex, loopIndex, loopCount, stageDuration, totalElapsed } = event.data;
    if (type === "tick") {
      state.currentStage = stageIndex;
      state.currentLoop = loopIndex;
      state.sessionElapsedMs = Math.min(state.sessionTotalMs, totalElapsed);
      display.textContent = formatTime(remaining);
      currentStageName.textContent = state.sequence[stageIndex]?.name || "Session";
      stageCounter.textContent = `${stageIndex + 1} / ${state.sequence.length}`;
      loopCounter.textContent = `Loop ${loopIndex} / ${loopCount}`;
      const stageElapsed = Math.max(0, stageDuration - remaining);
      stageProgressBar.style.width = `${Math.min(100, (stageElapsed / stageDuration) * 100)}%`;
      sessionElapsed.textContent = `${formatDuration(state.sessionElapsedMs)} elapsed`;
      maybeIntervalChime(state.sessionElapsedMs);
      maybeAmbientFade();
      updateZenStage();
    } else if (type === "stage") {
      state.currentStage = stageIndex;
      state.currentLoop = loopIndex;
      display.textContent = formatTime(remaining);
      currentStageName.textContent = state.sequence[stageIndex]?.name || "Session";
      stageCounter.textContent = `${stageIndex + 1} / ${state.sequence.length}`;
      loopCounter.textContent = `Loop ${loopIndex} / ${loopCount}`;
      playChimeSound();
      maybeAmbientFade();
    } else if (type === "paused") {
      state.running = false;
      state.paused = true;
      state.currentStage = stageIndex;
      state.currentLoop = loopIndex;
      display.textContent = formatTime(remaining);
      setStatus("Paused", "paused");
    } else if (type === "reset") {
      resetTimer(false);
    } else if (type === "complete") {
      state.running = false;
      state.paused = false;
      state.sessionElapsedMs = state.sessionTotalMs;
      display.textContent = "00:00";
      sessionElapsed.textContent = `${state.formattedDuration} elapsed`;
      stageProgressBar.style.width = "100%";
      setStatus("Completed", "completed");
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      stopAmbient();
      if (silentAudio) silentAudio.pause();
      releaseWakeLock();
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
      playCompletionSound();
      speakCompletion();
      triggerNotification();
      triggerVisualAlarm();
      void persistCompletionRecord().catch((error) => {
        console.warn("Could not persist completed session", error);
        state.pendingCompletion = null;
        openReflection();
      });
    }
  }

  function maybeIntervalChime(elapsedMs) {
    if (!intervalToggle.checked || !state.sessionTotalMs) return;
    const intervalMs = Number(intervalMinutes.value) * 60000;
    if (!intervalMs) return;
    if (elapsedMs >= state.intervalNextMs && elapsedMs < state.sessionTotalMs - 2000) {
      playChimeSound();
      state.intervalNextMs += intervalMs;
    }
  }

  async function unlockAudio() {
    try {
      if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
    } catch (error) {
      console.warn("Audio context unavailable", error);
    }
  }

  function createNoiseBuffer(kind) {
    const sampleRate = state.audioCtx.sampleRate;
    const length = sampleRate * (kind === "rain" ? 6 : 4);
    const buffer = state.audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.4;
      } else {
        data[i] = white * (Math.random() > 0.997 ? 0.55 : 0.12);
      }
    }
    return buffer;
  }

  async function startAmbient() {
    stopAmbient();
    const mode = ambientSelect.value;
    if (!mode || mode === "off" || !state.audioCtx) return;

    const ctx = state.audioCtx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.2);
    gain.connect(ctx.destination);
    state.ambientGain = gain;
    state.ambientNodes = [gain];

    if (mode === "binaural") {
      const merger = ctx.createChannelMerger(2);
      const left = ctx.createOscillator();
      const right = ctx.createOscillator();
      const leftGain = ctx.createGain();
      const rightGain = ctx.createGain();
      left.frequency.value = 432;
      right.frequency.value = 436;
      leftGain.gain.value = 0.36;
      rightGain.gain.value = 0.36;
      left.connect(leftGain).connect(merger, 0, 0);
      right.connect(rightGain).connect(merger, 0, 1);
      merger.connect(gain);
      left.start(); right.start();
      state.ambientNodes.push(merger, left, right, leftGain, rightGain);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(mode);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = mode === "rain" ? "highpass" : "lowpass";
    filter.frequency.value = mode === "rain" ? 850 : 360;
    source.connect(filter).connect(gain);
    source.start();
    state.ambientNodes.push(source, filter);
  }

  function maybeAmbientFade() {
    if (!state.ambientGain || !state.running) return;
    const remaining = Math.max(0, state.sessionTotalMs - state.sessionElapsedMs);
    if (remaining <= 10000) {
      const now = state.audioCtx.currentTime;
      state.ambientGain.gain.cancelScheduledValues(now);
      state.ambientGain.gain.setValueAtTime(Math.max(0.0001, state.ambientGain.gain.value), now);
      state.ambientGain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.4, remaining/1000));
    }
  }

  function stopAmbient() {
    if (!state.audioCtx) return;
    state.ambientNodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        node.disconnect?.();
      } catch {}
    });
    state.ambientNodes = [];
    state.ambientGain = null;
  }

  function playChimeSound() {
    if (!chimeToggle.checked || !state.audioCtx) return;
    const ctx = state.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(392, now + 1.9);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + .04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.2);
  }

  function playCompletionSound() {
    if (!chimeToggle.checked) return;
    if (customAudio.src) {
      customAudio.currentTime = 0;
      customAudio.play().catch(() => playChimeSound());
    } else {
      playChimeSound();
    }
  }

  function speakCompletion() {
    if (!voiceToggle.checked || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`Session completed. ${state.formattedDuration}.`);
    u.rate = .9;
    window.speechSynthesis.speak(u);
  }

  function triggerNotification() {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("ZenTimer — Session Complete", {
          body: `${state.formattedDuration} finished.`,
          icon: "assets/icons/icon-192.png",
          tag: "zentimer-complete"
        });
      } catch {}
    }
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    if (state.wakeLock) return;
    try {
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener?.("release", () => { state.wakeLock = null; });
    } catch {}
  }

  function releaseWakeLock() {
    if (!state.wakeLock) return;
    state.wakeLock.release?.().catch(() => {});
    state.wakeLock = null;
  }

  function triggerVisualAlarm() {
    if (!visualAlarmToggle.checked) return;
    document.body.classList.add("visual-pulse");
    visualAlert.classList.remove("hidden");
    document.title = "(00:00) Complete!";
    state.visualAlarmActive = true;
  }

  function clearVisualAlarm() {
    document.body.classList.remove("visual-pulse");
    visualAlert.classList.add("hidden");
    document.title = "ZenTimer — Mindful Focus & Routine Timer";
    state.visualAlarmActive = false;
  }

  async function openReflection() {
    reflectionSummary.textContent = `${state.formattedDuration} completed · ${state.sequence.length} block${state.sequence.length === 1 ? "" : "s"} · ${state.loops} routine loop${state.loops === 1 ? "" : "s"}.`;
    focusRating.value = "3";
    reflectionNote.value = "";
    reflectionModal.classList.remove("hidden");
  }

  async function persistCompletionRecord() {
    const record = {
      completedAt: new Date().toISOString(),
      dateKey: dateKey(),
      totalSeconds: Math.round(state.sessionTotalMs / 1000),
      blocks: state.sequence.map((item) => ({ name: item.name, seconds: Math.round(item.durationMs / 1000) })),
      loops: state.loops,
      rating: null,
      note: ""
    };
    const id = await idbAdd("sessions", record);
    state.pendingCompletion = { ...record, id };
    await refreshAnalytics();
    await openReflection();
  }

  async function saveReflection(save = true) {
    if (state.pendingCompletion && save) {
      await idbPut("sessions", {
        ...state.pendingCompletion,
        rating: Number(focusRating.value),
        note: reflectionNote.value.trim()
      });
    }
    state.pendingCompletion = null;
    reflectionModal.classList.add("hidden");
    await refreshAnalytics();
  }

  async function refreshAnalytics() {
    if (!localStorageAllowed()) {
      renderStats([]);
      recentSessions.innerHTML = `<p class="muted">Temporary mode is active. Session history will not be persisted.</p>`;
      return;
    }
    const sessions = await idbAll("sessions");
    sessions.sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
    const stats = calculateStats(sessions);
    await idbPut("stats", { id: "summary", ...stats, updatedAt: new Date().toISOString() });
    renderStats(sessions);
    recentSessions.innerHTML = "";
    sessions.slice(0, 8).forEach((s) => {
      const row = document.createElement("div");
      row.className = "session-row";
      const rating = s.rating ? "★".repeat(s.rating) + "☆".repeat(5-s.rating) : "—";
      row.innerHTML = `<strong>${new Date(s.completedAt).toLocaleDateString()}</strong>
        <p>${escapeHtml(s.note || `${s.blocks.map(b=>b.name).join(" → ")}`)}</p>
        <span class="rating" title="Focus rating">${rating}</span>`;
      recentSessions.appendChild(row);
    });
    if (!sessions.length) recentSessions.innerHTML = `<p class="muted">Complete a session to see your private reflections here.</p>`;
  }

  function calculateStats(sessions) {
    const byDay = new Map();
    let totalSeconds = 0;
    sessions.forEach((s) => {
      totalSeconds += s.totalSeconds || 0;
      const key = s.dateKey || dateKey(s.completedAt);
      byDay.set(key, (byDay.get(key) || 0) + (s.totalSeconds || 0));
    });
    const dates = [...byDay.keys()].sort();
    const dayNumber = (key) => {
      const [y, m, d] = key.split("-").map(Number);
      return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    };
    let longest = 0, streak = 0, current = 0;
    let prev = null;
    for (const key of dates) {
      const d = dayNumber(key);
      if (prev !== null && d - prev === 1) streak += 1;
      else streak = 1;
      longest = Math.max(longest, streak);
      prev = d;
    }
    const todayKey = dateKey(new Date());
    const todayIndex = dayNumber(todayKey);
    const lastIndex = dates.length ? dayNumber(dates.at(-1)) : null;
    if (lastIndex !== null && (todayIndex - lastIndex === 0 || todayIndex - lastIndex === 1)) {
      current = 1;
      let cursor = lastIndex;
      for (let i = dates.length - 2; i >= 0; i--) {
        const candidate = dayNumber(dates[i]);
        if (cursor - candidate === 1) { current += 1; cursor = candidate; }
        else break;
      }
    }
    return { totalSeconds, currentStreak: current, longestStreak: longest, byDay: Object.fromEntries(byDay) };
  }

  function renderStats(sessions) {
    const stats = calculateStats(sessions);
    totalHours.textContent = `${(stats.totalSeconds / 3600).toFixed(1)}h`;
    currentStreak.textContent = String(stats.currentStreak);
    longestStreak.textContent = String(stats.longestStreak);
    sessionCount.textContent = String(sessions.length);
    drawHeatmap(weeklyHeatmap, stats.byDay, 35, "weekly");
    drawHeatmap(monthlyHeatmap, stats.byDay, 182, "monthly");
  }

  function drawHeatmap(container, byDay, days, mode) {
    const end = startOfDay(new Date());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const values = [];
    let max = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = dateKey(d);
      const secs = byDay[key] || 0;
      values.push({ d, key, secs });
      max = Math.max(max, secs);
    }
    const cell = mode === "weekly" ? 12 : 8;
    const gap = mode === "weekly" ? 4 : 3;
    const cols = mode === "weekly" ? 7 : 14;
    const rows = Math.ceil(values.length / cols);
    const width = cols * (cell + gap);
    const height = rows * (cell + gap);
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${mode} activity heatmap">`;
    values.forEach((item, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const ratio = max ? item.secs / max : 0;
      let level = 0;
      if (ratio > .75) level = 4; else if (ratio > .5) level = 3; else if (ratio > .25) level = 2; else if (ratio > 0) level = 1;
      const fill = ["rgba(77,208,225,.10)","rgba(77,208,225,.25)","rgba(77,208,225,.45)","rgba(77,208,225,.68)","rgb(77,208,225)"][level];
      svg += `<rect x="${col*(cell+gap)}" y="${row*(cell+gap)}" width="${cell}" height="${cell}" rx="${Math.min(3,cell/3)}" fill="${fill}">
        <title>${item.key}: ${formatDuration(item.secs*1000)}</title></rect>`;
    });
    svg += `</svg><div class="heatmap-legend"><span>Less</span><i></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i><span>More</span></div>`;
    container.innerHTML = svg;
  }

  async function exportSessions(kind) {
    if (!localStorageAllowed()) return;
    const sessions = await idbAll("sessions");
    sessions.sort((a,b) => new Date(a.completedAt) - new Date(b.completedAt));
    if (!sessions.length) return;
    let content = "";
    let filename = "";
    if (kind === "md") {
      content = `# ZenTimer Session Log\n\nExported ${new Date().toLocaleString()}\n\n`;
      sessions.forEach((s) => {
        content += `## ${new Date(s.completedAt).toLocaleString()} — ${formatDuration(s.totalSeconds*1000)}\n`;
        content += `Focus: ${s.rating ? `${s.rating}/5` : "Not rated"}\n\n`;
        content += `${s.note || "_No reflection note_"}\n\n`;
        content += `Blocks: ${s.blocks.map((b) => `${b.name} (${formatDuration(b.seconds*1000)})`).join(" → ")}\n\n`;
      });
      filename = "zentimer-sessions.md";
    } else {
      const rows = [["completed_at","total_seconds","rating","note","loops","blocks"]];
      sessions.forEach((s) => rows.push([
        s.completedAt, s.totalSeconds, s.rating ?? "", s.note || "", s.loops,
        s.blocks.map((b) => `${b.name} (${b.seconds}s)`).join(" | ")
      ]));
      content = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
      filename = "zentimer-sessions.csv";
    }
    downloadText(filename, content, kind === "md" ? "text/markdown" : "text/csv");
  }

  function csvEscape(value) {
    const string = String(value ?? "");
    return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleAudioFile(file) {
    if (!file || !/audio\/(mpeg|wav)|\.(mp3|wav)$/i.test(file.type || file.name)) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Please choose an audio file smaller than 20 MB.");
      return;
    }
    if (!localStorageAllowed()) {
      alert("Enable local storage to keep a custom bell between sessions.");
      return;
    }
    await idbPut("audio", { id: "customBell", blob: file, name: file.name, type: file.type });
    await loadCustomAudio();
  }

  async function loadCustomAudio() {
    if (!localStorageAllowed()) {
      customAudioName.textContent = "Temporary mode — no saved bell";
      previewAudioBtn.disabled = true;
      deleteAudioBtn.disabled = true;
      return;
    }
    const record = await idbGet("audio", "customBell");
    if (!record?.blob) {
      customAudioName.textContent = "No custom bell selected";
      previewAudioBtn.disabled = true;
      deleteAudioBtn.disabled = true;
      customAudio.removeAttribute("src");
      if (state.customAudioUrl) URL.revokeObjectURL(state.customAudioUrl);
      state.customAudioUrl = null;
      return;
    }
    if (state.customAudioUrl) URL.revokeObjectURL(state.customAudioUrl);
    state.customAudioUrl = URL.createObjectURL(record.blob);
    customAudio.src = state.customAudioUrl;
    customAudioName.textContent = record.name;
    previewAudioBtn.disabled = false;
    deleteAudioBtn.disabled = false;
  }

  async function removeCustomAudio() {
    await idbDelete("audio", "customBell");
    await loadCustomAudio();
  }

  function enterZenMode() {
    clearVisualAlarm();
    zenOverlay.classList.remove("hidden");
    zenOverlay.setAttribute("aria-hidden", "false");
    appShell.setAttribute("aria-hidden", "true");
    state.zenStartedAt = Date.now();
    updateZenStage();
    state.zenPhaseTimer = window.setInterval(updateZenStage, 250);
    state.zenClockTimer = window.setInterval(updateZenClock, 1000);
    updateZenClock();
    document.documentElement.requestFullscreen?.().catch?.(() => {});
  }

  function exitZenMode() {
    zenOverlay.classList.add("hidden");
    zenOverlay.setAttribute("aria-hidden", "true");
    appShell.removeAttribute("aria-hidden");
    if (state.zenPhaseTimer) clearInterval(state.zenPhaseTimer);
    if (state.zenClockTimer) clearInterval(state.zenClockTimer);
    state.zenPhaseTimer = null;
    state.zenClockTimer = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
  }

  function updateZenClock() {
    zenClock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function updateZenStage() {
    const elapsed = ((Date.now() - state.zenStartedAt) % 19000) / 1000;
    let phase = "Inhale · 4";
    if (elapsed < 4) phase = `Inhale · ${Math.ceil(4 - elapsed)}`;
    else if (elapsed < 11) phase = `Hold · ${Math.ceil(11 - elapsed)}`;
    else phase = `Exhale · ${Math.ceil(19 - elapsed)}`;
    breathPhase.textContent = phase;
    if (state.sequence.length) zenStage.textContent = state.sequence[state.currentStage]?.name || "Breathe";
    else zenStage.textContent = "Breathe";
  }

  async function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      $("installBtn").hidden = false;
    });
    $("installBtn").addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      $("installBtn").hidden = true;
    });
  }

  function initConsent() {
    const current = localStorage.getItem(CONSENT_KEY);
    if (!current) gdprBanner.classList.remove("hidden");
    $("gdprAccept").addEventListener("click", async () => {
      localStorage.setItem(CONSENT_KEY, "granted");
      gdprBanner.classList.add("hidden");
      await loadCustomAudio();
      await refreshSavedRoutines();
      await refreshAnalytics();
    });
    $("gdprDecline").addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "temporary");
      gdprBanner.classList.add("hidden");
      refreshAnalytics();
    });
    $("manageConsentBtn").addEventListener("click", () => gdprBanner.classList.remove("hidden"));
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    notifyBtn.textContent = permission === "granted" ? "✓ OS notifications enabled" : "Notifications blocked";
  }

  function setupEvents() {
    startBtn.addEventListener("click", startTimer);
    pauseBtn.addEventListener("click", pauseTimer);
    resetBtn.addEventListener("click", () => resetTimer());
    hoursInput.addEventListener("change", () => {
      state.sequence = [];
      syncTimerPreview();
      resetTimer(false);
    });
    minutesInput.addEventListener("change", () => {
      state.sequence = [];
      syncTimerPreview();
      resetTimer(false);
    });
    [chimeToggle, voiceToggle, ambientSelect, intervalToggle, intervalMinutes, visualAlarmToggle].forEach((el) => {
      el.addEventListener("change", () => {
        if (el === ambientSelect && state.running) startAmbient();
        if (el === intervalMinutes && state.running) state.intervalNextMs = Number(intervalMinutes.value)*60000;
      });
    });

    document.querySelectorAll(".btn-preset").forEach((button) => {
      button.addEventListener("click", () => {
        state.sequence = [];
        hoursInput.value = 0;
        minutesInput.value = button.dataset.mins;
        resetTimer(false);
      });
    });

    $("addBlockBtn").addEventListener("click", addRoutineBlock);
    [blockName, blockMinutes, blockSeconds].forEach((el) => el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addRoutineBlock();
    }));
    routineTemplate.addEventListener("change", () => applyTemplate(routineTemplate.value));
    routineLoops.addEventListener("change", () => {
      state.loops = Math.max(1, Math.min(12, Number.parseInt(routineLoops.value, 10) || 1));
      renderRoutine();
    });
    $("saveRoutineBtn").addEventListener("click", saveRoutine);
    $("clearRoutineBtn").addEventListener("click", () => { state.sequence = []; state.loops = 1; routineLoops.value = 1; renderRoutine(); });
    savedRoutineSelect.addEventListener("change", () => loadSavedRoutine(savedRoutineSelect.value));
    $("deleteRoutineBtn").addEventListener("click", deleteSavedRoutine);

    routineList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const i = Number(button.dataset.index);
      const action = button.dataset.action;
      if (action === "delete") state.sequence.splice(i,1);
      if (action === "up" && i > 0) [state.sequence[i-1], state.sequence[i]] = [state.sequence[i], state.sequence[i-1]];
      if (action === "down" && i < state.sequence.length - 1) [state.sequence[i+1], state.sequence[i]] = [state.sequence[i], state.sequence[i+1]];
      renderRoutine();
    });

    notifyBtn.addEventListener("click", requestNotifications);

    $("exportMarkdownBtn").addEventListener("click", () => exportSessions("md"));
    $("exportCsvBtn").addEventListener("click", () => exportSessions("csv"));
    $("clearAnalyticsBtn").addEventListener("click", async () => {
      if (!confirm("Delete all stored session history and streak data on this device?")) return;
      await clearStore("sessions");
      await clearStore("stats");
      await refreshAnalytics();
    });

    $("saveReflectionBtn").addEventListener("click", () => saveReflection(true));
    $("skipReflectionBtn").addEventListener("click", () => saveReflection(false));
    $("closeReflectionBtn").addEventListener("click", () => saveReflection(true));

    $("browseAudioBtn").addEventListener("click", () => audioFileInput.click());
    audioFileInput.addEventListener("change", () => handleAudioFile(audioFileInput.files?.[0]));
    dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault(); dropZone.classList.remove("dragover"); handleAudioFile(event.dataTransfer.files?.[0]);
    });
    dropZone.addEventListener("keydown", (event) => { if (event.key === "Enter") audioFileInput.click(); });
    previewAudioBtn.addEventListener("click", () => { customAudio.currentTime = 0; customAudio.play().catch(() => {}); });
    deleteAudioBtn.addEventListener("click", removeCustomAudio);

    $("zenBtn").addEventListener("click", enterZenMode);
    $("zenExitBtn").addEventListener("click", exitZenMode);
    $("dismissVisualBtn").addEventListener("click", clearVisualAlarm);

    document.addEventListener("keydown", (event) => {
      if (event.target.matches("input, textarea, select")) return;
      if (!reflectionModal.classList.contains("hidden") && event.key === "Escape") {
        saveReflection(true);
        return;
      }
      if (!zenOverlay.classList.contains("hidden") && event.key === "Escape") {
        exitZenMode();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        state.running ? pauseTimer() : startTimer();
      } else if (event.key.toLowerCase() === "r") {
        resetTimer();
      } else if (/^[1-6]$/.test(event.key)) {
        const button = document.querySelector(`.btn-preset:nth-child(${Number(event.key)})`);
        if (button) button.click();
      } else if (event.key === "Escape") {
        enterZenMode();
      }
    });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "hidden") {
        state.wakeLock = null;
      } else if (document.visibilityState === "visible" && state.running) {
        state.wakeLock = null;
        await requestWakeLock();
      }
    });
  }

  async function boot() {
    ensureWorker();
    setupEvents();
    setupInstallPrompt();
    initConsent();
    renderRoutine();
    syncTimerPreview();
    await loadCustomAudio();
    await refreshSavedRoutines();
    await refreshAnalytics();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((error) => console.warn("SW registration failed", error));
    }
  }

  boot();
})();
