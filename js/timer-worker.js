let timerInterval = null;
let targetTime = 0;
let remainingMs = 0;
let sequence = [];
let loopCount = 1;
let stageIndex = 0;
let loopIndex = 1;
let totalElapsedMs = 0;
let totalCycleMs = 0;

function stopInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function currentStageDuration() {
  return sequence[stageIndex]?.durationMs || 0;
}

function emitTick() {
  const stageDuration = currentStageDuration();
  const stageElapsed = Math.max(0, stageDuration - remainingMs);
  self.postMessage({
    type: "tick",
    remaining: Math.max(0, remainingMs),
    stageIndex,
    loopIndex,
    loopCount,
    stageDuration,
    totalElapsed: Math.min(totalCycleMs * loopCount, totalElapsedMs + stageElapsed)
  });
}

function startOrResume() {
  if (!sequence.length) return;
  if (!remainingMs) remainingMs = currentStageDuration();

  targetTime = Date.now() + remainingMs;
  stopInterval();

  timerInterval = setInterval(() => {
    const remaining = targetTime - Date.now();
    if (remaining > 0) {
      remainingMs = remaining;
      emitTick();
      return;
    }

    totalElapsedMs += currentStageDuration();

    if (stageIndex < sequence.length - 1) {
      stageIndex += 1;
      remainingMs = currentStageDuration();
      targetTime = Date.now() + remainingMs;
      self.postMessage({
        type: "stage",
        stageIndex,
        loopIndex,
        loopCount,
        remaining: remainingMs,
        stageDuration: currentStageDuration(),
        totalElapsed: totalElapsedMs
      });
      return;
    }

    if (loopIndex < loopCount) {
      loopIndex += 1;
      stageIndex = 0;
      remainingMs = currentStageDuration();
      targetTime = Date.now() + remainingMs;
      self.postMessage({
        type: "stage",
        stageIndex,
        loopIndex,
        loopCount,
        remaining: remainingMs,
        stageDuration: currentStageDuration(),
        totalElapsed: totalElapsedMs
      });
      return;
    }

    stopInterval();
    remainingMs = 0;
    self.postMessage({ type: "complete" });
  }, 200);

  emitTick();
}

self.onmessage = (event) => {
  const { action } = event.data;

  if (action === "start") {
    if (Array.isArray(event.data.sequence) && event.data.sequence.length) {
      sequence = event.data.sequence.map((item) => ({
        name: String(item.name),
        durationMs: Math.max(1000, Number(item.durationMs) || 0)
      }));
      loopCount = Math.max(1, Math.min(12, Number(event.data.loopCount) || 1));
      totalCycleMs = sequence.reduce((sum, item) => sum + item.durationMs, 0);
      if (!remainingMs || stageIndex >= sequence.length) {
        stageIndex = 0;
        loopIndex = 1;
        totalElapsedMs = 0;
        remainingMs = 0;
      }
    }
    startOrResume();
  }

  if (action === "pause") {
    stopInterval();
    remainingMs = Math.max(0, targetTime ? targetTime - Date.now() : remainingMs);
    self.postMessage({
      type: "paused",
      remaining: remainingMs,
      stageIndex,
      loopIndex,
      loopCount
    });
  }

  if (action === "reset") {
    stopInterval();
    targetTime = 0;
    remainingMs = 0;
    sequence = [];
    loopCount = 1;
    stageIndex = 0;
    loopIndex = 1;
    totalElapsedMs = 0;
    totalCycleMs = 0;
    self.postMessage({ type: "reset" });
  }
};
