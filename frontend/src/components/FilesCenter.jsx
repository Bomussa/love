import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  FileSearch,
  FileText,
  FolderOpen,
  GitBranch,
  HardDrive,
  Lock,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Shield,
  Server,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import * as XLSX from 'xlsx';

const CATEGORY_META = {
  docs: { labelAr: 'التوثيق', labelEn: 'Docs', icon: FileText, color: '#8A1538' },
  system: { labelAr: 'النظام', labelEn: 'System', icon: Settings, color: '#C9A54C' },
  tests: { labelAr: 'الاختبارات', labelEn: 'Tests', icon: CheckCircle, color: '#1e8449' },
  database: { labelAr: 'قاعدة البيانات', labelEn: 'Database', icon: Database, color: '#3498db' },
  api: { labelAr: 'API', labelEn: 'API', icon: Server, color: '#7d3c98' },
  security: { labelAr: 'الأمان', labelEn: 'Security', icon: Shield, color: '#922b21' },
  config: { labelAr: 'الإعدادات', labelEn: 'Config', icon: Settings, color: '#d35400' },
  logs: { labelAr: 'السجلات', labelEn: 'Logs', icon: Activity, color: '#566573' },
};

const DEFAULT_CATEGORIES = [
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
  { id: 'docs', labelAr: 'التوثيق', labelEn: 'Docs' },
  { id: 'system', labelAr: 'النظام', labelEn: 'System' },
  { id: 'tests', labelAr: 'الاختبارات', labelEn: 'Tests' },
];

const normalizeDoc = (doc = {}) => ({
  id: String(doc.id ?? doc.path ?? doc.name ?? crypto.randomUUID()),
  name: doc.name_ar || doc.name || 'Untitled',
  fullName: doc.name || doc.name_ar || 'Untitled',
  category: doc.category || 'docs',
  path: doc.path || '',
  content: doc.content || '',
  description: doc.description || doc.description_ar || '',
  updated_at: doc.updated_at || null,
});

