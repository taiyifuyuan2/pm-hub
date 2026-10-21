import { useEffect, useState } from "react";
import type { HealthResponse } from "../../shared/agent";
import { fetchHealth } from "./agentClient";

const POLL_INTERVAL_MS = 5000;

/** ローカルサーバーの状態を定期的に確認する。到達できなければ null */
export function useServerHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let controller = new AbortController();
    const check = () => {
      controller.abort();
      const current = (controller = new AbortController());
      fetchHealth(current.signal)
        .then(setHealth)
        .catch(() => {
          if (!current.signal.aborted) setHealth(null);
        });
    };
    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  return health;
}
