/**
 * شاشة التقارير الشاملة
 * Comprehensive Reports Panel
 * 
 * تقارير يومية، أسبوعية، شهرية، نصف سنوية، سنوية
 * مع إمكانية الطباعة والتصدير والإرسال
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Send, 
  Filter,
  Calendar,
  Table2,
  BarChart3,
  RefreshCw,
  CheckSquare,
  Square,
  X,
  FileSpreadsheet,
  FilePdf,
  Mail,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { 
  getAllLogs, 
  filterLogsByPeriod, 
  getLogStatistics, 
  exportLogsAsCSV,
  exportLogsAsJSON,
  ActivityTypes 
} from '../lib/activityLogger';

// تعريف الأعمدة المتاحة
const AVAILABLE_COLUMNS = [
  { id: 'timestamp', label: 'التاريخ والوقت', labelEn: 'Date & Time', default: true },
  { id: 'patientMilitaryId', label: 'الرقم العسكري', labelEn: 'Military ID', default: true },
  { id: 'gender', label: 'الجنس', labelEn: 'Gender', default: true },
  { id: 'examTypeName', label: 'نوع الفحص', labelEn: 'Exam Type', default: true },
  { id: 'clinicName', label: 'العيادة', labelEn: 'Clinic', default: true },
  { id: 'queueNumber', label: 'رقم الدور', labelEn: 'Queue Number', default: true },
  { id: 'type', label: 'نوع العملية', labelEn: 'Operation Type', default: false },
  { id: 'duration', label: 'المدة (ثانية)', labelEn: 'Duration (sec)', default: false },
  { id: 'result', label: 'النتيجة', labelEn: 'Result', default: false },
  { id: 'entryTime', label: 'وقت الدخول', labelEn: 'Entry Time', default: false },
  { id: 'exitTime', label: 'وقت الخروج', labelEn: 'Exit Time', default: false },
  { id: 'deviceId', label: 'رقم الجهاز', labelEn: 'Device ID', default: false },
  { id: 'notes', label: 'ملاحظات', labelEn: 'Notes', default: false }
];

// تعريف أنواع العمليات بالعربي
const OPERATION_TYPES_AR = {
  [ActivityTypes.PATIENT_REGISTERED]: 'تسجيل مراجع',
  [ActivityTypes.PATIENT_SELECTED_EXAM]: 'اختيار فحص',
  [ActivityTypes.PATIENT_GOT_TICKET]: 'حصول على رقم',
  [ActivityTypes.PATIENT_ENTERED_CLINIC]: 'دخول عيادة',
  [ActivityTypes.PATIENT_EXITED_CLINIC]: 'خروج من عيادة',
  [ActivityTypes.PATIENT_COMPLETED_EXAM]: 'إكمال الفحص',
  [ActivityTypes.PATIENT_SKIPPED]: 'تخطي مراجع',
  [ActivityTypes.ADMIN_LOGIN]: 'دخول إدارة',
  [ActivityTypes.ADMIN_LOGOUT]: 'خروج إدارة',
  [ActivityTypes.SYSTEM_AUTO_SKIP]: 'تخطي تلقائي',
  [ActivityTypes.SYSTEM_AUTO_COMPLETE]: 'إكمال تلقائي'
};

const ReportsPanel = ({ isOpen, onClose, language = 'ar' }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [period, setPeriod] = useState('today');
  const [selectedColumns, setSelectedColumns] = useState(
    AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id)
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const tableRef = useRef(null);

  // تحميل البيانات
  const loadData = () => {
    setIsLoading(true);
    const allLogs = filterLogsByPeriod(period);
    setLogs(allLogs);
    setStats(getLogStatistics(allLogs));
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, period]);

  // فلترة البيانات
  useEffect(() => {
    let result = [...logs];
    
    // فلترة حسب البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.patientMilitaryId?.toLowerCase().includes(term) ||
        log.clinicName?.toLowerCase().includes(term) ||
        log.examTypeName?.toLowerCase().includes(term)
      );
    }
    
    // فلترة حسب نوع العملية
    if (selectedTypes.length > 0) {
      result = result.filter(log => selectedTypes.includes(log.type));
    }
    
    // الترتيب
    result.sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    
    setFilteredLogs(result);
  }, [logs, searchTerm, selectedTypes, sortConfig]);

  // تبديل عمود
  const toggleColumn = (columnId) => {
    setSelectedColumns(prev => 
      prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  // تبديل نوع العملية
  const toggleOperationType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // الترتيب
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // تنسيق القيمة للعرض
  const formatValue = (log, columnId) => {
    const value = log[columnId];
    if (value === null || value === undefined) return '-';
    
    switch (columnId) {
      case 'timestamp':
        return new Date(value).toLocaleString('ar-SA');
      case 'gender':
        return value === 'male' ? 'ذكر' : 'أنثى';
      case 'type':
        return OPERATION_TYPES_AR[value] || value;
      case 'duration':
        return value ? `${Math.round(value / 60)} د` : '-';
      case 'entryTime':
      case 'exitTime':
        return value ? new Date(value).toLocaleTimeString('ar-SA') : '-';
      default:
        return value;
    }
  };

  // طباعة التقرير
  const handlePrint = () => {
    const printContent = generatePrintHTML();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // إنشاء HTML للطباعة
  const generatePrintHTML = () => {
    const selectedColumnDefs = AVAILABLE_COLUMNS.filter(c => selectedColumns.includes(c.id));
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير المركز الطبي</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; }
          .header img { width: 80px; height: 80px; }
          .header h1 { margin: 10px 0; font-size: 24px; }
          .header p { color: #666; margin: 5px 0; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .stat-item { text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #333; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 11px; }
          th { background: #8A1538; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>قيادة الخدمات الطبية</h1>
          <p>المركز الطبي المتخصص العسكري - العطار</p>
          <p>تقرير ${periodLabels[period]} - ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${stats?.uniquePatients || 0}</div>
            <div class="stat-label">إجمالي المراجعين</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats?.completedExams || 0}</div>
            <div class="stat-label">فحوصات مكتملة</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats?.avgDuration ? Math.round(stats.avgDuration / 60) : 0} د</div>
            <div class="stat-label">متوسط الانتظار</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats?.skippedPatients || 0}</div>
            <div class="stat-label">تم تخطيهم</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              ${selectedColumnDefs.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredLogs.map(log => `
              <tr>
                ${selectedColumnDefs.map(col => `<td>${formatValue(log, col.id)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة نظام إدارة الطوابير الطبية</p>
          <p>${new Date().toLocaleString('ar-SA')}</p>
        </div>
      </body>
      </html>
    `;
  };

  // تصدير CSV
  const handleExportCSV = () => {
    const csv = exportLogsAsCSV(filteredLogs, selectedColumns);
    downloadFile(csv, `report_${period}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  // تصدير JSON
  const handleExportJSON = () => {
    const json = exportLogsAsJSON(filteredLogs);
    downloadFile(json, `report_${period}_${Date.now()}.json`, 'application/json');
  };

  // تحميل ملف
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // إرسال التقرير
  const handleSendReport = () => {
    const subject = encodeURIComponent(`تقرير المركز الطبي - ${periodLabels[period]}`);
    const body = encodeURIComponent(`
تقرير ${periodLabels[period]}
التاريخ: ${new Date().toLocaleDateString('ar-SA')}

إجمالي المراجعين: ${stats?.uniquePatients || 0}
فحوصات مكتملة: ${stats?.completedExams || 0}
متوسط الانتظار: ${stats?.avgDuration ? Math.round(stats.avgDuration / 60) : 0} دقيقة
تم تخطيهم: ${stats?.skippedPatients || 0}

---
تم إنشاء هذا التقرير بواسطة نظام إدارة الطوابير الطبية
    `);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const periodLabels = {
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    halfYear: 'نصف سنة',
    year: 'هذه السنة'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-gray-900/95 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-700/50 shadow-2xl flex flex-col">
        {/* الهيدر */}
        <div className="bg-gradient-to-r from-[#8A1538]/50 to-[#C9A54C]/30 p-4 border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#8A1538]/30 rounded-lg">
                <FileText className="w-6 h-6 text-[#C9A54C]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">التقارير والإحصائيات</h2>
                <p className="text-gray-400 text-sm">{filteredLogs.length} سجل</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* شريط الأدوات */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {/* فلتر الفترة */}
            <div className="flex gap-1 flex-wrap">
              {Object.entries(periodLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    period === key
                      ? 'bg-[#8A1538] text-white'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <div className="flex-1" />
            
            {/* أزرار الإجراءات */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-[#8A1538] text-white' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'}`}
              title="الفلاتر"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className={`p-2 rounded-lg transition-colors ${showColumnSelector ? 'bg-[#8A1538] text-white' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'}`}
              title="اختيار الأعمدة"
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={loadData}
              className="p-2 bg-gray-700/50 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-6 w-px bg-gray-700" />
            <button
              onClick={handlePrint}
              className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
              title="تصدير Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={handleSendReport}
              className="p-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg transition-colors"
              title="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* الفلاتر */}
        {showFilters && (
          <div className="p-4 bg-gray-800/50 border-b border-gray-700/50 flex-shrink-0">
            <div className="flex flex-wrap gap-4">
              {/* البحث */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg py-2 pr-10 pl-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#8A1538]"
                  />
                </div>
              </div>
              
              {/* فلتر نوع العملية */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(OPERATION_TYPES_AR).slice(0, 6).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => toggleOperationType(type)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      selectedTypes.includes(type)
                        ? 'bg-[#8A1538] text-white'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* اختيار الأعمدة */}
        {showColumnSelector && (
          <div className="p-4 bg-gray-800/50 border-b border-gray-700/50 flex-shrink-0">
            <p className="text-gray-400 text-sm mb-2">اختر الأعمدة للعرض والطباعة:</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLUMNS.map(col => (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    selectedColumns.includes(col.id)
                      ? 'bg-[#8A1538] text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {selectedColumns.includes(col.id) ? (
                    <CheckSquare className="w-3 h-3" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* الإحصائيات السريعة */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-800/30 flex-shrink-0">
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.uniquePatients || 0}</div>
              <div className="text-xs text-gray-400">إجمالي المراجعين</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.completedExams || 0}</div>
              <div className="text-xs text-gray-400">فحوصات مكتملة</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.avgDuration ? Math.round(stats.avgDuration / 60) : 0} د</div>
              <div className="text-xs text-gray-400">متوسط الانتظار</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.skippedPatients || 0}</div>
              <div className="text-xs text-gray-400">تم تخطيهم</div>
            </div>
          </div>
        )}
        
        {/* الجدول */}
        <div className="flex-1 overflow-auto p-4" ref={tableRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-[#8A1538] animate-spin" />
            </div>
          ) : filteredLogs.length > 0 ? (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-900">
                <tr>
                  {AVAILABLE_COLUMNS.filter(c => selectedColumns.includes(c.id)).map(col => (
                    <th 
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      className="bg-[#8A1538]/80 text-white text-right p-3 text-sm font-semibold cursor-pointer hover:bg-[#8A1538] transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortConfig.key === col.id && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr 
                    key={log.id || index}
                    className={`border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors ${
                      index % 2 === 0 ? 'bg-gray-800/20' : ''
                    }`}
                  >
                    {AVAILABLE_COLUMNS.filter(c => selectedColumns.includes(c.id)).map(col => (
                      <td key={col.id} className="p-3 text-gray-300 text-sm whitespace-nowrap">
                        {formatValue(log, col.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد بيانات للعرض</p>
            </div>
          )}
        </div>
        
        {/* الفوتر */}
        <div className="p-3 bg-gray-800/50 border-t border-gray-700/50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>إجمالي السجلات: {filteredLogs.length}</span>
            <span>آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPanel;
