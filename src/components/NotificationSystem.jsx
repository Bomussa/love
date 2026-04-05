import { useEffect } from 'react';
import eventBus from '../core/event-bus';

export default function NotificationSystem({ yourNumber, language = 'ar' }) {
  useEffect(() => {
    if (yourNumber === 2) {
      eventBus.emit('queue:near_turn', { type: 'NEAR_TURN', yourNumber });
    } else if (yourNumber === 1) {
      eventBus.emit('queue:step_done_next', { type: 'STEP_DONE_NEXT', yourNumber });
    } else if (yourNumber === 0) {
      eventBus.emit('queue:your_turn', { type: 'YOUR_TURN', yourNumber });
    }
  }, [yourNumber]);

  return <div className="sr-only" aria-live="polite">{language === 'ar' ? 'نظام التنبيهات يعمل' : 'Notification system active'}</div>;
}
