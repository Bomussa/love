import React, { useEffect } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import {
  Globe, ArrowLeft,
  UserCheck, TrendingUp, ArrowLeftRight, ClipboardList,
  FileSignature, Plane, ChefHat, GraduationCap
} from 'lucide-react'
import { examTypes } from '../lib/utils'
import { t } from '../lib/i18n'
import { preloadPathwayCache } from '../lib/dynamic-pathways'

const iconMap = {
  UserCheck, TrendingUp, ArrowLeftRight, ClipboardList,
  FileSignature, Plane, ChefHat, GraduationCap,
}

export function ExamSelectionPage({ patientData, onSelect, onLogout, language, toggleLanguage }) {
  // Preload pathway cache on component mount
  useEffect(() => {
    preloadPathwayCache().catch(err => console.warn('Pathway cache preload failed:', err));
  }, []);

  const handleExamClick = (examId) => {
    if (onSelect) onSelect(examId);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">{language === 'ar' ? 'اختر نوع الفحص' : 'Select Exam Type'}</h1>
            <p className="text-gray-300 mt-2">{language === 'ar' ? 'المركز الطبي التخصصي العسكري' : 'Military Specialized Medical Center'}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Globe size={20} />
              {language === 'ar' ? 'EN' : 'AR'}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {language === 'ar' ? 'خروج' : 'Exit'}
            </button>
          </div>
        </div>

        {/* Exam Selection Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {examTypes.map((exam) => {
            const IconComponent = iconMap[exam.icon]
            return (
              <button
                key={exam.id}
                onClick={() => handleExamClick(exam.id)}
                className="group relative p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 hover:border-yellow-500 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br ${exam.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {IconComponent && <IconComponent className="w-8 h-8 text-white" strokeWidth={1.8} />}
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm leading-tight">
                      {language === 'ar' ? exam.nameAr : exam.name}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>{language === 'ar' ? 'اختر نوع الفحص المطلوب للمتابعة' : 'Select the required exam type to continue'}</p>
        </div>
      </div>
    </div>
  )
}

export default ExamSelectionPage
