import React, { useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

/**
 * Admin Component لتمديد وقت المرضى
 */
export const AdminExtendTime = ({ language = 'ar' }) => {
  const [patientId, setPatientId] = useState('');
  const [extensionMinutes, setExtensionMinutes] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleExtend = async () => {
    if (!patientId.trim()) {
      setMessage({
        type: 'error',
        text: language === 'ar' ? 'الرجاء إدخال رقم المراجع' : 'Please enter patient ID'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // استدعاء API لتمديد الوقت
      const response = await fetch('/api/v1/admin/extend-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientId.trim(),
          additionalSeconds: extensionMinutes * 60
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: language === 'ar' 
            ? `تم تمديد الوقت ${extensionMinutes} دقائق بنجاح` 
            : `Time extended by ${extensionMinutes} minutes successfully`
        });
        setPatientId('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || (language === 'ar' ? 'فشل تمديد الوقت' : 'Failed to extend time')
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: language === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {language === 'ar' ? 'تمديد وقت المراجع' : 'Extend Patient Time'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Patient ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {language === 'ar' ? 'رقم المراجع' : 'Patient ID'}
          </label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder={language === 'ar' ? 'أدخل رقم المراجع' : 'Enter patient ID'}
            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
          />
        </div>

        {/* Extension Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {language === 'ar' ? 'مدة التمديد (بالدقائق)' : 'Extension Duration (minutes)'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[2, 5, 10, 15].map((min) => (
              <button
                key={min}
                onClick={() => setExtensionMinutes(min)}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  extensionMinutes === min
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {min} {language === 'ar' ? 'د' : 'm'}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500 text-green-400'
                : 'bg-red-500/20 border border-red-500 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleExtend}
          disabled={loading || !patientId.trim()}
          className="w-full"
          variant="primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          {loading
            ? (language === 'ar' ? 'جاري التمديد...' : 'Extending...')
            : (language === 'ar' ? 'تمديد الوقت' : 'Extend Time')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminExtendTime;
