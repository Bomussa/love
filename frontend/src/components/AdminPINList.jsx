import React, { useState, useEffect } from 'react'
import {
  Shield,
  RefreshCw,
  Printer,
  Download,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import api from '../lib/api-unified'

/**
 * مكون قائمة PIN لجميع العيادات
 * يعرض جميع العيادات مع أرقام PIN الخاصة بها
 * يدعم الطباعة والتحديث التلقائي
 */
export function AdminPINList({ language = 'ar' }) {
  const [clinics, setClinics] = useState([])
  const [pins, setPins] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoGenStatus, setAutoGenStatus] = useState({
    nextGeneration: null,
    nextDeletion: null,
    isScheduled: true
  })

  const isRTL = language === 'ar'

  useEffect(() => {
    loadAllPINs()
    // تحديث كل دقيقة
    const interval = setInterval(loadAllPINs, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadAllPINs = async () => {
    try {
      setLoading(true)
      
      // جلب جميع العيادات مع الـ PINs الخاصة بها باستخدام الدالة الموحدة
      const res = await api.getClinicsWithPins()
      if (res.success) {
        setClinics(res.data)
        
        const pinsData = {}
        res.data.forEach(item => {
          pinsData[item.id] = {
            pin: item.pin_code || null,
            expiresAt: item.pin_expires_at,
            status: item.pin_status || 'none'
          }
        })
        setPins(pinsData)
      }
      
      // حساب أوقات الإنشاء والحذف التالية
      calculateNextSchedule()
      
      setLastUpdate(new Date())
    } catch (err) {
      console.error('[AdminPINList] Error loading PINs:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateNextSchedule = () => {
    const now = new Date()
    const today = new Date(now)
    
    // الإنشاء التالي: 5 صباحاً
    const nextGen = new Date(today)
    nextGen.setHours(5, 0, 0, 0)
    if (now >= nextGen) {
      nextGen.setDate(nextGen.getDate() + 1)
    }
    
    // الحذف التالي: 12 ليلاً
    const nextDel = new Date(today)
    nextDel.setHours(0, 0, 0, 0)
    nextDel.setDate(nextDel.getDate() + 1)
    
    setAutoGenStatus({
      nextGeneration: nextGen,
      nextDeletion: nextDel,
      isScheduled: true
    })
  }

  const generateAllPINs = async () => {
    try {
      setLoading(true)
      
      // تنفيذ الإنشاء المتوازي لتحسين الأداء
      const promises = clinics.map(clinic => api.generatePIN(clinic.id))
      const results = await Promise.all(promises)
      
      const successCount = results.filter(r => r.success).length
      
      await loadAllPINs()
      
      alert(isRTL 
        ? `تم إنشاء ${successCount} رقم سري بنجاح` 
        : `Successfully generated ${successCount} PINs`)
    } catch (err) {
      console.error('[AdminPINList] Error generating all PINs:', err)
      alert(isRTL ? 'فشل في إنشاء الأرقام' : 'Failed to generate PINs')
    } finally {
      setLoading(false)
    }
  }

  const printPINList = () => {
    const printContent = `
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            direction: ${isRTL ? 'rtl' : 'ltr'};
          }
          h1 { 
            color: #1e40af; 
            text-align: center;
            margin-bottom: 10px;
          }
          .date {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
          }
          th, td { 
            border: 2px solid #333; 
            padding: 15px; 
            text-align: ${isRTL ? 'right' : 'left'};
            font-size: 16px;
          }
          th { 
            background-color: #1e40af; 
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f3f4f6;
          }
          .pin-number {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
            letter-spacing: 2px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { padding: 10px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${isRTL ? 'قائمة الأرقام السرية للعيادات' : 'Clinic PIN List'}</h1>
        <div class="date">
          ${isRTL ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
          <br>
          ${isRTL ? 'الوقت' : 'Time'}: ${new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
        </div>
        <table>
          <thead>
            <tr>
              <th>${isRTL ? 'رقم' : '#'}</th>
              <th>${isRTL ? 'اسم العيادة' : 'Clinic Name'}</th>
              <th>${isRTL ? 'رمز العيادة' : 'Clinic Code'}</th>
              <th>${isRTL ? 'رقم PIN' : 'PIN Number'}</th>
              <th>${isRTL ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            ${clinics.map((clinic, idx) => {
              const pinData = pins[clinic.id]
              const pinDisplay = pinData?.pin || (isRTL ? 'غير متوفر' : 'N/A')
              const statusDisplay = pinData?.pin 
                ? (isRTL ? '✅ نشط' : '✅ Active')
                : (isRTL ? '❌ غير متوفر' : '❌ Not Available')
              
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${isRTL ? clinic.name_ar : clinic.name}</td>
                  <td>${clinic.id}</td>
                  <td class="pin-number">${pinDisplay}</td>
                  <td>${statusDisplay}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        <div class="footer">
          ${isRTL ? 'قيادة الخدمات الطبية - ادارة اللجنة الطبية العسكرية' : 'Medical Services Command - Military Medical Committee Management'}
          <br>
          ${isRTL ? 'تم الإنشاء تلقائياً بواسطة نظام إدارة اللجنة الطبية' : 'Automatically generated by Medical Committee Management System'}
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  const downloadCSV = () => {
    const csvContent = [
      [isRTL ? 'رقم' : '#', isRTL ? 'اسم العيادة' : 'Clinic Name', isRTL ? 'رمز العيادة' : 'Clinic Code', isRTL ? 'رقم PIN' : 'PIN Number', isRTL ? 'الحالة' : 'Status'],
      ...clinics.map((clinic, idx) => {
        const pinData = pins[clinic.id]
        return [
          idx + 1,
          isRTL ? clinic.name_ar : clinic.name,
          clinic.id,
          pinData?.pin || 'N/A',
          pinData?.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير متوفر' : 'Not Available')
        ]
      })
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clinic_pins_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />
          {isRTL ? 'قائمة الأرقام السرية لجميع العيادات' : 'All Clinics PIN List'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadAllPINs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {isRTL ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Auto-generation Schedule */}
      <div className="bg-gray-700 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {isRTL ? 'جدولة تلقائية' : 'Auto Schedule'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-600 p-4 rounded">
            <p className="text-sm text-gray-300 mb-1">{isRTL ? 'الإنشاء التالي' : 'Next Generation'}</p>
            <p className="text-xl font-bold text-green-400">
              {isRTL ? '5:00 صباحاً يومياً' : '5:00 AM Daily'}
            </p>
            {autoGenStatus.nextGeneration && (
              <p className="text-xs text-gray-400 mt-1">
                {autoGenStatus.nextGeneration.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
            )}
          </div>
          <div className="bg-gray-600 p-4 rounded">
            <p className="text-sm text-gray-300 mb-1">{isRTL ? 'الحذف التالي' : 'Next Deletion'}</p>
            <p className="text-xl font-bold text-red-400">
              {isRTL ? '12:00 ليلاً يومياً' : '12:00 AM Daily'}
            </p>
            {autoGenStatus.nextDeletion && (
              <p className="text-xs text-gray-400 mt-1">
                {autoGenStatus.nextDeletion.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={generateAllPINs}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 rounded-lg text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-5 h-5" />
          {isRTL ? 'إنشاء جميع الأرقام' : 'Generate All PINs'}
        </button>
        <button
          onClick={printPINList}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors"
        >
          <Printer className="w-5 h-5" />
          {isRTL ? 'طباعة القائمة' : 'Print List'}
        </button>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          {isRTL ? 'تحميل CSV' : 'Download CSV'}
        </button>
      </div>

      {/* Clinics Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-900 text-gray-300">
              <tr>
                <th className="px-6 py-4 font-semibold">{isRTL ? '#' : '#'}</th>
                <th className="px-6 py-4 font-semibold">{isRTL ? 'العيادة' : 'Clinic'}</th>
                <th className="px-6 py-4 font-semibold">{isRTL ? 'الرمز' : 'Code'}</th>
                <th className="px-6 py-4 font-semibold text-center">{isRTL ? 'رقم PIN' : 'PIN'}</th>
                <th className="px-6 py-4 font-semibold">{isRTL ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-white">
              {clinics.map((clinic, idx) => {
                const pinData = pins[clinic.id]
                return (
                  <tr key={clinic.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium">{isRTL ? clinic.name_ar : clinic.name}</td>
                    <td className="px-6 py-4 text-gray-400 font-mono">{clinic.id}</td>
                    <td className="px-6 py-4 text-center">
                      {pinData?.pin ? (
                        <span className="text-2xl font-bold text-yellow-500 tracking-widest bg-gray-900 px-3 py-1 rounded">
                          {pinData.pin}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">{isRTL ? 'غير منشأ' : 'Not Issued'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {pinData?.pin ? (
                        <span className="inline-flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded-full text-sm">
                          <CheckCircle className="w-3 h-3" />
                          {isRTL ? 'نشط' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded-full text-sm">
                          <AlertCircle className="w-3 h-3" />
                          {isRTL ? 'غير متوفر' : 'N/A'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-center text-gray-500 text-sm">
          {isRTL ? 'آخر تحديث:' : 'Last update:'} {lastUpdate.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
        </p>
      )}
    </div>
  )
}

export default AdminPINList
