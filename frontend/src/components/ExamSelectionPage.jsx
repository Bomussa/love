import React from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import {
  Globe, ArrowLeft,
  UserCheck, TrendingUp, ArrowLeftRight, ClipboardList,
  FileSignature, Plane, ChefHat, GraduationCap
} from 'lucide-react'
import { examTypes } from '../lib/utils'
import { t } from '../lib/i18n'

const iconMap = {
  UserCheck, TrendingUp, ArrowLeftRight, ClipboardList,
  FileSignature, Plane, ChefHat, GraduationCap,
}

export function ExamSelectionPage({ onExamSelect, onBack, language, toggleLanguage }) {
  const handleExamClick = (examId) => {
    console.log('[ExamSelectionPage] Exam clicked:', examId);
    console.log('[ExamSelectionPage] onExamSelect exists:', !!onExamSelect);
    if (onExamSelect) {
      onExamSelect(examId);
    } else {
      console.error('[ExamSelectionPage] onExamSelect is not defined!');
    }
  };
  
  return (
    <div className="h-screen max-h-screen flex items-center justify-center p-4 overflow-hidden" data-test="exam-selection-page" style={{overflowY: "auto", overflowX: "hidden"}}>
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
        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />

          <div>
            <h1 className="text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-sm text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
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
              <h2 className="text-xl font-semibold text-white mb-2">{t('selectExamType', language)}</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {examTypes.map((exam) => {
                const IconComponent = iconMap[exam.icon]
                return (
                  <Button
                    key={exam.id}
                    variant="outline"
                    className="h-32 flex-col gap-3 border-gray-600 hover:bg-gray-700/50 hover:border-yellow-500 transition-all duration-200"
                    onClick={() => handleExamClick(exam.id)}
                    data-test={`exam-option-${exam.id}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${exam.color} shadow-md`}>
                      {IconComponent && <IconComponent className="w-6 h-6 text-white" strokeWidth={1.8} />}
                    </div>
                    <div className="text-center">
                      <div className="text-white font-medium text-sm leading-tight">
                        {language === 'ar' ? exam.nameAr : exam.name}
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
