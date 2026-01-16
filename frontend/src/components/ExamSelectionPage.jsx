import React from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Globe, ArrowLeft } from 'lucide-react'
import { examTypes } from '../lib/utils'
import { t } from '../lib/i18n'

export function ExamSelectionPage({ onExamSelect, onBack, language, toggleLanguage }) {
  ;
  
  const handleExamClick = (examId) => {
    ;
    ;
    if (onExamSelect) {
      ;
      onExamSelect(examId);
    } else {
      console.error('[ExamSelectionPage] onExamSelect is undefined!');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-test="exam-selection-page">
      <div className="w-full max-w-4xl space-y-8">
        {/* Language Selector */}
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}
          >
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        {/* Back Button */}
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={onBack}
          >
            <ArrowLeft className="icon icon-md me-2" />
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        </div>

        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <img src="/logo.jpeg" alt="اللجنة الطبية العسكرية" className="mx-auto w-32 h-32 rounded-full shadow-lg border-2 border-[#C9A54C]/30" />

          <div>
            <h1 className="text-3xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-xl text-[#C9A54C] font-semibold mt-2">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 mt-2">
              {language === 'ar'
                ? 'المركز الطبي التخصصي العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        {/* Exam Selection */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">{t('selectExamType', language)}</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {examTypes.map((exam) => (
                <Button
                  key={exam.id}
                  variant="outline"
                  className="h-32 flex-col gap-3 border-gray-600 hover:bg-gray-700/50 hover:border-yellow-500 transition-all duration-200"
                  onClick={() => handleExamClick(exam.id)}
                  data-test={`exam-option-${exam.id}`}
                >
                  <div className="text-3xl">{exam.icon}</div>
                  <div className="text-center">
                    <div className="text-white font-medium text-sm">
                      {language === 'ar' ? exam.nameAr : exam.name}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
