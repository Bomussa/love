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

const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })));
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })));
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

export default function App(){
 const [doctorSession,setDoctorSession]=useState(()=>{try{const s=localStorage.getItem('mmc_doctor_session');return s?JSON.parse(s):null;}catch{return null;}});
 const [clinicSession,setClinicSession]=useState(()=>{try{const s=localStorage.getItem('mmc_clinic_session');return s?JSON.parse(s):null;}catch{return null;}});
 const [patientData,setPatientData]=useState(()=>{try{const s=localStorage.getItem('patientData');return normalizePatientRecord(s?JSON.parse(s):null);}catch{return null;}});
 const [isAdmin,setIsAdmin]=useState(()=>{try{const s=localStorage.getItem('mmc_admin_session'); if(s){const p=JSON.parse(s); return new Date(p.expiresAt)>new Date();}}catch{} return false;});
 const [currentView,setCurrentView]=useState('login');
 const [currentTheme,setCurrentTheme]=useState(()=>localStorage.getItem('selectedTheme')||'medical-professional');
 const [language,setLanguage]=useState(getCurrentLanguage());

 useEffect(()=>{
  autoRepairSystem.startMonitoring(); functionTableMonitor.startMonitoring(); elementMonitor.startMonitoring();
  new AdvancedAutoRepair(supabase).startAutoRepair(); healthMonitor.init(supabase); new InteractiveElementReporter().startReporting();
 },[]);

 useEffect(()=>{
  setCurrentLanguage(language);
  const path=window.location.pathname;
  if(path==='/admin'||path.startsWith('/admin/')) return setCurrentView(isAdmin?'admin':'login');
  if(isAdmin) return setCurrentView('admin');
  if(patientData) return setCurrentView(patientData.queueType||patientData.examType?'patient':'examSelection');
  if(path==='/doctor'||path.startsWith('/doctor/')) return setCurrentView(doctorSession?'doctor':'login');
  if(path==='/clinic/login'||path==='/clinic/login/') return setCurrentView('clinic_login');
  if(path.match(/\/clinic\/[^/]+\/display$/)) return setCurrentView('display');
  if(path.startsWith('/clinic/')) return setCurrentView(clinicSession?'clinic_dashboard':'clinic_login');
  if(path.includes('/qr')) return setCurrentView('qrscan');
  setCurrentView('login');
 },[language,isAdmin,patientData,clinicSession,doctorSession]);

 useEffect(()=>{
  const theme=enhancedMedicalThemes.find(t=>t.id===currentTheme); if(!theme) return;
  const css=generateThemeCSS(currentTheme); const old=document.getElementById('enhanced-theme-style'); if(old) old.remove();
  const style=document.createElement('style'); style.id='enhanced-theme-style'; style.textContent=css; document.head.appendChild(style);
  localStorage.setItem('selectedTheme',currentTheme);
 },[currentTheme]);

 const notify=(msg)=>console.log(msg);

 const handleLogin=async({patientId,gender})=>{
  try{
   const restrict=await getSystemSetting('device_restriction_enabled',false);
   if(restrict){const chk=await checkDeviceLogin(patientId); if(!chk.allowed) return notify('device blocked');}
   const res=await api.patientLogin(patientId,gender);
   if(!res.success) return notify('login failed');
   await registerDeviceLogin(patientId);
   await logDailyActivity('patient_login',{patientId,gender,performedBy:patientId});
   localStorage.removeItem('mmc_admin_session'); localStorage.removeItem('mmc_doctor_session');
   setIsAdmin(false); setDoctorSession(null);
   const normalized=normalizePatientRecord(res.data,patientId);
   setPatientData(normalized); localStorage.setItem('patientData',JSON.stringify(normalized));
   setCurrentView('examSelection');
  }catch(e){console.error(e);}
 };

 const handleAdminLogin=async(credentials)=>{
  try{ const [u,p]=credentials.split(':'); const r=await authService.login(u,p); if(r.success){setIsAdmin(true);setCurrentView('admin'); localStorage.removeItem('patientData'); setPatientData(null);} }catch(e){console.error(e);}
 };

 const handleDoctorLogin=async(credentials)=>{
  try{
   const [u,p]=credentials.split(':'); const r=await api.doctorLogin(u,p); if(!r.success||!r.data) return;
   const s={id:r.data.id,name:r.data.name,clinic_id:r.data.clinic_id,clinic_name:r.data.clinic_name||r.data.clinic_id,role:r.data.role||'DOCTOR',expiresAt:new Date(Date.now()+86400000).toISOString()};
   localStorage.setItem('mmc_doctor_session',JSON.stringify(s)); setDoctorSession(s); setCurrentView('doctor');
  }catch(e){console.error(e);}
 };

 const handleLogout=()=>{
  setPatientData(null);setIsAdmin(false);setDoctorSession(null);setCurrentView('login');
  localStorage.removeItem('patientData');localStorage.removeItem('mmc_admin_session');localStorage.removeItem('mmc_doctor_session');
  window.history.pushState({},'', '/');
 };

 const handleExamSelect=async(examType)=>{
  try{
   const clinics=await getDynamicMedicalPathway(examType,patientData?.gender||'male');
   if(!clinics?.length) throw new Error('No clinics');
   const patientId=patientData?.patient_id||patientData?.personal_id||patientData?.id;
   const firstClinic=clinics[0];
   const enter=await api.enterQueue(firstClinic.id,patientId,false,patientData?.name||patientId,examType,patientData?.gender||'male',patientData?.military_id||null,patientData?.personal_id||patientId);
   try{await api.createRoute(patientId,examType,patientData?.gender||'male',clinics);}catch(e){console.warn(e);}
   const updated=normalizePatientRecord({...patientData,queueType:examType,examType,currentClinic:firstClinic.id,pathway:clinics,queueNumber:enter?.display_number||null,queueId:enter?.id||null},patientId);
   setPatientData(updated); localStorage.setItem('patientData',JSON.stringify(updated)); setCurrentView('patient');
  }catch(e){console.error(e);}
 };

 const toggleLanguage=()=>{const l=language==='ar'?'en':'ar'; setLanguage(l); setCurrentLanguage(l);};

 return (
 <div className='min-h-screen w-full'>
  <main className='relative z-10 w-full'>
   {currentView==='qrscan' && <Suspense fallback={<LoadingFallback/>}><QrScanPage language={language} toggleLanguage={toggleLanguage}/></Suspense>}
   {currentView==='login' && <LoginPage onLogin={handleLogin} onAdminLogin={handleAdminLogin} onDoctorLogin={handleDoctorLogin} currentTheme={currentTheme} onThemeChange={setCurrentTheme} language={language} toggleLanguage={toggleLanguage}/>}
   {currentView==='examSelection'&&patientData && <ExamSelectionPage patientData={patientData} onExamSelect={handleExamSelect} onBack={handleLogout} language={language} toggleLanguage={toggleLanguage}/>}
   {currentView==='patient'&&patientData && <PatientPage patientData={patientData} onLogout={handleLogout} language={language} toggleLanguage={toggleLanguage}/>}
   {currentView==='admin'&&isAdmin && (
     <div data-view='admin' className='admin-dashboard-shell w-full min-h-screen'>
       <Suspense fallback={<LoadingFallback/>}>
         <HealthAlertBanner language={language}/>
         <AdminErrorBoundary>
           <AdminDashboardV2 onLogout={handleLogout} language={language} toggleLanguage={toggleLanguage} currentTheme={currentTheme} onThemeChange={setCurrentTheme}/>
         </AdminErrorBoundary>
       </Suspense>
     </div>
   )}
   {currentView==='doctor'&&doctorSession && <Suspense fallback={<LoadingFallback/>}><DoctorDashboard doctorData={doctorSession} onLogout={()=>{setDoctorSession(null);localStorage.removeItem('mmc_doctor_session');setCurrentView('login');}} language={language} toggleLanguage={toggleLanguage}/></Suspense>}
   {currentView==='clinic_login' && <ClinicLoginPage onLogin={(s)=>{setClinicSession(s);localStorage.setItem('mmc_clinic_session',JSON.stringify(s));setCurrentView('clinic_dashboard');}} language={language} toggleLanguage={toggleLanguage}/>}
   {currentView==='clinic_dashboard'&&clinicSession && <Suspense fallback={<LoadingFallback/>}><ClinicDashboard session={clinicSession} onLogout={()=>{setClinicSession(null);localStorage.removeItem('mmc_clinic_session');setCurrentView('clinic_login');}} language={language} toggleLanguage={toggleLanguage}/></Suspense>}
   {currentView==='display' && <Suspense fallback={<LoadingFallback/>}><DisplayPage language={language}/></Suspense>}
  </main>
  <SpeedInsights/><Analytics/>
 </div>
 );
}
