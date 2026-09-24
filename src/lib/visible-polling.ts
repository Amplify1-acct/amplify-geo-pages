/** Poll only while visible, never overlap requests, and back off after failures. */
export function startVisiblePolling(task: () => Promise<boolean | void>, intervalMs = 60_000) {
  let stopped = false;
  let running = false;
  let nextAt = 0;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    clearTimeout(timer);
    if (stopped || running || document.visibilityState !== "visible") return;
    timer = setTimeout(() => void run(), Math.max(0, nextAt - Date.now()));
  }

  async function run() {
    if (stopped || running || document.visibilityState !== "visible") return;
    running = true;
    try {
      failures = (await task()) === false ? failures + 1 : 0;
    } catch {
      failures += 1;
    } finally {
      running = false;
      if (failures >= 3) stopped = true;
      nextAt = Date.now() + (failures ? 300_000 : intervalMs);
      schedule();
    }
  }

  document.addEventListener("visibilitychange", schedule);
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", schedule);
  };
}
