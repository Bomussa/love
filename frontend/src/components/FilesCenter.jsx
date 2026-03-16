/**
 * FilesCenter — مركز الملفات
 * شاشة إدارة ملفات التوثيق داخل لوحة الإدارة
 * أيقونات صغيرة + اسم مختصر + قائمة خيارات (فتح، إرسال، تصدير، تعديل، حذف)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Database, Wrench, Code, Server, Shield,
  BookOpen, Settings, Cpu, BarChart3, Download, Send,
  Edit3, Trash2, Eye, X, ChevronRight, Search,
  Plus, RefreshCw, Copy, Share2, Printer, FolderOpen,
  CheckCircle, AlertCircle, Clock, FileCode, FileSearch,
  Layers, GitBranch, Zap, HardDrive, Lock, Activity
} from 'lucide-react';

// ===== قائمة الملفات الحقيقية =====
const FILES_DATA = {
  ar: [
    {
      id: 'features',
      name: 'المزايا',
      fullName: 'دليل التكامل الشامل',
      icon: Layers,
      color: '#8A1538',
      category: 'docs',
      path: '/docs/INTEGRATION_LOCK.md',
      size: '~45 KB',
      lines: 320,
      desc: 'كل مزايا النظام الظاهرة والباطنة مع الهدف والمسار وموقع الكود'
    },
    {
      id: 'database',
      name: 'قاعدة البيانات',
      fullName: 'دليل قاعدة البيانات',
      icon: Database,
      color: '#1a5276',
      category: 'docs',
      path: '/docs/DATABASE.md',
      size: '~28 KB',
      lines: 373,
      desc: '97 جدول Supabase — الأعمدة والعلاقات والإحصاءات الحقيقية'
    },
    {
      id: 'architecture',
      name: 'الهيكل',
      fullName: 'هيكل النظام والمعمارية',
      icon: GitBranch,
      color: '#1e8449',
      category: 'docs',
      path: '/docs/ARCHITECTURE.md',
      size: '~38 KB',
      lines: 568,
      desc: 'المعمارية الكاملة وحركة البيانات والمسارات'
    },
    {
      id: 'services',
      name: 'الخدمات',
      fullName: 'دليل الخدمات والـ API',
      icon: Server,
      color: '#7d3c98',
      category: 'docs',
      path: '/docs/API_V1_ENDPOINTS.md',
      size: '~32 KB',
      lines: 280,
      desc: '21 API endpoint + 5 خدمات lib مع الدوال والأسطر الدقيقة'
    },
    {
      id: 'maintenance',
      name: 'الصيانة',
      fullName: 'دليل الصيانة والإصلاح',
      icon: Wrench,
      color: '#d35400',
      category: 'docs',
      path: '/docs/MAINTENANCE.md',
      size: '~18 KB',
      lines: 180,
      desc: 'إجراءات الصيانة الدورية والإصلاح وحل المشكلات'
    },
    {
      id: 'security',
      name: 'الأمان',
      fullName: 'دليل الأمان والحماية',
      icon: Shield,
      color: '#922b21',
      category: 'docs',
      path: '/docs/SECURITY.md',
      size: '~12 KB',
      lines: 48,
      desc: 'سياسات الأمان والصلاحيات وحماية البيانات'
    },
    {
      id: 'api',
      name: 'API',
      fullName: 'وثيقة API الكاملة (v1)',
      icon: Code,
      color: '#1a5276',
      category: 'docs',
      path: '/docs/API.md',
      size: '~22 KB',
      lines: 200,
      desc: 'كل نقاط النهاية مع الأمثلة والمعاملات والردود'
    },
    {
      id: 'deployment',
      name: 'النشر',
      fullName: 'دليل النشر والإعداد',
      icon: Activity,
      color: '#117a65',
      category: 'docs',
      path: '/docs/DEPLOYMENT.md',
      size: '~8 KB',
      lines: 34,
      desc: 'خطوات النشر على Vercel وإعداد المتغيرات'
    },
    {
      id: 'smart_engine',
      name: 'محرك الإصلاح',
      fullName: 'محرك الإصلاح الذكي',
      icon: Zap,
      color: '#C9A54C',
      category: 'system',
      path: '/frontend/src/lib/advanced-auto-repair.js',
      size: '~52 KB',
      lines: 726,
      desc: 'Circuit Breaker + Retry + Watchdog + Health Check + Bulkhead'
    },
    {
      id: 'memory_manager',
      name: 'إدارة الذاكرة',
      fullName: 'نظام إدارة الذاكرة',
      icon: HardDrive,
      color: '#2e4053',
      category: 'system',
      path: '/frontend/src/lib/auto-repair-system.js',
      size: '~28 KB',
      lines: 397,
      desc: 'LRU Algorithm + Watchdog — حذف تلقائي عند 90% امتلاء'
    },
    {
      id: 'supabase_client',
      name: 'Supabase',
      fullName: 'عميل Supabase',
      icon: Database,
      color: '#3498db',
      category: 'system',
      path: '/frontend/src/lib/supabase-client.js',
      size: '~35 KB',
      lines: 520,
      desc: 'الاتصال + المراقبة + التسجيل + إدارة الجلسات'
    },
    {
      id: 'auth_service',
      name: 'المصادقة',
      fullName: 'خدمة المصادقة',
      icon: Lock,
      color: '#8e44ad',
      category: 'system',
      path: '/frontend/src/lib/auth-service.js',
      size: '~18 KB',
      lines: 220,
      desc: 'JWT + أدوار المستخدمين + إدارة الجلسات'
    },
    {
      id: 'readme',
      name: 'README',
      fullName: 'دليل المشروع الرئيسي',
      icon: BookOpen,
      color: '#C9A54C',
      category: 'docs',
      path: '/frontend/README.md',
      size: '~15 KB',
      lines: 222,
      desc: 'نظرة عامة على المشروع وطريقة التشغيل'
    },
    {
      id: 'truth_tree',
      name: 'شجرة الحقيقة',
      fullName: 'شجرة الحقيقة الكاملة',
      icon: FileSearch,
      color: '#1e8449',
      category: 'docs',
      path: '/docs/TRUTH_TREE_LOVE_API.md',
      size: '~68 KB',
      lines: 967,
      desc: 'أشمل ملف — كل تفاصيل API والنظام موثقة'
    },
    {
      id: 'e2e_tests',
      name: 'نتائج الاختبار',
      fullName: 'نتائج الاختبار الشامل',
      icon: CheckCircle,
      color: '#1e8449',
      category: 'tests',
      path: '/docs/E2E_TEST_RESULTS.md',
      size: '~10 KB',
      lines: 120,
      desc: 'نتائج الاختبار الشامل E2E على mmc-mms.com'
    },
    {
      id: 'integration_lock',
      name: 'قفل التكامل',
      fullName: 'ملف قفل التكامل',
      icon: Lock,
      color: '#922b21',
      category: 'system',
      path: '/docs/INTEGRATION_LOCK.md',
      size: '~5 KB',
      lines: 60,
      desc: 'قواعد التكامل الصارمة لمنع التعارض'
    }
  ],
  en: [
    { id: 'features', name: 'Features', fullName: 'Complete Integration Guide', icon: Layers, color: '#8A1538', category: 'docs', path: '/docs/INTEGRATION_LOCK.md', size: '~45 KB', lines: 320, desc: 'All system features (visible & hidden) with purpose, path, and code location' },
    { id: 'database', name: 'Database', fullName: 'Database Guide', icon: Database, color: '#1a5276', category: 'docs', path: '/docs/DATABASE.md', size: '~28 KB', lines: 373, desc: '97 Supabase tables — columns, relations, real statistics' },
    { id: 'architecture', name: 'Architecture', fullName: 'System Architecture', icon: GitBranch, color: '#1e8449', category: 'docs', path: '/docs/ARCHITECTURE.md', size: '~38 KB', lines: 568, desc: 'Full architecture, data flow, and routes' },
    { id: 'services', name: 'Services', fullName: 'Services & API Guide', icon: Server, color: '#7d3c98', category: 'docs', path: '/docs/API_V1_ENDPOINTS.md', size: '~32 KB', lines: 280, desc: '21 API endpoints + 5 lib services with functions and exact line numbers' },
    { id: 'maintenance', name: 'Maintenance', fullName: 'Maintenance & Repair Guide', icon: Wrench, color: '#d35400', category: 'docs', path: '/docs/MAINTENANCE.md', size: '~18 KB', lines: 180, desc: 'Periodic maintenance procedures, repair, and troubleshooting' },
    { id: 'security', name: 'Security', fullName: 'Security & Protection Guide', icon: Shield, color: '#922b21', category: 'docs', path: '/docs/SECURITY.md', size: '~12 KB', lines: 48, desc: 'Security policies, permissions, and data protection' },
    { id: 'api', name: 'API', fullName: 'Complete API Documentation', icon: Code, color: '#1a5276', category: 'docs', path: '/docs/API.md', size: '~22 KB', lines: 200, desc: 'All endpoints with examples, parameters, and responses' },
    { id: 'deployment', name: 'Deployment', fullName: 'Deployment & Setup Guide', icon: Activity, color: '#117a65', category: 'docs', path: '/docs/DEPLOYMENT.md', size: '~8 KB', lines: 34, desc: 'Vercel deployment steps and environment variables' },
    { id: 'smart_engine', name: 'Repair Engine', fullName: 'Smart Repair Engine', icon: Zap, color: '#C9A54C', category: 'system', path: '/frontend/src/lib/advanced-auto-repair.js', size: '~52 KB', lines: 726, desc: 'Circuit Breaker + Retry + Watchdog + Health Check + Bulkhead' },
    { id: 'memory_manager', name: 'Memory Mgr', fullName: 'Memory Management System', icon: HardDrive, color: '#2e4053', category: 'system', path: '/frontend/src/lib/auto-repair-system.js', size: '~28 KB', lines: 397, desc: 'LRU Algorithm + Watchdog — auto-delete at 90% capacity' },
    { id: 'supabase_client', name: 'Supabase', fullName: 'Supabase Client', icon: Database, color: '#3498db', category: 'system', path: '/frontend/src/lib/supabase-client.js', size: '~35 KB', lines: 520, desc: 'Connection + monitoring + logging + session management' },
    { id: 'auth_service', name: 'Auth', fullName: 'Authentication Service', icon: Lock, color: '#8e44ad', category: 'system', path: '/frontend/src/lib/auth-service.js', size: '~18 KB', lines: 220, desc: 'JWT + user roles + session management' },
    { id: 'readme', name: 'README', fullName: 'Frontend Project Guide', icon: BookOpen, color: '#C9A54C', category: 'docs', path: '/frontend/README.md', size: '~15 KB', lines: 222, desc: 'Project overview and setup instructions' },
    { id: 'truth_tree', name: 'Truth Tree', fullName: 'Complete Truth Tree', icon: FileSearch, color: '#1e8449', category: 'docs', path: '/docs/TRUTH_TREE_LOVE_API.md', size: '~68 KB', lines: 967, desc: 'Most comprehensive file — all API and system details documented' },
    { id: 'e2e_tests', name: 'Test Results', fullName: 'Comprehensive Test Results', icon: CheckCircle, color: '#1e8449', category: 'tests', path: '/docs/E2E_TEST_RESULTS.md', size: '~10 KB', lines: 120, desc: 'E2E test results on mmc-mms.com' },
    { id: 'integration_lock', name: 'Int. Lock', fullName: 'Integration Lock File', icon: Lock, color: '#922b21', category: 'system', path: '/docs/INTEGRATION_LOCK.md', size: '~5 KB', lines: 60, desc: 'Strict integration rules to prevent conflicts' }
  ]
};

const CATEGORIES = {
  ar: [
    { id: 'all', label: 'الكل' },
    { id: 'docs', label: 'التوثيق' },
    { id: 'system', label: 'النظام' },
    { id: 'tests', label: 'الاختبارات' }
  ],
  en: [
    { id: 'all', label: 'All' },
    { id: 'docs', label: 'Docs' },
    { id: 'system', label: 'System' },
    { id: 'tests', label: 'Tests' }
  ]
};

// ===== محتوى الملفات =====
// يتم توليده ديناميكياً من بيانات الفهرس داخل buildFileContent.

// ===== المكوّن الرئيسي =====
const FilesCenter = ({ language = 'ar', t }) => {
  const isAr = language === 'ar';
  const files = FILES_DATA[language] || FILES_DATA.ar;
  const categories = CATEGORIES[language] || CATEGORIES.ar;

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [notification, setNotification] = useState(null);
  const menuRef = useRef(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // فلترة الملفات
  const filteredFiles = files.filter(f => {
    const matchCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchSearch = !searchQuery || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // إظهار إشعار
  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const buildFileContent = (file) => {
    const localizedPath = isAr ? 'المسار' : 'Path';
    const localizedCategory = isAr ? 'الفئة' : 'Category';
    const localizedSize = isAr ? 'الحجم التقريبي' : 'Approx size';
    const localizedLines = isAr ? 'عدد الأسطر التقريبي' : 'Approx lines';
    const localizedNoteTitle = isAr ? 'ملاحظة' : 'Note';
    const localizedNote = isAr
      ? 'هذه البطاقة تعرض بيانات تعريفية للملف من فهرس مركز الملفات، وقد لا تعكس المحتوى الكامل للملف.'
      : 'This card shows indexed file metadata and may not represent the full file content.';

    return `# ${file.fullName}\n\n${file.desc}\n\n- ${localizedPath}: ${file.path}\n- ${localizedCategory}: ${file.category}\n- ${localizedSize}: ${file.size}\n- ${localizedLines}: ${file.lines}\n\n## ${localizedNoteTitle}\n${localizedNote}`;
  };

  // ===== خيارات الملف =====
  const handleOpen = (file) => {
    const content = buildFileContent(file);
    setOpenFile({ ...file, content });
    setEditMode(false);
    setEditContent(content);
    setOpenMenu(null);
  };

  const handleEdit = (file) => {
    const content = buildFileContent(file);
    setOpenFile({ ...file, content });
    setEditMode(true);
    setEditContent(content);
    setOpenMenu(null);
  };

  const handleExport = (file) => {
    const content = buildFileContent(file);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotif(isAr ? `تم تصدير ${file.name}` : `${file.name} exported`);
    setOpenMenu(null);
  };

  const handleExportPDF = (file) => {
    const content = buildFileContent(file);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${file.fullName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          body { font-family: 'Cairo', sans-serif; direction: ${isAr ? 'rtl' : 'ltr'}; padding: 40px; color: #1a1a1a; }
          .header { text-align: center; border-bottom: 3px solid #8A1538; padding-bottom: 20px; margin-bottom: 30px; }
          .logo-area { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px; }
          .org-name { font-size: 18px; font-weight: 700; color: #8A1538; }
          .doc-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 10px 0; }
          .meta { font-size: 12px; color: #666; }
          .content { white-space: pre-wrap; font-size: 13px; line-height: 1.8; }
          h1 { color: #8A1538; font-size: 20px; border-bottom: 2px solid #C9A54C; padding-bottom: 8px; }
          h2 { color: #1a5276; font-size: 16px; }
          h3 { color: #2e4053; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #8A1538; color: white; padding: 8px; font-size: 12px; }
          td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
          .footer { margin-top: 40px; border-top: 2px solid #8A1538; padding-top: 15px; text-align: center; font-size: 11px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <div>
              <div class="org-name">القيادة العامة للقوات المسلحة</div>
              <div class="org-name">اللجنة الطبية العسكرية المركزية</div>
            </div>
          </div>
          <div class="doc-title">${file.fullName}</div>
          <div class="meta">
            نظام MMC-MMS | mmc-mms.com | ${new Date().toLocaleDateString('ar-SA')}
          </div>
        </div>
        <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="footer">
          وثيقة سرية — اللجنة الطبية العسكرية المركزية | MMC-MMS System v2.0
          <br>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    showNotif(isAr ? `جاري تصدير PDF لـ ${file.name}` : `Exporting PDF for ${file.name}`);
    setOpenMenu(null);
  };

  const handleCopy = (file) => {
    const content = buildFileContent(file);
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
      showNotif(isAr ? 'تم النسخ' : 'Copied!');
    });
    setOpenMenu(null);
  };

  const handleShare = (file) => {
    const text = `${file.fullName}\n${file.desc}\nنظام MMC-MMS: https://mmc-mms.com`;
    if (navigator.share) {
      navigator.share({ title: file.fullName, text, url: 'https://mmc-mms.com' });
    } else {
      navigator.clipboard.writeText(text);
      showNotif(isAr ? 'تم نسخ رابط المشاركة' : 'Share link copied');
    }
    setOpenMenu(null);
  };

  const handleSaveEdit = () => {
    showNotif(isAr ? `تم حفظ التعديلات على ${openFile.name}` : `Changes saved for ${openFile.name}`);
    setEditMode(false);
    if (openFile) setOpenFile({ ...openFile, content: editContent });
  };

  // ===== تصميم الأيقونة =====
  const FileIcon = ({ file }) => {
    const Icon = file.icon;
    const isMenuOpen = openMenu === file.id;
    const isCopied = copiedId === file.id;

    return (
      <div className="relative group">
        {/* الأيقونة الرئيسية */}
        <div
          className="flex flex-col items-center cursor-pointer select-none"
          data-testid={`files-icon-${file.id}`}
          onClick={() => setOpenMenu(isMenuOpen ? null : file.id)}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl border border-white/20"
            style={{ backgroundColor: file.color + '22', borderColor: file.color + '44' }}
          >
            <Icon size={28} style={{ color: file.color }} />
          </div>
          <span className="mt-2 text-xs font-semibold text-center leading-tight max-w-[72px] truncate"
            style={{ color: '#e8d5b7', fontFamily: 'Cairo, sans-serif' }}>
            {file.name}
          </span>
          {isCopied && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✓</span>
          )}
        </div>

        {/* قائمة الخيارات */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            data-testid={`files-menu-${file.id}`}
            className="absolute z-50 rounded-xl shadow-2xl border overflow-hidden min-w-[160px]"
            style={{
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              backgroundColor: '#1a1a2e',
              borderColor: file.color + '66',
              direction: isAr ? 'rtl' : 'ltr'
            }}
          >
            {/* اسم الملف */}
            <div className="px-3 py-2 text-xs font-bold border-b" 
              style={{ color: file.color, borderColor: file.color + '33', backgroundColor: file.color + '11' }}>
              {file.fullName}
            </div>
            
            {/* الخيارات */}
            {[
              { icon: Eye, label: isAr ? 'فتح وقراءة' : 'Open & Read', action: () => handleOpen(file), color: '#3498db' },
              { icon: Edit3, label: isAr ? 'تعديل' : 'Edit', action: () => handleEdit(file), color: '#f39c12' },
              { icon: Download, label: isAr ? 'تصدير MD' : 'Export MD', action: () => handleExport(file), color: '#2ecc71' },
              { icon: Printer, label: isAr ? 'تصدير PDF' : 'Export PDF', action: () => handleExportPDF(file), color: '#e74c3c' },
              { icon: Copy, label: isAr ? 'نسخ المحتوى' : 'Copy Content', action: () => handleCopy(file), color: '#9b59b6' },
              { icon: Share2, label: isAr ? 'مشاركة' : 'Share', action: () => handleShare(file), color: '#1abc9c' },
            ].map((opt, i) => (
              <button
                key={i}
                data-testid={`files-${file.id}-action-${String(opt.label).replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()}`}
                onClick={opt.action}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors"
                style={{ color: '#e8d5b7' }}
              >
                <opt.icon size={14} style={{ color: opt.color }} />
                {opt.label}
              </button>
            ))}
            
            {/* معلومات الملف */}
            <div className="px-3 py-2 border-t text-xs" style={{ borderColor: file.color + '33', color: '#888' }}>
              {file.lines} {isAr ? 'سطر' : 'lines'} • {file.size}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4" data-testid="files-center-root" data-state={filteredFiles.length === 0 ? 'empty' : openFile ? 'success' : 'ready'} style={{ fontFamily: 'Cairo, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}>
      
      {/* إشعار */}
      {notification && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2"
          style={{
            backgroundColor: notification.type === 'success' ? '#1e8449' : '#922b21',
            color: 'white',
            fontFamily: 'Cairo, sans-serif'
          }}
        >
          <CheckCircle size={16} />
          {notification.msg}
        </div>
      )}

      {/* الرأس */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#8A1538' }}>
            <FolderOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#C9A54C' }}>
              {isAr ? 'مركز الملفات' : 'Files Center'}
            </h1>
            <p className="text-xs" style={{ color: '#888' }}>
              {isAr ? `${files.length} ملف — اضغط على أي ملف لعرض الخيارات` : `${files.length} files — Click any file for options`}
            </p>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلتر */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* بحث */}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-gray-400" style={{ [isAr ? 'right' : 'left']: '10px' }} />
          <input
            data-testid="files-search-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث في الملفات...' : 'Search files...'}
            className="w-full px-8 py-2 rounded-xl text-sm border outline-none"
            style={{
              backgroundColor: '#1a1a2e',
              borderColor: '#8A1538' + '44',
              color: '#e8d5b7',
              fontFamily: 'Cairo, sans-serif',
              paddingRight: isAr ? '32px' : '8px',
              paddingLeft: isAr ? '8px' : '32px'
            }}
          />
        </div>

        {/* فلتر الفئات */}
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              data-testid={`files-category-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeCategory === cat.id ? '#8A1538' : '#1a1a2e',
                color: activeCategory === cat.id ? 'white' : '#888',
                border: `1px solid ${activeCategory === cat.id ? '#8A1538' : '#333'}`,
                fontFamily: 'Cairo, sans-serif'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة الأيقونات */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 mb-6">
        {filteredFiles.map(file => (
          <FileIcon key={file.id} file={file} />
        ))}
        {filteredFiles.length === 0 && (
          <div data-testid="files-empty-state" className="col-span-full text-center py-8 text-sm" style={{ color: '#666' }}>
            {isAr ? 'لا توجد ملفات مطابقة' : 'No matching files'}
          </div>
        )}
      </div>

      {/* ===== نافذة قراءة/تعديل الملف ===== */}
      {openFile && (
        <div data-testid="files-viewer-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#0d0d1a', border: `2px solid ${openFile.color}44` }}
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: openFile.color + '33', backgroundColor: openFile.color + '11' }}>
              <div className="flex items-center gap-3">
                <openFile.icon size={20} style={{ color: openFile.color }} />
                <div>
                  <div className="font-bold text-sm" style={{ color: '#e8d5b7', fontFamily: 'Cairo, sans-serif' }}>{openFile.fullName}</div>
                  <div className="text-xs" style={{ color: '#888' }}>{openFile.path} • {openFile.lines} {isAr ? 'سطر' : 'lines'} • {openFile.size}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <button data-testid="files-modal-edit-button" onClick={() => setEditMode(true)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#f39c12' + '22', color: '#f39c12', border: '1px solid #f39c1244' }}>
                    <Edit3 size={12} /> {isAr ? 'تعديل' : 'Edit'}
                  </button>
                ) : (
                  <button data-testid="files-modal-save-button" onClick={handleSaveEdit} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#2ecc71' + '22', color: '#2ecc71', border: '1px solid #2ecc7144' }}>
                    <CheckCircle size={12} /> {isAr ? 'حفظ' : 'Save'}
                  </button>
                )}
                <button data-testid="files-modal-export-md-button" onClick={() => handleExport(openFile)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#3498db' + '22', color: '#3498db', border: '1px solid #3498db44' }}>
                  <Download size={12} /> MD
                </button>
                <button data-testid="files-modal-export-pdf-button" onClick={() => handleExportPDF(openFile)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#e74c3c' + '22', color: '#e74c3c', border: '1px solid #e74c3c44' }}>
                  <Printer size={12} /> PDF
                </button>
                <button data-testid="files-modal-close-button" onClick={() => { setOpenFile(null); setEditMode(false); }} className="p-1 rounded-lg" style={{ color: '#888' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* محتوى الملف */}
            <div className="flex-1 overflow-auto p-5">
              {editMode ? (
                <textarea
                  data-testid="files-modal-editor"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] rounded-xl p-4 text-sm font-mono outline-none resize-none"
                  style={{
                    backgroundColor: '#111122',
                    color: '#e8d5b7',
                    border: `1px solid ${openFile.color}44`,
                    fontFamily: 'monospace',
                    direction: 'ltr'
                  }}
                />
              ) : (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#e8d5b7', fontFamily: 'Cairo, monospace', direction: isAr ? 'rtl' : 'ltr' }}>
                  {openFile.content}
                </pre>
              )}
            </div>

            {/* فهرس سريع */}
            {!editMode && (
              <div className="px-5 py-3 border-t flex flex-wrap gap-2" style={{ borderColor: openFile.color + '22', backgroundColor: '#0a0a15' }}>
                <span className="text-xs" style={{ color: '#666' }}>{isAr ? 'انتقال سريع:' : 'Jump to:'}</span>
                {openFile.content.split('\n').filter(l => l.startsWith('## ')).slice(0, 6).map((heading, i) => (
                  <button
                    key={i}
                    data-testid={`files-modal-jump-${i}`}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: openFile.color + '22', color: openFile.color, fontFamily: 'Cairo, sans-serif' }}
                    onClick={() => {
                      const text = heading.replace('## ', '');
                      const pre = document.querySelector('.whitespace-pre-wrap');
                      if (pre) {
                        const idx = openFile.content.indexOf(heading);
                        const ratio = idx / openFile.content.length;
                        pre.parentElement.scrollTop = pre.parentElement.scrollHeight * ratio;
                      }
                    }}
                  >
                    {heading.replace(/^#+\s/, '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesCenter;
