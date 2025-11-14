// === Real-time UI Toasts for Queue Events (Safe Dynamic Import) ===
import eventBus from './event-bus.js';
import soundService from '../lib/sound-service';

let toast;
(async () => {
  try {
    const { toast: importedToast } = await import('react-hot-toast');
    toast = importedToast;
  } catch (err) {
    toast = {
      success: (msg) => console.log('[Toast ✅]', msg),
      error: (msg) => console.log('[Toast ❌]', msg),
      loading: (msg) => console.info('[Toast ⏳]', msg),
    };

  }

  // Real-time listeners for frontend notifications
  eventBus.on('queue:near_turn', (data) => {
    toast.success(`يقترب دورك في ${data?.clinicName || 'العيادة'}`);
    soundService.playSound();
  });

  eventBus.on('queue:your_turn', (data) => {
    toast.loading(`الآن دورك في ${data?.clinicName || 'العيادة'}`);
    if (navigator.vibrate) navigator.vibrate(200);
    soundService.playSound();
  });

  eventBus.on('queue:step_done', (data) => {
    toast.success(
      data?.nextClinic
        ? `تم إنهاء الفحص، توجه إلى ${data.nextClinic}`
        : `تم إنهاء الفحص، انتظر التعليمات`
    );
    soundService.playSound();
  });

  // Manual test helper
  window.testNotify = () => {
    toast.success('🔔 اختبار إشعار ناجح!');
    if (navigator.vibrate) navigator.vibrate(100);
    soundService.playSound();
  };
})();
