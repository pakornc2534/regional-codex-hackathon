const quietTailMs = 650;

export function createReadyMicGate(onPause: (paused: boolean) => void) {
  let agentBusy = false;
  let paused = false;
  let until = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function update() {
    clearTimeout(timer);
    const remaining = until - Date.now();
    const next = agentBusy || remaining > 0;
    if (paused !== next) {
      paused = next;
      onPause(next);
    }
    if (!agentBusy && remaining > 0) timer = setTimeout(update, remaining);
  }

  return {
    isPaused: () => paused,
    agentBusy(value: boolean) {
      if (agentBusy === value) return;
      agentBusy = value;
      if (!value) until = Math.max(until, Date.now() + quietTailMs);
      update();
    },
    audio() {
      until = Date.now() + quietTailMs;
      update();
    },
    close() { clearTimeout(timer); },
  };
}
