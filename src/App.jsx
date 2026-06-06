import './lib/session-sanity.js';

if (typeof document !== 'undefined' && !document.getElementById('mmc-patient-page-overrides')) {
  const style = document.createElement('style');
  style.id = 'mmc-patient-page-overrides';
  style.textContent = `
    [data-test="patient-page"] > div.w-full.max-w-2xl.mx-auto.space-y-5 {
      max-width: min(96vw, 72rem) !important;
    }

    [data-test="patient-page"] > div.w-full.max-w-2xl.mx-auto.space-y-5 .text-center.space-y-2.pt-4 h1 {
      font-size: clamp(1.35rem, 2.2vw, 2rem) !important;
      line-height: 1.25 !important;
    }

    [data-test="patient-page"] > div.w-full.max-w-2xl.mx-auto.space-y-5 .text-center.space-y-2.pt-4 p.text-sm {
      font-size: 0.98rem !important;
      line-height: 1.5 !important;
    }

    [data-test="patient-page"] .fixed.top-4.right-4.z-50.max-w-sm,
    [data-test="patient-page"] .fixed.top-4.left-4.z-50.space-y-2.max-w-sm {
      max-width: min(92vw, 34rem) !important;
    }

    [data-test="patient-page"] .fixed.top-4.right-4.z-50.max-w-sm.rounded-2xl.border.border-white\\/10.bg-\\[\\#111827\\]\\/95.p-4.shadow-2xl.backdrop-blur,
    [data-test="patient-page"] .bg-\\[\\#0f172a\\]\\/70.border.border-blue-500\\/20.rounded-2xl.p-4.shadow-lg {
      display: none !important;
    }

    [data-test="patient-page"] .fixed.top-4.right-4.z-50.max-w-sm .text-sm,
    [data-test="patient-page"] .fixed.top-4.left-4.z-50.space-y-2.max-w-sm p {
      font-size: 1rem !important;
      line-height: 1.6 !important;
    }

    [data-test="patient-page"] h3.text-white.text-base.font-bold.leading-tight {
      font-size: 1.15rem !important;
      line-height: 1.45 !important;
    }

    [data-test="patient-page"] .grid.grid-cols-2 .text-4xl {
      font-size: clamp(2rem, 6vw, 3.2rem) !important;
    }

    [data-test="patient-page"] .bg-gray-800\\/50.border-gray-700.shadow-xl {
      max-width: 100% !important;
    }

    [data-test="patient-page"] .w-full.max-w-2xl.mx-auto.space-y-5 {
      gap: 1.25rem !important;
    }
  `;
  document.head.appendChild(style);
}

export { default } from '../frontend/src/App.jsx';