const FilesCenter = ({ language = 'ar' }) => {
  const isAr = language === 'ar';
  const menuRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState(new Set());

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('system_docs')
        .select('id,name,name_ar,category,path,content,description,description_ar,updated_at')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (dbError) throw dbError;

      // load archived registry
      let archSet = new Set();
      try {
        const { data: archRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('id', 'archived_system_docs_v1')
          .maybeSingle();
        const arr = Array.isArray(archRow?.value) ? archRow.value : [];
        archSet = new Set(arr.map((id) => String(id)));
        setArchivedIds(archSet);
      } catch {}

      const normalized = (data || []).map(normalizeDoc);
      const filtered = showArchived
        ? normalized
        : normalized.filter((d) => !archSet.has(String(d.id)));
      setFiles(filtered);
    } catch (err) {
      setFiles([]);
      setError(err?.message || (isAr ? 'فشل تحميل الملفات من قاعدة البيانات' : 'Failed to load files from database'));
    } finally {
      setLoading(false);
    }
  }, [isAr, showArchived]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuFor(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const categories = useMemo(() => DEFAULT_CATEGORIES, []);
  const filtered = useMemo(() => {
    return files.filter((file) => {
      const matchCategory = category === 'all' || file.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || [file.name, file.fullName, file.description, file.path].some((v) => String(v || '').toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [category, files, search]);

  const currentContent = selected?.content || '';

  const showNotice = (message) => {
    setNotice(message);
    window.clearTimeout(window.__filesCenterNoticeTimer);
    window.__filesCenterNoticeTimer = window.setTimeout(() => setNotice(''), 2500);
  };

  const openFile = (file) => {
    setSelected(file);
    setEditing(false);
    setDraft(file.content || '');
    setMenuFor(null);
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('system_docs')
        .update({ content: draft, updated_at: new Date().toISOString() })
        .eq('id', selected.id);

      if (dbError) throw dbError;
      await loadFiles();
      setSelected((prev) => (prev ? { ...prev, content: draft } : prev));
      setEditing(false);
      showNotice(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
    } catch (err) {
      setError(err?.message || (isAr ? 'فشل حفظ التغييرات' : 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  const exportMarkdown = (file) => {
    const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name || file.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuFor(null);
  };

  const downloadXlsx = (file) => {
    const rows = [
      ['Field', 'Value'],
      ['Name', file.fullName || ''],
      ['Path', file.path || ''],
      ['Category', file.category || ''],
      ['Updated At', file.updated_at || ''],
      ['Content', file.content || ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Record');
    XLSX.writeFile(wb, `${file.name || 'record'}.xlsx`);
    setMenuFor(null);
  };

  const copyContent = async (file) => {
    await navigator.clipboard.writeText(file.content || '');
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 1500);
    setMenuFor(null);
  };

  const shareContent = async (file) => {
    const payload = `${file.fullName}\n${file.path || ''}`.trim();
    if (navigator.share) {
      await navigator.share({ title: file.fullName, text: payload });
    } else {
      await navigator.clipboard.writeText(payload);
      showNotice(isAr ? 'تم نسخ بيانات المشاركة' : 'Share data copied');
    }
    setMenuFor(null);
  };

  const printPDF = (file) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${file.fullName}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}.h{border-bottom:2px solid #8A1538;padding-bottom:12px;margin-bottom:24px}.c{white-space:pre-wrap;line-height:1.8}</style></head><body><div class="h"><h1>${file.fullName}</h1><div>${file.path || ''}</div></div><div class="c">${(file.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></body></html>`);
    w.document.close();
    w.print();
    setMenuFor(null);
  };

  const iconFor = (file) => (CATEGORY_META[file.category]?.icon || FileText);
  const colorFor = (file) => CATEGORY_META[file.category]?.color || '#8A1538';
  const categoryLabel = (id) => (isAr ? (CATEGORY_META[id]?.labelAr || id) : (CATEGORY_META[id]?.labelEn || id));

  return (
    <div className="min-h-screen p-4" style={{ direction: isAr ? 'rtl' : 'ltr', fontFamily: 'Cairo, sans-serif' }}>
      {notice ? (
        <div className="fixed top-4 right-4 z-50 rounded-lg px-3 py-2 text-sm text-white" style={{ background: '#1e8449' }}>{notice}</div>
      ) : null}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#8A1538' }}><FolderOpen className="text-white" size={20} /></div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#C9A54C' }}>{isAr ? 'مركز الملفات' : 'Files Center'}</h1>
            <p className="text-xs" style={{ color: '#888' }}>{isAr ? `${files.length} ملف` : `${files.length} files`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived((v) => !v)} className="rounded-lg px-3 py-2 text-xs" style={{ background: '#1a1a2e', color: '#e8d5b7' }}>
            {showArchived ? (isAr ? 'إخفاء المؤرشف' : 'Hide Archived') : (isAr ? 'عرض المؤرشف' : 'Show Archived')}
          </button>
          <button onClick={loadFiles} className="rounded-lg px-3 py-2 text-white" style={{ background: '#8A1538' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-gray-400" style={{ [isAr ? 'right' : 'left']: 12 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? 'بحث...' : 'Search...'} className="w-full rounded-xl border px-8 py-2 text-sm" style={{ background: '#1a1a2e', borderColor: '#8A153844', color: '#e8d5b7' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: category === cat.id ? '#8A1538' : '#1a1a2e', color: category === cat.id ? '#fff' : '#888' }}>{categoryLabel(cat.id)}</button>
          ))}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {loading ? <div className="text-sm" style={{ color: '#888' }}>{isAr ? 'جارٍ التحميل...' : 'Loading...'}</div> : null}
      {!loading && !files.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ color: '#888', borderColor: '#333' }}>{isAr ? 'لا توجد ملفات.' : 'No files.'}</div> : null}

      <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {filtered.map((file) => {
          const Icon = iconFor(file);
          const color = colorFor(file);
          return (
            <div key={file.id} className="relative flex flex-col items-center">
              <button data-testid="file-card" onClick={() => setMenuFor(menuFor === file.id ? null : file.id)} className="flex flex-col items-center focus:outline-none">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg" style={{ background: `${color}22`, borderColor: `${color}44` }}>
                  <Icon size={28} style={{ color }} />
                </div>
                <span className="mt-2 max-w-[72px] truncate text-center text-xs font-semibold" style={{ color: '#e8d5b7' }}>{file.name}</span>
              </button>
              {copiedId === file.id ? <span className="absolute -top-1 -right-1 rounded-full bg-green-500 px-1 text-[10px] text-white">✓</span> : null}
              {menuFor === file.id ? (
                <div ref={menuRef} className="absolute z-30 mt-[76px] min-w-[170px] overflow-hidden rounded-xl border shadow-2xl" style={{ background: '#1a1a2e', borderColor: `${color}66` }}>
                  <div className="border-b px-3 py-2 text-xs font-bold" style={{ color, borderColor: `${color}33` }}>{file.fullName}</div>
                  <button data-testid="btn-open" onClick={() => openFile(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Eye size={14} />{isAr ? 'فتح وقراءة' : 'Open & Read'}</button>
                  <button data-testid="btn-edit" onClick={() => { openFile(file); setEditing(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Edit3 size={14} />{isAr ? 'تعديل' : 'Edit'}</button>
                  <button data-testid="btn-md" onClick={() => exportMarkdown(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Download size={14} />MD</button>
                  <button data-testid="btn-pdf" onClick={() => printPDF(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Printer size={14} />PDF</button>
                  <button data-testid="btn-xlsx" onClick={() => downloadXlsx(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Download size={14} />XLSX</button>
                  <button data-testid="btn-copy" onClick={() => copyContent(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Copy size={14} />{isAr ? 'نسخ المحتوى' : 'Copy'}</button>
                  <button data-testid="btn-share" onClick={() => shareContent(file)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><Share2 size={14} />{isAr ? 'مشاركة' : 'Share'}</button>
                  <button data-testid="btn-close" onClick={() => setMenuFor(null)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/10"><X size={14} />{isAr ? 'إغلاق' : 'Close'}</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border" style={{ background: '#0d0d1a', borderColor: `${colorFor(selected)}44` }}>
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: `${colorFor(selected)}33`, background: `${colorFor(selected)}11` }}>
              <div>
                <div className="font-bold text-white">{selected.fullName}</div>
                <div className="text-xs text-gray-400">{selected.path || ''}</div>
              </div>
              <div className="flex items-center gap-2">
                {!editing ? <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1 text-xs text-white" style={{ background: '#f39c12' }}><Edit3 size={12} /> {isAr ? 'تعديل' : 'Edit'}</button> : <button onClick={saveFile} disabled={saving} className="rounded-lg px-3 py-1 text-xs text-white" style={{ background: '#2ecc71' }}>{saving ? (isAr ? 'حفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}</button>}
                <button onClick={() => exportMarkdown(selected)} className="rounded-lg px-3 py-1 text-xs text-white" style={{ background: '#3498db' }}>MD</button>
                <button onClick={() => printPDF(selected)} className="rounded-lg px-3 py-1 text-xs text-white" style={{ background: '#e74c3c' }}>PDF</button>
                <button onClick={() => downloadXlsx(selected)} className="rounded-lg px-3 py-1 text-xs text-white" style={{ background: '#16a085' }}>XLSX</button>
                <button onClick={() => { setSelected(null); setEditing(false); }} className="rounded-lg p-1 text-white" style={{ background: 'transparent' }}><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {editing ? <textarea className="min-h-[380px] w-full rounded-xl border p-4 text-sm outline-none" style={{ background: '#111122', color: '#e8d5b7', borderColor: `${colorFor(selected)}44` }} value={draft} onChange={(e) => setDraft(e.target.value)} /> : <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#e8d5b7' }}>{currentContent}</pre>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FilesCenter;
