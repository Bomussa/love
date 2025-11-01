import React from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { CheckCircle, Home, Download, Printer } from 'lucide-react'
import { t } from '../lib/i18n'

export function CompletePage({ patientData, onBackToHome, language }) {
  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // يمكن إضافة وظيفة تحميل التقرير هنا
    console.log('تحميل التقرير')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Success Animation */}
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="relative bg-green-500 rounded-full p-8">
              <CheckCircle className="w-24 h-24 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {language === 'ar' ? 'تم إتمام الفحص بنجاح' : 'Examination Completed Successfully'}
            </h1>
            <p className="text-xl text-gray-300">
              {language === 'ar'
                ? 'شكراً لك، تم إكمال جميع الفحوصات المطلوبة'
                : 'Thank you, all required examinations have been completed'}
            </p>
          </div>
        </div>

        {/* Patient Information Card */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="text-center pb-6 border-b border-gray-700">
                <img
                  src="/logo.jpeg"
                  alt="قيادة الخدمات الطبية"
                  className="mx-auto w-20 h-20 rounded-full shadow-lg mb-4"
                />
                <h2 className="text-2xl font-bold text-white">
                  {language === 'ar' ? 'قيادة الخدمات الطبية' : 'Medical Services Command'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {language === 'ar'
                    ? 'المركز الطبي التخصصي العسكري - العطار'
                    : 'Military Specialized Medical Center - Al-Attar'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    {language === 'ar' ? 'الرقم العسكري' : 'Military Number'}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {patientData?.patientId || '---'}
                  </p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    {language === 'ar' ? 'نوع الفحص' : 'Exam Type'}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {patientData?.examType || '---'}
                  </p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    {language === 'ar' ? 'تاريخ الفحص' : 'Exam Date'}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {new Date().toLocaleDateString('ar-EG')}
                  </p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    {language === 'ar' ? 'الوقت' : 'Time'}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-green-400 font-semibold mb-1">
                      {language === 'ar' ? 'جميع المحطات مكتملة' : 'All Stations Completed'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {language === 'ar'
                        ? 'تم إتمام جميع الفحوصات المطلوبة بنجاح. يمكنك الآن مراجعة قسم النتائج.'
                        : 'All required examinations completed successfully. You can now check the results section.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-14 border-gray-600 text-gray-300 hover:bg-gray-700"
            onClick={handlePrint}
          >
            <Printer className="icon icon-md me-2" />
            {language === 'ar' ? 'طباعة' : 'Print'}
          </Button>

          <Button
            variant="outline"
            className="h-14 border-gray-600 text-gray-300 hover:bg-gray-700"
            onClick={handleDownload}
          >
            <Download className="icon icon-md me-2" />
            {language === 'ar' ? 'تحميل التقرير' : 'Download Report'}
          </Button>

          <Button
            variant="gradient"
            className="h-14 text-lg font-semibold"
            onClick={onBackToHome}
          >
            <Home className="icon icon-md me-2" />
            {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
          </Button>
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500">
          {language === 'ar'
            ? 'في حالة وجود أي استفسار، يرجى مراجعة قسم الاستعلامات'
            : 'For any inquiries, please visit the information desk'}
        </p>
      </div>
    </div>
  )
}

