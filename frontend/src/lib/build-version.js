/**
 * MMC-MMS Build Version
 * v5.0.0 — 2026-04-20
 *
 * الإصلاحات المُدمجة في هذا الإصدار:
 *
 * 1. DoctorControl: أعمدة حقيقية (patient_id/gender)، توقيت قطر،
 *    finish_exam_record RPC، StatusBadge يغطي كل الحالات
 *
 * 2. api-unified.js: doctorLogin يستخدم doctor_login RPC (case-insensitive)،
 *    enterQueue يُرسل gender/military_id/personal_id، توقيت قطر في كل queries
 *
 * 3. DoctorDashboard: start_exam_record + finish_exam_record RPCs،
 *    ABSENT يُسجَّل في exam_records، توقيت قطر
 *
 *
 * 5. App.jsx: enterQueue يُرسل gender المراجع الفعلي
 *
 * 6. SmartDiagnosticsPanel: يستخدم run_smart_health_check() و run_smart_auto_repair() RPCs
 *
 * 7. love-api/master: 19 endpoint صحيح، doctor_login، exam_records، get_clinic_stats
 */
export const BUILD_VERSION = '5.0.0';
export const BUILD_DATE    = '2026-04-20';
