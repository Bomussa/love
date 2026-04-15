/**
 * AdminQrManager - إدارة QR Code في لوحة الإدارة
 * يسمح للأدمن بإنشاء QR Code للمرضى
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { QrCode, Download, RefreshCw, Smartphone, Copy, CheckCircle } from 'lucide-react'
import axios from 'axios'
import QRCodeLib from 'qrcode'

export function AdminQrManager({ language = 'ar' }) {
  const [patientId, setPatientId] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [copied, setCopied] = useState(false)

  // جلب إحصائيات الجلسات - DISABLED: endpoint not available
  // useEffect(() => {
  //   fetchStats()
  //   const interval = setInterval(fetchStats, 60000)
  //   return () => clearInterval(interval)
  // }, [])

  // const fetchStats = async () => {
  //   try {
  //     const response = await axios.get('/api/v1/stats/dashboard')
  //     if (response.data.success) {
  //       setStats(response.data.stats)
  //     }
  //   } catch (error) {
  //     // console.error('خطأ في جلب الإحصائيات:', error)
  //   }
  // }

  /**
   * إنشاء QR Code جديد
   */
  const handleGenerateQr = async () => {
    if (!patientId.trim()) {
      alert(language === 'ar' ? 'الرجاء إدخال الرقم الشخصي' : 'Please enter patient ID')
      return
    }

    setLoading(true)

    try {
      // إنشاء جلسة جديدة
      const response = await axios.post('/api/session/create', {
        patientId: patientId.trim()
      })

      if (response.data.ok) {
        const token = response.data.token
        setQrToken(token)

        // إنشاء رابط QR
        const baseUrl = window.location.origin
        const qrLink = `${baseUrl}/qr?token=${token}`
        setQrUrl(qrLink)

        // توليد QR Code كصورة
        const qrDataUrl = await QRCodeLib.toDataURL(qrLink, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })

        setQrImageUrl(qrDataUrl)

        // تحديث الإحصائيات
        fetchStats()

        alert(language === 'ar' ? 'تم إنشاء QR Code بنجاح!' : 'QR Code created successfully!')
      }
    } catch (error) {
      // console.error('❌ خطأ في إنشاء QR:', error)
      alert(language === 'ar' ? 'فشل إنشاء QR Code' : 'Failed to create QR Code')
    } finally {
      setLoading(false)
    }
  }

  /**
   * تحميل QR Code كصورة
   */
  const handleDownloadQr = () => {
    if (!qrImageUrl) return

    const link = document.createElement('a')
    link.href = qrImageUrl
    link.download = `qr-${patientId}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * نسخ الرابط
   */
  const handleCopyUrl = async () => {
    if (!qrUrl) return

    try {
      await navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // console.error('فشل النسخ:', error)
    }
  }

  /**
   * إعادة تعيين
   */
  const handleReset = () => {
    setPatientId('')
    setQrToken('')
    setQrImageUrl('')
    setQrUrl('')
    setCopied(false)
  }

  const t = (key) => {
    const translations = {
      title: { ar: 'إنشاء QR Code', en: 'Generate QR Code' },
      subtitle: { ar: 'إنشاء رمز QR للمريض', en: 'Create QR code for patient' },
      patientIdLabel: { ar: 'الرقم الشخصي', en: 'Patient ID' },
      patientIdPlaceholder: { ar: 'أدخل الرقم الشخصي', en: 'Enter patient ID' },
      generateButton: { ar: 'إنشاء QR', en: 'Generate QR' },
      generating: { ar: 'جاري الإنشاء...', en: 'Generating...' },
      downloadButton: { ar: 'تحميل', en: 'Download' },
      copyButton: { ar: 'نسخ الرابط', en: 'Copy Link' },
      copied: { ar: 'تم النسخ!', en: 'Copied!' },
      resetButton: { ar: 'إعادة تعيين', en: 'Reset' },
      qrUrl: { ar: 'رابط QR', en: 'QR URL' },
      statsTitle: { ar: 'إحصائيات الجلسات', en: 'Session Statistics' },
      totalSessions: { ar: 'إجمالي الجلسات', en: 'Total Sessions' },
      activeSessions: { ar: 'جلسات نشطة', en: 'Active Sessions' },
      usedSessions: { ar: 'جلسات مستخدمة', en: 'Used Sessions' },
      expiredSessions: { ar: 'جلسات منتهية', en: 'Expired Sessions' },
      iosDevices: { ar: 'أجهزة iOS', en: 'iOS Devices' },
      androidDevices: { ar: 'أجهزة Android', en: 'Android Devices' },
      desktopDevices: { ar: 'أجهزة كمبيوتر', en: 'Desktop Devices' }
    }
    return translations[key]?.[language] || key
  }

  return (
    <div className="space-y-6" data-test="admin-qr-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            {t('title')}
          </CardTitle>
          <p className="text-sm text-gray-400">{t('subtitle')}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* إدخال الرقم الشخصي */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patientIdLabel')}</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder={t('patientIdPlaceholder')}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={loading || !!qrImageUrl}
            />
          </div>

          {/* زر الإنشاء */}
          {!qrImageUrl && (
            <Button
              onClick={handleGenerateQr}
              className="w-full"
              disabled={loading || !patientId.trim()}
            >
              <QrCode className="w-4 h-4 mr-2" />
              {loading ? t('generating') : t('generateButton')}
            </Button>
          )}

          {/* عرض QR Code */}
          {qrImageUrl && (
            <div className="space-y-4">
              {/* الصورة */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>

              {/* الرابط */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('qrUrl')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                  />
                  <Button
                    onClick={handleCopyUrl}
                    variant="outline"
                    size="sm"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? t('copied') : t('copyButton')}
                  </Button>
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadQr}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('downloadButton')}
                </Button>

                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('resetButton')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* إحصائيات الجلسات */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              {t('statsTitle')}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* إجمالي */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
                <div className="text-xs text-gray-400">{t('totalSessions')}</div>
              </div>

              {/* نشط */}
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-2xl font-bold text-green-500">{stats.active}</div>
                <div className="text-xs text-gray-400">{t('activeSessions')}</div>
              </div>

              {/* مستخدم */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-500">{stats.used}</div>
                <div className="text-xs text-gray-400">{t('usedSessions')}</div>
              </div>

              {/* منتهي */}
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-2xl font-bold text-red-500">{stats.expired}</div>
                <div className="text-xs text-gray-400">{t('expiredSessions')}</div>
              </div>

              {/* حسب الجهاز */}
              <div className="col-span-2 md:col-span-4 grid grid-cols-3 gap-4 mt-2">
                <div className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-xl font-bold">{stats.byDevice.iOS}</div>
                  <div className="text-xs text-gray-400">{t('iosDevices')}</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-xl font-bold">{stats.byDevice.Android}</div>
                  <div className="text-xs text-gray-400">{t('androidDevices')}</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-xl font-bold">{stats.byDevice.Desktop}</div>
                  <div className="text-xs text-gray-400">{t('desktopDevices')}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
