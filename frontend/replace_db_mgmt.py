#!/usr/bin/env python3
"""استبدال DatabaseManagement القديمة بنسخة كاملة تدمج table-proposal-system"""

import re

FILE = 'src/components/AdminDashboardV2.jsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# النسخة الجديدة الكاملة من DatabaseManagement
NEW_DB_MGMT = '''const DatabaseManagement = ({ language, t }) => {
  // ===== State =====
  const [activeSubTab, setActiveSubTab] = useState('browse');   // browse | propose | log | rollback
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState({});

  // propose state
  const [opType, setOpType] = useState(OPERATION_TYPES.ADD_COLUMN);
  const [propTable, setPropTable] = useState('');
  const [propPayload, setPropPayload] = useState({});
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [proposing, setProposing] = useState(false);

  // log state
  const [changeLog, setChangeLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('all');

  // stats
  const [stats, setStats] = useState({ pending:0, approved:0, rejected:0, created:0, failed:0, total:0 });

  // ===== Load =====
  useEffect(() => {
    loadTables();
    loadChangeLog();
    loadStats();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await getExistingTables();
      if (res.success) {
        setTables(res.tables.map(n => ({ name: n, label: n })));
      } else {
        // fallback: جداول ثابتة
        setTables([
          { name:'clinics', label:'clinics' },
          { name:'unified_queue', label:'unified_queue' },
          { name:'patients', label:'patients' },
          { name:'notifications', label:'notifications' },
          { name:'pins', label:'pins' },
          { name:'settings', label:'settings' },
          { name:'db_change_log', label:'db_change_log' },
          { name:'table_proposals', label:'table_proposals' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName) => {
    setLoading(true);
    setSelectedTable(tableName);
    setEditingRow(null);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        setTableData(data);
        if (data.length > 0) {
          setTableColumns(Object.keys(data[0]));
        } else {
          const colRes = await getTableColumns(tableName);
          setTableColumns(colRes.columns.map(c => c.name));
        }
      } else {
        setTableData([]);
        setTableColumns([]);
      }
    } catch (e) {
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChangeLog = async () => {
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from('db_change_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100);
      if (!error && data) setChangeLog(data);
    } finally {
      setLogLoading(false);
    }
  };

  const loadStats = async () => {
    const res = await getProposalStats();
    if (res.success) setStats(res.stats);
  };

  // ===== CRUD =====
  const saveRow = async (row) => {
    try {
      const { error } = await supabase.from(selectedTable).upsert(row);
      if (error) throw error;
      // تسجيل في db_change_log
      await supabase.from('db_change_log').insert({
        operation_type: 'update_row',
        table_name: selectedTable,
        change_description: `تعديل صف id=${row.id}`,
        sql_executed: `UPDATE ${selectedTable} SET ... WHERE id='${row.id}'`,
        status: 'success',
        executed_by: authService.getCurrentUser()?.username || 'admin',
        system_version: '3.0.0',
        environment: 'production',
        row_id: String(row.id),
        old_values: {},
        new_values: row,
      });
      setEditingRow(null);
      showSuccessToast(t('تم الحفظ بنجاح', 'Saved successfully'));
      loadTableData(selectedTable);
      loadChangeLog();
    } catch (e) {
      showErrorToast(t('خطأ في الحفظ: ' + e.message, 'Save error: ' + e.message));
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Confirm delete?'))) return;
    try {
      const { error } = await supabase.from(selectedTable).delete().eq('id', id);
      if (error) throw error;
      await supabase.from('db_change_log').insert({
        operation_type: 'delete_row',
        table_name: selectedTable,
        change_description: `حذف صف id=${id}`,
        sql_executed: `DELETE FROM ${selectedTable} WHERE id='${id}'`,
        status: 'success',
        executed_by: authService.getCurrentUser()?.username || 'admin',
        system_version: '3.0.0',
        environment: 'production',
        row_id: String(id),
      });
      showSuccessToast(t('تم الحذف', 'Deleted'));
      loadTableData(selectedTable);
      loadChangeLog();
    } catch (e) {
      showErrorToast(e.message);
    }
  };

  const addRow = async () => {
    try {
      const { error } = await supabase.from(selectedTable).insert(newRow);
      if (error) throw error;
      await supabase.from('db_change_log').insert({
        operation_type: 'insert_row',
        table_name: selectedTable,
        change_description: `إضافة صف جديد`,
        sql_executed: `INSERT INTO ${selectedTable} ...`,
        status: 'success',
        executed_by: authService.getCurrentUser()?.username || 'admin',
        system_version: '3.0.0',
        environment: 'production',
        new_values: newRow,
      });
      setShowAddModal(false);
      setNewRow({});
      showSuccessToast(t('تمت الإضافة', 'Added'));
      loadTableData(selectedTable);
      loadChangeLog();
    } catch (e) {
      showErrorToast(e.message);
    }
  };

  const exportTable = () => {
    const json = JSON.stringify(tableData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Propose =====
  const buildSQL = () => {
    const sql = generateSQL({ type: opType, payload: { table_name: propTable, ...propPayload } });
    setGeneratedSQL(sql);
  };

  const submitProposal = async () => {
    if (!propTable) { showErrorToast(t('أدخل اسم الجدول', 'Enter table name')); return; }
    if (!generatedSQL) { showErrorToast(t('أنشئ SQL أولاً', 'Generate SQL first')); return; }
    setProposing(true);
    try {
      const user = authService.getCurrentUser();
      const res = await saveProposal({
        type: opType,
        payload: { table_name: propTable, ...propPayload },
        proposedBy: user?.username || 'admin',
        featureName: opType,
        purpose: `تعديل ${propTable}`,
        goal: `تنفيذ ${opType} على ${propTable}`,
      });
      if (res.success) {
        showSuccessToast(t('تم حفظ الاقتراح بنجاح', 'Proposal saved'));
        setGeneratedSQL('');
        setPropPayload({});
        loadStats();
      } else {
        showErrorToast(res.error || t('فشل الحفظ', 'Save failed'));
      }
    } finally {
      setProposing(false);
    }
  };

  const executeProposal = async (proposalId) => {
    if (!window.confirm(t('تأكيد تنفيذ هذا التعديل مباشرة في قاعدة البيانات؟', 'Confirm execute this change in DB?'))) return;
    try {
      const user = authService.getCurrentUser();
      const res = await approveAndExecute(proposalId, user?.username || 'admin', 'موافقة من لوحة الإدارة');
      if (res.success) {
        showSuccessToast(t('تم التنفيذ بنجاح ✅', 'Executed successfully ✅'));
        loadStats();
        loadChangeLog();
      } else {
        showErrorToast(t('فشل التنفيذ: ' + res.error, 'Execution failed: ' + res.error));
      }
    } catch (e) {
      showErrorToast(e.message);
    }
  };

  const rejectProp = async (proposalId) => {
    try {
      const user = authService.getCurrentUser();
      await rejectProposal(proposalId, user?.username || 'admin', 'رفض من لوحة الإدارة');
      showSuccessToast(t('تم الرفض', 'Rejected'));
      loadStats();
    } catch (e) {
      showErrorToast(e.message);
    }
  };

  // ===== Rollback =====
  const rollbackChange = async (logEntry) => {
    if (!logEntry.rollback_sql) {
      showErrorToast(t('لا يوجد SQL للتراجع', 'No rollback SQL available'));
      return;
    }
    if (!window.confirm(t('تأكيد التراجع عن هذا التعديل؟', 'Confirm rollback this change?'))) return;
    try {
      const user = authService.getCurrentUser();
      // تنفيذ rollback_sql عبر RPC أو تسجيله
      const { error } = await supabase.rpc('exec_sql', { sql_query: logEntry.rollback_sql }).catch(() => ({ error: { message: 'RPC غير متاح' } }));
      // تسجيل التراجع
      await supabase.from('db_change_log').insert({
        operation_type: 'rollback',
        table_name: logEntry.table_name,
        change_description: `تراجع عن: ${logEntry.change_description}`,
        sql_executed: logEntry.rollback_sql,
        status: error ? 'failed' : 'success',
        executed_by: user?.username || 'admin',
        system_version: '3.0.0',
        environment: 'production',
        related_change_id: logEntry.id,
      });
      // تحديث السجل الأصلي
      await supabase.from('db_change_log').update({
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: user?.username || 'admin',
      }).eq('id', logEntry.id);
      if (error) {
        showErrorToast(t('تم تسجيل التراجع لكن التنفيذ يحتاج صلاحيات أعلى', 'Rollback logged, needs higher privileges to execute'));
      } else {
        showSuccessToast(t('تم التراجع بنجاح ✅', 'Rolled back successfully ✅'));
      }
      loadChangeLog();
    } catch (e) {
      showErrorToast(e.message);
    }
  };

  // ===== Filtered Log =====
  const filteredLog = logFilter === 'all'
    ? changeLog
    : changeLog.filter(l => l.operation_type === logFilter || l.status === logFilter);

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Database size={24} className="text-[#C9A54C]" />
          {t('إدارة قاعدة البيانات', 'Database Management')}
        </h3>
        {/* Stats */}
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg">{t('معلق','Pending')}: {stats.pending}</span>
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg">{t('منفذ','Done')}: {stats.created}</span>
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg">{t('مرفوض','Rejected')}: {stats.rejected}</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id:'browse',   icon: Database,  label: t('تصفح البيانات','Browse Data') },
          { id:'propose',  icon: Plus,      label: t('تعديل هيكل DB','Modify Schema') },
          { id:'log',      icon: History,   label: t('سجل التغييرات','Change Log') },
          { id:'rollback', icon: RefreshCw, label: t('التراجع','Rollback') },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSubTab === tab.id ? 'bg-[#C9A54C] text-black' : 'bg-white/5 hover:bg-white/10'
            }`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: BROWSE ===== */}
      {activeSubTab === 'browse' && (
        <div className="space-y-4">
          {/* Table selector */}
          <div className="flex flex-wrap gap-2">
            {tables.map(tbl => (
              <button key={tbl.name} onClick={() => loadTableData(tbl.name)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  selectedTable === tbl.name ? 'bg-[#C9A54C] text-black font-medium' : 'bg-white/5 hover:bg-white/10'
                }`}>
                {tbl.label}
              </button>
            ))}
          </div>

          {selectedTable && (
            <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
              {/* Toolbar */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
                <span className="font-medium text-[#C9A54C]">{selectedTable}</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
                    <Plus size={14}/> {t('إضافة','Add')}
                  </button>
                  <button onClick={exportTable}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#C9A54C]/20 text-[#C9A54C] rounded-lg text-sm">
                    <Download size={14}/> {t('تصدير','Export')}
                  </button>
                  <button onClick={() => loadTableData(selectedTable)}
                    className="p-1.5 bg-white/10 rounded-lg">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto mb-2" size={24}/>{t('جاري التحميل...','Loading...')}</div>
              ) : tableData.length === 0 ? (
                <div className="p-8 text-center text-gray-400">{t('لا توجد بيانات','No data')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        {tableColumns.slice(0,7).map(col => (
                          <th key={col} className="px-3 py-2 text-left text-gray-300 font-medium whitespace-nowrap">{col}</th>
                        ))}
                        <th className="px-3 py-2 text-left text-gray-300 font-medium">{t('إجراءات','Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tableData.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-white/5">
                          {tableColumns.slice(0,7).map(col => (
                            <td key={col} className="px-3 py-2">
                              {editingRow?.id === row.id ? (
                                <input type="text" value={editingRow[col] ?? ''}
                                  onChange={e => setEditingRow({...editingRow, [col]: e.target.value})}
                                  className="bg-white/10 border border-white/20 rounded px-2 py-0.5 w-full text-xs"/>
                              ) : (
                                <span className="truncate block max-w-[120px] text-xs">
                                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '-')}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {editingRow?.id === row.id ? (
                                <>
                                  <button onClick={() => saveRow(editingRow)} className="p-1 bg-green-500/20 text-green-400 rounded"><Save size={12}/></button>
                                  <button onClick={() => setEditingRow(null)} className="p-1 bg-white/10 rounded"><X size={12}/></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => setEditingRow({...row})} className="p-1 bg-white/10 hover:bg-white/20 rounded"><Edit size={12}/></button>
                                  <button onClick={() => deleteRow(row.id)} className="p-1 bg-red-500/20 text-red-400 rounded"><Trash2 size={12}/></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: PROPOSE ===== */}
      {activeSubTab === 'propose' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-5 space-y-4">
            <h4 className="font-bold text-[#C9A54C]">{t('تعديل هيكل قاعدة البيانات','Modify Database Schema')}</h4>

            {/* Operation Type */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{t('نوع العملية','Operation Type')}</label>
              <select value={opType} onChange={e => { setOpType(e.target.value); setGeneratedSQL(''); }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm">
                {Object.entries(OPERATION_TYPES).map(([k,v]) => (
                  <option key={k} value={v} className="bg-[#1a1a2e]">{v}</option>
                ))}
              </select>
            </div>

            {/* Table Name */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{t('اسم الجدول','Table Name')}</label>
              <input type="text" value={propTable} onChange={e => setPropTable(e.target.value)}
                placeholder="e.g. clinics"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"/>
            </div>

            {/* Dynamic Payload Fields */}
            {opType === OPERATION_TYPES.ADD_COLUMN && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('اسم العمود','Column Name')}</label>
                  <input type="text" placeholder="column_name"
                    onChange={e => setPropPayload(p => ({...p, column: {...(p.column||{}), name: e.target.value}}))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('نوع البيانات','Data Type')}</label>
                  <select onChange={e => setPropPayload(p => ({...p, column: {...(p.column||{}), type: e.target.value}}))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm">
                    {COLUMN_TYPES.map(ct => <option key={ct} value={ct} className="bg-[#1a1a2e]">{ct}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('القيمة الافتراضية','Default Value')}</label>
                  <input type="text" placeholder="NULL"
                    onChange={e => setPropPayload(p => ({...p, column: {...(p.column||{}), default_value: e.target.value}}))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"/>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="not_null"
                    onChange={e => setPropPayload(p => ({...p, column: {...(p.column||{}), not_null: e.target.checked}}))}/>
                  <label htmlFor="not_null" className="text-sm">{t('NOT NULL','NOT NULL')}</label>
                  <input type="checkbox" id="unique" className="ml-2"
                    onChange={e => setPropPayload(p => ({...p, column: {...(p.column||{}), unique: e.target.checked}}))}/>
                  <label htmlFor="unique" className="text-sm">{t('UNIQUE','UNIQUE')}</label>
                </div>
              </div>
            )}

            {opType === OPERATION_TYPES.RENAME_COLUMN && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('الاسم القديم','Old Name')}</label>
                  <input type="text" onChange={e => setPropPayload(p => ({...p, old_name: e.target.value}))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('الاسم الجديد','New Name')}</label>
                  <input type="text" onChange={e => setPropPayload(p => ({...p, new_name: e.target.value}))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"/>
                </div>
              </div>
            )}

            {opType === OPERATION_TYPES.DROP_COLUMN && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('اسم العمود للحذف','Column to Drop')}</label>
                <input type="text" onChange={e => setPropPayload(p => ({...p, column_name: e.target.value}))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"/>
              </div>
            )}

            {/* Generate + Submit */}
            <div className="flex gap-3">
              <button onClick={buildSQL}
                className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all">
                {t('توليد SQL','Generate SQL')}
              </button>
              <button onClick={submitProposal} disabled={proposing || !generatedSQL}
                className="flex-1 py-2 bg-[#C9A54C] text-black rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
                {proposing ? t('جاري الحفظ...','Saving...') : t('حفظ الاقتراح','Save Proposal')}
              </button>
            </div>

            {/* Generated SQL Preview */}
            {generatedSQL && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('SQL المولّد','Generated SQL')}</label>
                <pre className="bg-black/30 rounded-lg p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">{generatedSQL}</pre>
              </div>
            )}
          </div>

          {/* Pending Proposals */}
          <PendingProposals t={t} language={language}
            onExecute={executeProposal} onReject={rejectProp} />
        </div>
      )}

      {/* ===== TAB: LOG ===== */}
      {activeSubTab === 'log' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all','insert_row','update_row','delete_row','add_column','rollback','create_table','success','failed'].map(f => (
              <button key={f} onClick={() => setLogFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${logFilter===f ? 'bg-[#C9A54C] text-black' : 'bg-white/5 hover:bg-white/10'}`}>
                {f}
              </button>
            ))}
            <button onClick={loadChangeLog} className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10">
              <RefreshCw size={12} className={logLoading ? 'animate-spin inline' : 'inline'}/> {t('تحديث','Refresh')}
            </button>
          </div>

          {logLoading ? (
            <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" size={24}/></div>
          ) : filteredLog.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{t('لا توجد سجلات','No records')}</div>
          ) : (
            <div className="space-y-2">
              {filteredLog.map(entry => (
                <div key={entry.id}
                  className={`bg-gradient-to-br from-[#8A1538]/60 to-[#6B0F2A]/60 rounded-xl border p-4 ${
                    entry.status === 'success' ? 'border-green-500/20' :
                    entry.status === 'failed'  ? 'border-red-500/20' : 'border-white/10'
                  }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          entry.status === 'success' ? 'bg-green-500/20 text-green-400' :
                          entry.status === 'failed'  ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>{entry.status}</span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{entry.operation_type}</span>
                        <span className="text-xs text-[#C9A54C]">{entry.table_name}</span>
                        {entry.rolled_back_at && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{t('تم التراجع','Rolled Back')}</span>
                        )}
                      </div>
                      <p className="text-sm mt-1 truncate">{entry.change_description}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>👤 {entry.executed_by}</span>
                        <span>🕒 {entry.executed_at ? new Date(entry.executed_at).toLocaleString('ar-SA') : '-'}</span>
                        {entry.system_version && <span>v{entry.system_version}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {entry.sql_executed && (
                        <button onClick={() => alert(entry.sql_executed)}
                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg" title={t('عرض SQL','View SQL')}>
                          <Eye size={12}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: ROLLBACK ===== */}
      {activeSubTab === 'rollback' && (
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400">
            ⚠️ {t('التراجع يعكس التغييرات في قاعدة البيانات. تأكد قبل التنفيذ.','Rollback reverses DB changes. Confirm before executing.')}
          </div>
          {changeLog.filter(l => l.rollback_sql && !l.rolled_back_at).length === 0 ? (
            <div className="text-center py-8 text-gray-400">{t('لا توجد تغييرات قابلة للتراجع','No rollbackable changes')}</div>
          ) : (
            <div className="space-y-2">
              {changeLog.filter(l => l.rollback_sql && !l.rolled_back_at).map(entry => (
                <div key={entry.id}
                  className="bg-gradient-to-br from-[#8A1538]/60 to-[#6B0F2A]/60 rounded-xl border border-white/10 p-4">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{entry.operation_type}</span>
                        <span className="text-xs text-[#C9A54C]">{entry.table_name}</span>
                      </div>
                      <p className="text-sm mt-1">{entry.change_description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        👤 {entry.executed_by} — 🕒 {entry.executed_at ? new Date(entry.executed_at).toLocaleString('ar-SA') : '-'}
                      </p>
                    </div>
                    <button onClick={() => rollbackChange(entry)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-xl text-sm font-medium transition-all shrink-0">
                      <RefreshCw size={14}/> {t('تراجع','Rollback')}
                    </button>
                  </div>
                  {entry.rollback_sql && (
                    <pre className="mt-2 bg-black/30 rounded-lg p-2 text-xs text-orange-300 overflow-x-auto whitespace-pre-wrap">{entry.rollback_sql}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Row Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h4 className="text-lg font-bold mb-4">{t('إضافة سجل جديد','Add New Record')} — {selectedTable}</h4>
            {tableColumns.filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at').map(col => (
              <div key={col} className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">{col}</label>
                <input type="text" value={newRow[col] || ''}
                  onChange={e => setNewRow({...newRow, [col]: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"/>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowAddModal(false); setNewRow({}); }}
                className="flex-1 px-4 py-2 bg-white/10 rounded-lg text-sm">{t('إلغاء','Cancel')}</button>
              <button onClick={addRow}
                className="flex-1 px-4 py-2 bg-[#C9A54C] text-black font-medium rounded-lg text-sm">{t('إضافة','Add')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// مكون مساعد: عرض الاقتراحات المعلقة
const PendingProposals = ({ t, language, onExecute, onReject }) => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const res = await getProposals('pending');
      if (res.success) setProposals(res.proposals);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4"><RefreshCw className="animate-spin mx-auto" size={20}/></div>;
  if (proposals.length === 0) return (
    <div className="text-center py-4 text-gray-400 text-sm">{t('لا توجد اقتراحات معلقة','No pending proposals')}</div>
  );

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm text-gray-300">{t('الاقتراحات المعلقة','Pending Proposals')} ({proposals.length})</h5>
      {proposals.map(p => (
        <div key={p.id} className="bg-gradient-to-br from-[#8A1538]/60 to-[#6B0F2A]/60 rounded-xl border border-yellow-500/20 p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{p.operation_type}</span>
                <span className="text-xs text-[#C9A54C]">{p.table_name}</span>
              </div>
              <p className="text-sm mt-1">{p.purpose}</p>
              <p className="text-xs text-gray-400 mt-0.5">👤 {p.proposed_by} — 🕒 {new Date(p.created_at).toLocaleString('ar-SA')}</p>
              {p.sql_generated && (
                <pre className="mt-2 bg-black/30 rounded p-2 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">{p.sql_generated}</pre>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => { onExecute(p.id); loadProposals(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-xs font-medium">
                <Play size={12}/> {t('تنفيذ','Execute')}
              </button>
              <button onClick={() => { onReject(p.id); loadProposals(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-medium">
                <X size={12}/> {t('رفض','Reject')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
'''

