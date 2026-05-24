import InteractiveElementReporter from './lib/interactive-element-reporter';
import healthMonitor from './lib/app-health-monitor';
import HealthAlertBanner from './components/HealthAlertBanner';
import AdvancedAutoRepair from './lib/advanced-auto-repair';
import { supabase, checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import api from './lib/api-unified';
import authService from './lib/auth-service';
import getDynamicMedicalPathway from './lib/dynamic-pathways';
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes';
import { getCurrentLanguage, setCurrentLanguage } from './lib/i18n';
import { autoRepairSystem } from './lib/auto-repair-system';
import { functionTableMonitor } from './lib/function-table-monitor';
import { elementMonitor } from './lib/element-monitor';
import { installAdminAuditSystem, logAdminEvent } from './lib/admin-audit';
import CleanupApprovalPanel from './components/CleanupApprovalPanel';

installAdminAuditSystem();

const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })));
const PatientPage = lazy(() => import('./components/PatientPageStable.jsx').then(m => ({ default: m.PatientPageStable })));
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })));
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })));
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })));
const ClinicDashboard = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const ClinicLoginPage = lazy(() => import('./components/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })));

const LoadingFallback = () => (
<div className='min-h-screen flex items-center justify-center bg-gray-900'>
<div className='text-center'><div className='animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4'/><p className='text-white'>جارٍ التحميل...</p></div>
</div>
);

function normalizePatientRecord(record, fallbackId=null){
 if(!record) return null;
 const resolved = record.id || record.patient_id || record.personal_id || fallbackId;
 return {
  ...record,
  id: resolved,
  patient_id: record.patient_id || resolved,
  personal_id: record.personal_id || record.patient_id || resolved,
 };
}

class AdminErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={hasError:false,error:null};}
 static getDerivedStateFromError(error){return {hasError:true,error};}
 componentDidCatch(error,info){console.error('[AdminErrorBoundary]',error,info);}
 render(){ if(this.state.hasError){ return <div className='min-h-screen bg-red-900 text-white p-8'><h1>AdminPage Error</h1><button onClick={()=>this.setState({hasError:false})}>Retry</button></div>; } return this.props.children; }
}

function installGlobalErrorHandlers(){
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL_ERROR]', e?.message || e);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED_REJECTION]', e?.reason || e);
  });
}

function verifyUIIntegrity(){
  try{
    const hasRoot = !!document.querySelector('#root');
    if(!hasRoot) console.error('[UI_CHECK] root missing');

    const hasAnyButton = !!document.querySelector('button');
    if(!hasAnyButton) console.error('[UI_CHECK] no buttons detected');

    const isClinic = window.location.pathname.startsWith('/clinic');
    if(isClinic){
      const select = document.querySelector('select');
      if(!select) console.warn('[UI_CHECK] clinic select missing');
    }
  }catch(e){ console.error('[UI_CHECK_ERROR]', e); }
}

function getUserFacingError(raw, language, fallbackAr, fallbackEn) {
  const text = String(raw?.message || raw?.error || raw?.code || raw || '').toLowerCase();
  if (text.includes('invalid') || text.includes('wrong') || text.includes('incorrect') || text.includes('password') || text.includes('credential')) {
    return language === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials';
  }
  if (text.includes('device') || text.includes('already used') || text.includes('already logged') || text.includes('different number') || text.includes('same device')) {
    return language === 'ar' ? 'هذا الجهاز مستخدم برقم آخر اليوم' : 'This device is already linked to another patient today';
  }
  if (text.includes('clinic') || text.includes('lab') || text.includes('other clinic') || text.includes('another clinic') || text.includes('active_clinic_id')) {
    return language === 'ar' ? 'لا يمكن الدخول لأن الحساب مرتبط بعيادة أخرى' : 'This account is already assigned to another clinic';
  }
  if (text.includes('connection') || text.includes('network') || text.includes('timeout') || text.includes('fetch')) {
    return language === 'ar' ? 'خطأ في الاتصال' : 'Connection error';
  }
  return language === 'ar' ? fallbackAr : fallbackEn;
}

export default function App(){
 const [doctorSession,setDoctorSession]=useState(()=>{try{const s=localStorage.getItem('mmc_doctor_session');return s?JSON.parse(s):null;}catch{return null;}});
 const [clinicSession,setClinicSession]=useState(()=>{try{const s=localStorage.getItem('mmc_clinic_session');return s?JSON.parse(s):null;}catch{return null;}});
 const [patientData,setPatientData]=useState(()=>{try{const s=localStorage.getItem('patientData');return normalizePatientRecord(s?JSON.parse(s):null);}catch{return null;}});
 const [isAdmin,setIsAdmin]=useState(()=>{try{const s=localStorage.getItem('mmc_admin_session'); if(s){const p=JSON.parse(s); return new Date(p.expiresAt)>new Date();}}catch{} return false;});
 const [currentView,setCurrentView]=useState('login');
 const [currentTheme,setCurrentTheme]=useState(()=>localStorage.getItem('selectedTheme')||'medical-professional');
 const [language,setLanguage]=useState(getCurrentLanguage());

 useEffect(()=>{
  installGlobalErrorHandlers();
  autoRepairSystem.startMonitoring(); functionTableMonitor.startMonitoring(); elementMonitor.startMonitoring();
  new AdvancedAutoRepair(supabase).startAutoRepair(); healthMonitor.init(supabase); new InteractiveElementReporter().startReporting();
  setTimeout(verifyUIIntegrity, 1000);
 },[]);

 return <Suspense fallback={<LoadingFallback />}><PatientPage patientData={patientData} onLogout={()=>setCurrentView('login')} language={language} toggleLanguage={()=>setLanguage(language==='ar'?'en':'ar')} /></Suspense>;
}
