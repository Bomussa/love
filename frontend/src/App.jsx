import InteractiveElementReporter from './lib/interactive-element-reporter';
import healthMonitor from './lib/app-health-monitor';
import HealthAlertBanner from './components/HealthAlertBanner';
import AdvancedAutoRepair from './lib/advanced-auto-repair';
import { supabase, checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import api from './lib/api-unified'
import authService from './lib/auth-service'
import getDynamicMedicalPathway from './lib/dynamic-pathways'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'
import { autoRepairSystem } from './lib/auto-repair-system'
import { functionTableMonitor } from './lib/function-table-monitor'
import { elementMonitor } from './lib/element-monitor'

const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })))
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })))
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })))
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })))
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })))
const ClinicDashboard = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })))
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })))
const ClinicLoginPage = lazy(() => import('./components/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })))

const preloadComponents = () => {
  import('./components/LoginPage.jsx');
  import('./components/PatientPage.jsx');
};
if (typeof window !== 'undefined') window.addEventListener('load', preloadComponents, { once: true });

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
)

class AdminErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[AdminErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-red-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">AdminPage Error</h1>
        <p>{this.state.error?.message}</p>
        <button onClick={() => this.setState({ hasError:false })} className="mt-4 px-4 py-2 bg-white text-red-900 rounded">إعادة المحاولة</button>
      </div>
    );
    return this.props.children;
  }
}

