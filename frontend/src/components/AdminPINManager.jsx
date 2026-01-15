import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase-client'

/**
 * Admin PIN Manager Component
 * Allows admins to view, create, activate/deactivate, and delete PIN codes
 */
export default function AdminPINManager() {
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState('all')
  const [message, setMessage] = useState({ type: '', text: '' })

  const clinics = [
    { id: 'all', name: 'جميع العيادات' },
    { id: 'lab', name: 'المختبر والأشعة' },
    { id: 'vitals', name: 'القياسات الحيوية' },
    { id: 'dental', name: 'الأسنان' },
    { id: 'eye', name: 'العيون' },
    { id: 'ent', name: 'الأنف والأذن والحنجرة' },
    { id: 'surgery', name: 'الجراحة' },
    { id: 'internal', name: 'الباطنية' },
    { id: 'aviation', name: 'الطيران' },
    { id: 'final', name: 'اللجنة النهائية' }
  ]

  useEffect(() => {
    loadPins()
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel('pins_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pins' }, 
        (payload) => {
          console.log('[AdminPINManager] Realtime update:', payload)
          loadPins()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadPins() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pins')
        .select('*')
        .order('clinic_code', { ascending: true })
        .order('generated_at', { ascending: false })

      if (error) throw error

      setPins(data || [])
    } catch (error) {
      console.error('[AdminPINManager] Error loading pins:', error)
      showMessage('error', 'فشل تحميل البن كود')
    } finally {
      setLoading(false)
    }
  }

  async function createPin() {
    if (!selectedClinic || selectedClinic === 'all') {
      showMessage('error', 'الرجاء اختيار عيادة محددة')
      return
    }

    try {
      setCreating(true)
      
      // Generate random 4-digit PIN
      const pin = String(Math.floor(1000 + Math.random() * 9000))
      
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('pins')
        .insert({
          clinic_code: selectedClinic,
          pin: pin,
          is_active: true,
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (error) throw error

      showMessage('success', `تم إنشاء البن كود ${pin} بنجاح`)
      loadPins()
    } catch (error) {
      console.error('[AdminPINManager] Error creating pin:', error)
      showMessage('error', 'فشل إنشاء البن كود')
    } finally {
      setCreating(false)
    }
  }

  async function togglePin(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('pins')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      showMessage('success', currentStatus ? 'تم إلغاء تفعيل البن كود' : 'تم تفعيل البن كود')
      loadPins()
    } catch (error) {
      console.error('[AdminPINManager] Error toggling pin:', error)
      showMessage('error', 'فشل تحديث حالة البن كود')
    }
  }

  async function deletePin(id) {
    if (!confirm('هل أنت متأكد من حذف هذا البن كود؟')) {
      return
    }

    try {
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', id)

      if (error) throw error

      showMessage('success', 'تم حذف البن كود بنجاح')
      loadPins()
    } catch (error) {
      console.error('[AdminPINManager] Error deleting pin:', error)
      showMessage('error', 'فشل حذف البن كود')
    }
  }

  async function deactivateExpired() {
    try {
      const now = new Date().toISOString()
      
      const { error } = await supabase
        .from('pins')
        .update({ is_active: false })
        .lt('expires_at', now)
        .eq('is_active', true)

      if (error) throw error

      showMessage('success', 'تم إلغاء تفعيل البن كود المنتهية')
      loadPins()
    } catch (error) {
      console.error('[AdminPINManager] Error deactivating expired:', error)
      showMessage('error', 'فشل إلغاء تفعيل البن كود المنتهية')
    }
  }

  function showMessage(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  function getClinicName(code) {
    const clinic = clinics.find(c => c.id === code)
    return clinic ? clinic.name : code
  }

  function isExpired(expiresAt) {
    return new Date(expiresAt) < new Date()
  }

  const activePins = pins.filter(p => p.is_active && !isExpired(p.expires_at))
  const inactivePins = pins.filter(p => !p.is_active || isExpired(p.expires_at))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">إدارة البن كود</h2>
        <p className="text-gray-600">عرض وإدارة جميع رموز البن الخاصة بالعيادات</p>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 p-4 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">اختر العيادة</label>
          <select
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            {clinics.map(clinic => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={createPin}
          disabled={creating || selectedClinic === 'all'}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {creating ? 'جاري الإنشاء...' : '➕ إنشاء بن جديد'}
        </button>
        <button
          onClick={deactivateExpired}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          🔄 إلغاء المنتهية
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded-lg">
          <div className="text-sm text-gray-600">البن النشطة</div>
          <div className="text-3xl font-bold text-green-800">{activePins.length}</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-600">البن غير النشطة</div>
          <div className="text-3xl font-bold text-gray-800">{inactivePins.length}</div>
        </div>
        <div className="bg-blue-100 p-4 rounded-lg">
          <div className="text-sm text-gray-600">المجموع</div>
          <div className="text-3xl font-bold text-blue-800">{pins.length}</div>
        </div>
      </div>

      {/* Active PINs Table */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">البن النشطة ({activePins.length})</h3>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-right">البن</th>
                <th className="border p-3 text-right">العيادة</th>
                <th className="border p-3 text-right">تاريخ الإنشاء</th>
                <th className="border p-3 text-right">تاريخ الانتهاء</th>
                <th className="border p-3 text-right">الحالة</th>
                <th className="border p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {activePins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="border p-4 text-center text-gray-500">
                    لا توجد بن نشطة
                  </td>
                </tr>
              ) : (
                activePins.map(pin => (
                  <tr key={pin.id} className="hover:bg-gray-50">
                    <td className="border p-3 text-center">
                      <span className="text-2xl font-bold text-blue-600">{pin.pin}</span>
                    </td>
                    <td className="border p-3">{getClinicName(pin.clinic_code)}</td>
                    <td className="border p-3 text-sm">
                      {new Date(pin.generated_at).toLocaleString('ar-QA')}
                    </td>
                    <td className="border p-3 text-sm">
                      {new Date(pin.expires_at).toLocaleString('ar-QA')}
                    </td>
                    <td className="border p-3">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        ✅ نشط
                      </span>
                    </td>
                    <td className="border p-3 text-center">
                      <button
                        onClick={() => togglePin(pin.id, pin.is_active)}
                        className="mx-1 px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                      >
                        ⏸️ إلغاء التفعيل
                      </button>
                      <button
                        onClick={() => deletePin(pin.id)}
                        className="mx-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        🗑️ حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactive PINs Table */}
      <div>
        <h3 className="text-xl font-bold mb-4">البن غير النشطة ({inactivePins.length})</h3>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-right">البن</th>
                <th className="border p-3 text-right">العيادة</th>
                <th className="border p-3 text-right">تاريخ الإنشاء</th>
                <th className="border p-3 text-right">تاريخ الانتهاء</th>
                <th className="border p-3 text-right">الحالة</th>
                <th className="border p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {inactivePins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="border p-4 text-center text-gray-500">
                    لا توجد بن غير نشطة
                  </td>
                </tr>
              ) : (
                inactivePins.map(pin => (
                  <tr key={pin.id} className="hover:bg-gray-50 opacity-60">
                    <td className="border p-3 text-center">
                      <span className="text-2xl font-bold text-gray-400">{pin.pin}</span>
                    </td>
                    <td className="border p-3">{getClinicName(pin.clinic_code)}</td>
                    <td className="border p-3 text-sm">
                      {new Date(pin.generated_at).toLocaleString('ar-QA')}
                    </td>
                    <td className="border p-3 text-sm">
                      {new Date(pin.expires_at).toLocaleString('ar-QA')}
                    </td>
                    <td className="border p-3">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {isExpired(pin.expires_at) ? '⏰ منتهي' : '⏸️ غير نشط'}
                      </span>
                    </td>
                    <td className="border p-3 text-center">
                      {!isExpired(pin.expires_at) && (
                        <button
                          onClick={() => togglePin(pin.id, pin.is_active)}
                          className="mx-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          ▶️ تفعيل
                        </button>
                      )}
                      <button
                        onClick={() => deletePin(pin.id)}
                        className="mx-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        🗑️ حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
