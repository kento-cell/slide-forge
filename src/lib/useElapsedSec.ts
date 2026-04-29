import { useEffect, useState } from "react";

/** Returns the seconds elapsed since `running` flipped from false → true.
 *
 * Re-renders ~5x per second while running. Returns 0 when running
 * is false. Lightweight: no refs, no Date.now() during render — the
 * state is updated entirely from inside an interval callback so the
 * React 19 purity / refs-during-render rules pass.
 */
export function useElapsedSec(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    // Tick fast enough that the first second is felt immediately,
    // but not so fast we burn CPU. 200ms = perceived live counter.
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  // When not running, hide whatever stale value `elapsed` carries
  // from the previous run. Cheaper than resetting state via setState.
  return running ? elapsed : 0;
}

/** Format seconds as "23秒" / "1分05秒". */
export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s.toString().padStart(2, "0")}秒` : `${s}秒`;
}
