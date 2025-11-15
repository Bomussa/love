import React, { useState, useEffect } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Globe, ArrowLeft, Loader, AlertTriangle } from 'lucide-react'
import api from '../lib/api-unified'
import { t } from '../lib/i18n'

export function ExamSelectionPage({ onExamSelect, onBack, language, toggleLanguage }) {
  const [examTypes, setExamTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true)
        const response = await api.getExamTypes()
        if (response.success) {
          setExamTypes(response.data)
        } else {
          throw new Error(response.error || 'Failed to fetch exam types')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchExams()
  }, [])

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
          <img src="/logo.jpeg" alt="قيادة الخدمات الطبية" className="mx-auto w-32 h-32 rounded-full shadow-lg" />

          <div>
            <h1 className="text-3xl font-bold text-white">
              {language === 'ar' ? 'قيادة الخدمات الطبية' : 'Medical Services Command'}
            </h1>
            <p className="text-xl text-gray-300 mt-2">
              {language === 'ar' ? 'Medical Services' : 'قيادة الخدمات الطبية'}
            </p>
            <p className="text-gray-400 mt-2">
              {language === 'ar'
                ? 'المركز الطبي المتخصص العسكري - العطار - اللجنة الطبية'
                : 'Military Specialized Medical Center – Al-Attar – Medical Committee'}
            </p>
          </div>
        </div>

        {/* Exam Selection */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">{t('selectExamType', language)}</h2>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Loader className="w-8 h-8 animate-spin text-white" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center text-red-400">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p>{t('errorFetchingExams')}</p>
                <p className="text-sm text-red-500">{error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {examTypes.map((exam) => (
                  <Button
                    key={exam.id}
                    variant="outline"
                    className="h-32 flex-col gap-3 border-gray-600 hover:bg-gray-700/50 hover:border-yellow-500 transition-all duration-200"
                    onClick={() => onExamSelect(exam.id)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