# استبدال DatabaseManagement القديمة
# نجد بداية ونهاية الدالة القديمة
start_marker = 'const DatabaseManagement = ({ language, t }) => {'
end_marker = '// المكون الرئيسي'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print('ERROR: لم يتم العثور على DatabaseManagement')
    exit(1)

if end_idx == -1:
    print('ERROR: لم يتم العثور على نهاية DatabaseManagement')
    exit(1)

# استبدال الجزء القديم بالجديد
new_content = content[:start_idx] + NEW_DB_MGMT + '\n' + content[end_idx:]

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(new_content)

# التحقق
with open(FILE, 'r', encoding='utf-8') as f:
    result = f.read()

lines = result.count('\n')
has_new = 'activeSubTab' in result and 'db_change_log' in result and 'rollbackChange' in result
print(f'✅ تم الاستبدال بنجاح')
print(f'   الحجم الجديد: {lines} سطر')
print(f'   activeSubTab: {"✅" if "activeSubTab" in result else "❌"}')
print(f'   db_change_log: {"✅" if "db_change_log" in result else "❌"}')
print(f'   rollbackChange: {"✅" if "rollbackChange" in result else "❌"}')
print(f'   PendingProposals: {"✅" if "PendingProposals" in result else "❌"}')
print(f'   table-proposal-system import: {"✅" if "table-proposal-system" in result else "❌"}')
