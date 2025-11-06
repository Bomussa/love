// 🧠 Unified Update Logic — Stable Version
// Hook موحد لإدارة التحديثات عبر SSE أو Polling

import { useEffect, useRef } from "react";

export default function useSmartUpdater({ url, onData, interval = 60000, useSSE = true }) {
  const eventSourceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (useSSE) {
      // ✅ بث مباشر عبر SSE فقط
      const es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onData(data);
        } catch (_) {}
      };
      eventSourceRef.current = es;
    } else {
      // 🕒 Polling خفيف للصفحات غير الحرجة
      const poll = async () => {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) onData(await res.json());
        } catch (_) {}
      };
      poll();
      timerRef.current = setInterval(poll, interval);
    }

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [url, onData, interval, useSSE]);
}

