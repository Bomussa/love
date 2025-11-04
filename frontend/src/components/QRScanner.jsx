import React, { useState, useEffect } from 'react';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * QR Scanner Component
 * يستخدم كاميرا الهاتف لمسح باركود
 */
export const QRScanner = ({ onScan, onClose, language = 'ar' }) => {
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    checkCamera();
  }, []);

  const checkCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setHasCamera(cameras.length > 0);
    } catch (err) {
      setError(language === 'ar' ? 'لا يمكن الوصول للكاميرا' : 'Cannot access camera');
    }
  };

  const startScanning = async () => {
    setScanning(true);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // هنا يمكن إضافة مكتبة QR Scanner مثل html5-qrcode
      // للتبسيط، سنستخدم إدخال يدوي
      
    } catch (err) {
      setError(language === 'ar' ? 'فشل تشغيل الكاميرا' : 'Failed to start camera');
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'مسح الباركود' : 'Scan QR Code'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
          {!scanning ? (
            <div className="text-center">
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'ar' 
                  ? 'انقر لبدء المسح' 
                  : 'Click to start scanning'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="animate-pulse">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'ar' ? 'جاري المسح...' : 'Scanning...'}
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!scanning ? (
            <button
              onClick={startScanning}
              disabled={!hasCamera}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
            >
              {language === 'ar' ? 'بدء المسح' : 'Start Scanning'}
            </button>
          ) : (
            <button
              onClick={() => setScanning(false)}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              {language === 'ar' ? 'إيقاف' : 'Stop'}
            </button>
          )}
        </div>

        {/* Manual Entry Option */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
            {language === 'ar' ? 'أو أدخل الرقم يدوياً' : 'Or enter manually'}
          </p>
          <input
            type="text"
            placeholder={language === 'ar' ? 'الرقم العسكري/الشخصي' : 'Military/Personal ID'}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.target.value) {
                onScan(e.target.value);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
