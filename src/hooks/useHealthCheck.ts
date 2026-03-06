import { useEffect, useRef, useState } from "react";

interface HealthStatus {
  status: "connected" | "disconnected" | "checking";
  lastChecked: Date | null;
  uptime: number | null;
}

const POLL_INTERVAL = 30_000; // 30 seconds

export function useHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({
    status: "checking",
    lastChecked: null,
    uptime: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error("not ok");
        const data = await res.json();
        if (!cancelled) {
          setHealth({ status: "connected", lastChecked: new Date(), uptime: data.uptime ?? null });
        }
      } catch {
        if (!cancelled) {
          setHealth((prev) => ({ ...prev, status: "disconnected", lastChecked: new Date() }));
        }
      }
    };

    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return health;
}
