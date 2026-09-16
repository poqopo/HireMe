const defaultForceKillAfterMs = 2_500;

/**
 * Keep renderer-owned child processes cancellable without accidentally killing
 * a later run that reuses an id after the earlier run exits.
 */
export function createActiveRunRegistry({
  forceKillAfterMs = defaultForceKillAfterMs,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const runs = new Map();

  function register(runIdValue, record = {}) {
    const runId = String(runIdValue || "");
    if (!runId) throw new Error("A run id is required.");
    if (runs.has(runId)) throw new Error("A run with this id is already active.");
    const active = {
      ...record,
      runId,
      cancelReason: null,
      cancelRequested: false,
      forceKillTimer: null,
    };
    runs.set(runId, active);
    return active;
  }

  function release(runIdValue, expectedRecord) {
    const runId = String(runIdValue || "");
    const active = runs.get(runId);
    if (!active || (expectedRecord && active !== expectedRecord)) return false;
    if (active.forceKillTimer !== null) clearTimer(active.forceKillTimer);
    runs.delete(runId);
    return true;
  }

  function cancel(runIdValue, reason = "cancelled") {
    const runId = String(runIdValue || "");
    const active = runs.get(runId);
    if (!active) return false;
    active.cancelReason ||= String(reason || "cancelled");
    if (active.cancelRequested) return true;
    active.cancelRequested = true;
    try {
      active.child?.kill?.("SIGTERM");
    } catch {
      // The child may have exited between lookup and cancellation.
    }
    const expectedRecord = active;
    active.forceKillTimer = setTimer(() => {
      if (runs.get(runId) !== expectedRecord) return;
      try {
        expectedRecord.child?.kill?.("SIGKILL");
      } catch {
        // The process may have exited naturally after SIGTERM.
      }
    }, forceKillAfterMs);
    active.forceKillTimer?.unref?.();
    return true;
  }

  function cancelMatching(predicate, reason) {
    const cancelled = [];
    for (const [runId, active] of runs) {
      if (!predicate(active, runId)) continue;
      if (cancel(runId, reason)) cancelled.push(active);
    }
    return cancelled;
  }

  return {
    has: (runId) => runs.has(String(runId || "")),
    get: (runId) => runs.get(String(runId || "")),
    values: () => runs.values(),
    register,
    release,
    cancel,
    cancelMatching,
  };
}
