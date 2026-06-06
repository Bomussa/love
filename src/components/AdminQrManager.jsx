/**
 * AdminQrManager - إدارة QR Code في لوحة الإدارة
 * ملاحظة: أزيلت لوحة الإحصائيات المكررة وتم تقليص زر إعادة التعيين إلى أيقونة صغيرة.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { QrCode, Download, RefreshCw, Smartphone, Copy, CheckCircle, Trash2 } from 'lucide-react';
import axios from 'axios';
import QRCodeLib from 'qrcode';

export function AdminQrManager({ language = 'ar' }) {
  const [patientId, setPatientId] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateQr = async () => {
    if (!patientId.trim()) {
      alert(language === 'ar' ? 'الرجاء إدخال الرقم الشخصي' : 'Please enter patient ID');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/session/create', {
        patientId: patientId.trim(),
      });

      if (response.data.ok) {
        const token = response.data.token;
        setQrToken(token);

        const baseUrl = window.location.origin;
        const qrLink = `${baseUrl}/qr?token=${token}`;
        setQrUrl(qrLink);

        const qrDataUrl = await QRCodeLib.toDataURL(qrLink, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });

        setQrImageUrl(qrDataUrl);
        alert(language === 'ar' ? 'تم إنشاء QR Code بنجاح!' : 'QR Code created successfully!');
      }
    } catch (error) {
      alert(language === 'ar' ? 'فشل إنشاء QR Code' : 'Failed to create QR Code');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl) return;
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `qr-${patientId}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  const handleReset = () => {
    setPatientId('');
    setQrToken('');
    setQrImageUrl('');
    setQrUrl('');
    setCopied(false);
  };

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
      returnButton: { ar: 'إخفاء', en: 'Hide' },
    };
    return translations[key]?.[language] || key;
  };

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

          {qrImageUrl && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('qrUrl')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                  />
                  <Button onClick={handleCopyUrl} variant="outline" size="sm">
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? t('copied') : t('copyButton')}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownloadQr} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  {t('downloadButton')}
                </Button>

                <Button onClick={handleReset} variant="outline" className="flex-none px-3" title={t('resetButton')}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
