// 🧠 Unified Update Logic — Stable Version
// Hook موحد لإدارة التحديثات عبر SSE أو Polling

import { useEffect, useRef } from "react";
import eventBus from "../core/event-bus";

export default function useSmartUpdater({ url, onData, interval = 60000, useSSE = true }) {
  const eventSourceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (useSSE) {
      // ✅ استخدم ناقل الأحداث المركزي بدلاً من فتح اتصال SSE جديد
      const unsub1 = eventBus.on('queue:update', (d) => onData && onData(d));
      const unsub2 = eventBus.on('queue:call', (d) => onData && onData(d));
      const unsub3 = eventBus.on('notice', (d) => onData && onData(d));
      const unsub4 = eventBus.on('stats:update', (d) => onData && onData(d));
      eventSourceRef.current = { close: () => { unsub1(); unsub2(); unsub3(); unsub4(); } };
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