function App() {
  const [doctorSession, setDoctorSession] = useState(() => { try { const s=localStorage.getItem('mmc_doctor_session'); return s?JSON.parse(s):null; } catch{return null;} });
  const [clinicSession, setClinicSession] = useState(() => { try { const s=localStorage.getItem('mmc_clinic_session'); return s?JSON.parse(s):null; } catch{return null;} });
  const [patientData, setPatientData] = useState(() => { try { const s=localStorage.getItem('patientData'); return s?JSON.parse(s):null; } catch{return null;} });
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const s = localStorage.getItem('mmc_admin_session');
      if (s) { const p=JSON.parse(s); return new Date(p.expiresAt)>new Date(); }
    } catch{}
    return false;
  });
  const [currentView, setCurrentView] = useState('login');
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme')||'medical-professional');
  const [language, setLanguage] = useState(getCurrentLanguage());

  useEffect(() => {
    autoRepairSystem.startMonitoring();
    functionTableMonitor.startMonitoring();
    elementMonitor.startMonitoring();
    const adv = new AdvancedAutoRepair(supabase);
    adv.startAutoRepair();
    healthMonitor.init(supabase);
    const rp = new InteractiveElementReporter();
    rp.startReporting();
  }, []);

  useEffect(() => {
    setCurrentLanguage(language);
    const path = window.location.pathname;
    if (path==='/admin'||path.startsWith('/admin/')) { setCurrentView(isAdmin?'admin':'login'); return; }
    if (isAdmin) { setCurrentView('admin'); return; }
    if (patientData) { setCurrentView(patientData.queueType||patientData.examType?'patient':'examSelection'); return; }
    if (path==='/doctor'||path.startsWith('/doctor/')) { setCurrentView(doctorSession?'doctor':'login'); return; }
    if (path==='/clinic/login'||path==='/clinic/login/') { setCurrentView('clinic_login'); return; }
    if (path.match(/\/clinic\/[^/]+\/display$/)) { setCurrentView('display'); return; }
    if (path.startsWith('/clinic/')) { setCurrentView(clinicSession?'clinic_dashboard':'clinic_login'); return; }
    if (path.includes('/qr')) { setCurrentView('qrscan'); return; }
    setCurrentView('login');
  }, [language, isAdmin, patientData, clinicSession, doctorSession]);

  useEffect(() => { applyTheme(currentTheme); localStorage.setItem('selectedTheme',currentTheme); }, [currentTheme]);

  const applyTheme = (id) => {
    const theme = enhancedMedicalThemes.find(t=>t.id===id);
    if (!theme) return;
    const css = generateThemeCSS(id);
    const old = document.getElementById('enhanced-theme-style');
    if (old) old.remove();
    const s = document.createElement('style');
    s.id='enhanced-theme-style'; s.textContent=css;
    document.head.appendChild(s);
    document.body.style.background = theme.gradients.background;
    document.body.className = `theme-${id}`;
  };

  const showNotification = (msg, type='info') => {
    const n = document.createElement('div');
    n.className=`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type==='success'?'bg-green-500 text-white':type==='error'?'bg-red-500 text-white':'bg-blue-500 text-white'}`;
    n.textContent=msg; document.body.appendChild(n);
    setTimeout(()=>{ n.style.opacity='0'; setTimeout(()=>{if(document.body.contains(n))document.body.removeChild(n);},300); },3000);
  };

  // ============= PATIENT LOGIN =============
  const handleLogin = async ({ patientId, gender }) => {
    try {
      const devRestrict = await getSystemSetting('device_restriction_enabled', false);
      if (devRestrict) {
        const chk = await checkDeviceLogin(patientId);
        if (!chk.allowed) { showNotification(`هذا الجهاز مسجل برقم آخر اليوم: ${chk.existingPatientId}`,'error'); return; }
      }
      const res = await api.patientLogin(patientId, gender);
      if (res.success) {
        await registerDeviceLogin(patientId);
        await logDailyActivity('patient_login',{patientId,gender,location:'شاشة التسجيل',performedBy:patientId});
        localStorage.removeItem('mmc_admin_session');
        localStorage.removeItem('mmc_doctor_session');
        setIsAdmin(false); setDoctorSession(null);
        setPatientData(res.data);
        localStorage.setItem('patientData', JSON.stringify(res.data));
        setCurrentView('examSelection');
        showNotification(language==='ar'?'تم تسجيل الدخول بنجاح':'Login successful','success');
      } else {
        showNotification(language==='ar'?'فشل تسجيل الدخول':'Login failed','error');
      }
    } catch(e) {
      console.error('[App] Patient login error:',e);
      showNotification(language==='ar'?'خطأ في الاتصال':'Connection error','error');
    }
  };

  // ============= ADMIN LOGIN =============
  const handleAdminLogin = async (credentials) => {
    try {
      const [username,password] = credentials.split(':');
      if (!username||!password) { showNotification('يرجى إدخال اسم المستخدم وكلمة المرور','error'); return; }
      const result = await authService.login(username,password);
      if (result.success) {
        localStorage.removeItem('patientData'); localStorage.removeItem('mmc_doctor_session');
        setPatientData(null); setDoctorSession(null);
        setIsAdmin(true); setCurrentView('admin');
        showNotification(language==='ar'?'✅ تم تسجيل الدخول بنجاح':'✅ Login successful','success');
      } else {
        showNotification(language==='ar'?'❌ اسم المستخدم أو كلمة المرور غير صحيحة':'❌ Invalid credentials','error');
      }
    } catch(e) {
      console.error('[App] Admin login error:',e);
      showNotification('خطأ في الاتصال','error');
    }
  };

  // ============= DOCTOR LOGIN (fixed: via api.doctorLogin RPC) =============
  const handleDoctorLogin = async (credentials) => {
    try {
      const [username,password] = credentials.split(':');
      if (!username||!password) { showNotification('يرجى إدخال اسم المستخدم وكلمة المرور','error'); return; }
      // استخدام api.doctorLogin الذي يتحقق عبر doctor_login RPC
      const result = await api.doctorLogin(username, password);
      if (result.success && result.data) {
        const session = {
          id: result.data.id,
          name: result.data.name,
          clinic_id: result.data.clinic_id,
          clinic_name: result.data.clinic_name || result.data.clinic_id,
          role: result.data.role || 'DOCTOR',
          expiresAt: new Date(Date.now()+24*60*60*1000).toISOString()
        };
        localStorage.setItem('mmc_doctor_session', JSON.stringify(session));
        setDoctorSession(session);
        setCurrentView('doctor');
        showNotification(language==='ar'?'✅ تم تسجيل الدخول بنجاح':'✅ Login successful','success');
      } else {
        showNotification(language==='ar'?'❌ بيانات الدخول غير صحيحة':'❌ Invalid credentials','error');
      }
    } catch(e) {
      console.error('[App] Doctor login error:',e);
      showNotification('خطأ في الاتصال','error');
    }
  };

  // ============= LOGOUT =============
  const handleLogout = () => {
    setPatientData(null); setIsAdmin(false); setDoctorSession(null);
    setCurrentView('login');
    localStorage.removeItem('patientData');
    localStorage.removeItem('mmc_admin_session');
    localStorage.removeItem('mmc_doctor_session');
    window.history.pushState({},'','/');
  };

  // ============= EXAM SELECTION (fixed: pathway from DB, enter queue via RPC) =============
  const handleExamSelect = async (examType) => {
    try {
      const clinics = await getDynamicMedicalPathway(examType, patientData?.gender||'male');
      if (!clinics||clinics.length===0) throw new Error('No clinics found for: '+examType);
      const patientId = patientData?.patient_id || patientData?.personal_id || patientData?.id;
      // دخول الصف في أول عيادة عبر RPC المحمية
      const firstClinic = clinics[0];
      const enterResult = await api.enterQueue(
        firstClinic.id,
        patientId,
        false,
        patientData?.name || patientId,
        examType,
        patientData?.gender || 'male',
        patientData?.military_id || null,
        patientData?.personal_id || patientId
      );
      // Save route to database for PatientPage to retrieve later
      try {
        await api.createRoute(patientId, examType, patientData?.gender || 'male', clinics);
      } catch (routeErr) {
        console.warn('[App] Failed to save route:', routeErr);
      }

      const updatedData = {
        ...patientData,
        queueType: examType,
        examType: examType,
        currentClinic: firstClinic.id,
        pathway: clinics,
        queueNumber: enterResult?.display_number || null,
        queueId: enterResult?.id || null
      };
      setPatientData(updatedData);
      localStorage.setItem('patientData', JSON.stringify(updatedData));
      setCurrentView('patient');
      showNotification(language==='ar'?'تم تسجيل دخولك في الطابور بنجاح':'Registered in queue successfully','success');
    } catch(e) {
      console.error('[App] Exam select error:',e);
      showNotification(language==='ar'?'فشل تسجيل المسار الطبي':'Failed to setup medical pathway','error');
    }
  };

  const toggleLanguage = () => { const l=language==='ar'?'en':'ar'; setLanguage(l); setCurrentLanguage(l); };

  const theme = enhancedMedicalThemes.find(t=>t.id===currentTheme);
  React.useEffect(() => {
    if (theme?.gradients?.background) {
      document.body.style.background=theme.gradients.background;
      document.body.style.backgroundAttachment='fixed';
      document.documentElement.style.background=theme.gradients.background;
    }
  },[theme]);

  return (
    <div className="min-h-screen" style={{background:'transparent'}}>
      <main className="relative z-10">

        {currentView==='qrscan' && (
          <Suspense fallback={<LoadingFallback />}>
            <QrScanPage language={language} toggleLanguage={toggleLanguage} />
          </Suspense>
        )}

        {currentView==='login' && (
          <LoginPage
            onLogin={handleLogin}
            onAdminLogin={handleAdminLogin}
            onDoctorLogin={handleDoctorLogin}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView==='examSelection' && patientData && (
          <ExamSelectionPage
            patientData={patientData}
            onExamSelect={handleExamSelect}
            onBack={() => { localStorage.removeItem('patientData'); setPatientData(null); setCurrentView('login'); }}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView==='patient' && patientData && (
          <PatientPage
            patientData={patientData}
            onLogout={handleLogout}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView==='admin' && isAdmin && (
          <Suspense fallback={<LoadingFallback />}>
            <HealthAlertBanner language={language} />
            <AdminErrorBoundary>
              <AdminDashboardV2
                onLogout={handleLogout}
                language={language}
                toggleLanguage={toggleLanguage}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
              />
            </AdminErrorBoundary>
          </Suspense>
        )}

        {currentView==='doctor' && doctorSession && (
          <Suspense fallback={<LoadingFallback />}>
            <DoctorDashboard
              doctorData={doctorSession}
              onLogout={() => { setDoctorSession(null); localStorage.removeItem('mmc_doctor_session'); setCurrentView('login'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView==='clinic_login' && (
          <ClinicLoginPage
            onLogin={(session) => { setClinicSession(session); localStorage.setItem('mmc_clinic_session',JSON.stringify(session)); setCurrentView('clinic_dashboard'); }}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView==='clinic_dashboard' && clinicSession && (
          <Suspense fallback={<LoadingFallback />}>
            <ClinicDashboard
              session={clinicSession}
              onLogout={() => { setClinicSession(null); localStorage.removeItem('mmc_clinic_session'); setCurrentView('clinic_login'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView==='display' && (
          <Suspense fallback={<LoadingFallback />}>
            <DisplayPage language={language} />
          </Suspense>
        )}

      </main>
      <SpeedInsights />
      <Analytics />
    </div>
  );
}

export default App;
