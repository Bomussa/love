import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  MapPin,
  Stethoscope,
  Eye,
  Heart,
  Brain,
  Bone,
  Ear,
  TestTube,
  Activity,
  Users,
  Clock,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react'

// تكوين العيادات والمسارات بناءً على نماذج الفحص الطبي
const EXAM_ROUTES = {
  'دورات_داخلية_خارجية': {
    name: 'فحص الدورات الداخلية والخارجية',
    floors: {
      'mezzanine': {
        name: 'الطابق الميزانين',
        note: 'يمكن التوجه إلى طابق الميزانين عن طريق المصعد بالضغط على حرف M',
        clinics: ['المختبر']
      },
      'second': {
        name: 'الطابق الثاني (عيادات اللجنة الطبية العسكرية)',
        clinics: [
          'القياسات الحيوية',
          'عيادة العيون',
          'عيادة الباطنية',
          'عيادة الجراحة العامة',
          'عيادة العظام والمفاصل',
          'عيادة أنف وأذن وحنجرة'
        ]
      }
    }
  },
  'تجنيد_ترفيع_نقل_تحويل_تجديد': {
    name: 'فحص التجنيد والترفيع والنقل والتحويل وتجديد التعاقد',
    floors: {
      'mezzanine': {
        name: 'الطابق الميزانين',
        note: 'يمكن التوجه إلى طابق الميزانين عن طريق المصعد بالضغط على حرف M',
        clinics: ['المختبر والأشعة']
      },
      'second': {
        name: 'الطابق الثاني (عيادات اللجنة الطبية العسكرية)',
        clinics: [
          'القياسات الحيوية',
          'عيادة العيون',
          'عيادة الباطنية',
          'عيادة الجراحة العامة',
          'عيادة العظام والمفاصل',
          'عيادة أنف وأذن وحنجرة',
          'عيادة النفسية',
          'عيادة الأسنان'
        ]
      }
    }
  },
  'طيران_سنوي': {
    name: 'فحص الطيران السنوي',
    floors: {
      'mezzanine': {
        name: 'الطابق الميزانين',
        note: 'يمكن التوجه إلى طابق الميزانين عن طريق المصعد بالضغط على حرف M',
        clinics: ['المختبر']
      },
      'second': {
        name: 'الطابق الثاني (عيادات اللجنة الطبية العسكرية)',
        clinics: [
          'عيادة العيون',
          'عيادة الباطنية',
          'عيادة أنف وأذن وحنجرة',
          'عيادة تخطيط القلب',
          'عيادة السمع'
        ]
      }
    }
  },
  'طباخين': {
    name: 'فحص الطباخين',
    floors: {
      'mezzanine': {
        name: 'الطابق الميزانين',
        note: 'يمكن التوجه إلى طابق الميزانين عن طريق المصعد بالضغط على حرف M',
        clinics: ['المختبر']
      },
      'second': {
        name: 'الطابق الثاني (عيادات اللجنة الطبية العسكرية)',
        clinics: [
          'عيادة الباطنية',
          'عيادة أنف وأذن وحنجرة',
          'عيادة الجراحة العامة'
        ]
      }
    }
  },
  'عنصر_نسائي': {
    name: 'العنصر النسائي (جميع الفحوصات)',
    floors: {
      'mezzanine': {
        name: 'الطابق الميزانين',
        note: 'يمكن التوجه إلى طابق الميزانين عن طريق المصعد بالضغط على حرف M',
        clinics: ['المختبر']
      },
      'second': {
        name: 'الطابق الثاني (عيادات اللجنة الطبية العسكرية)',
        clinics: [
          'القياسات الحيوية',
          'عيادة أنف وأذن وحنجرة',
          'عيادة الجراحة العامة',
          'عيادة العظام والمفاصل',
          'عيادة النفسية',
          'عيادة الأسنان'
        ]
      },
      'third': {
        name: 'الطابق الثالث',
        note: 'يجب التسجيل من استقبال العطار',
        clinics: [
          'عيادة الباطنية',
          'عيادة العيون',
          'عيادة الجلدية'
        ]
      }
    }
  }
}

const CLINIC_ICONS = {
  'المختبر': TestTube,
  'المختبر والأشعة': TestTube,
  'القياسات الحيوية': Activity,
  'عيادة العيون': Eye,
  'عيادة الباطنية': Heart,
  'عيادة الجراحة العامة': Stethoscope,
  'عيادة العظام والمفاصل': Bone,
  'عيادة أنف وأذن وحنجرة': Ear,
  'عيادة النفسية': Brain,
  'عيادة الأسنان': Stethoscope,
  'عيادة تخطيط القلب': Heart,
  'عيادة السمع': Ear,
  'عيادة الجلدية': Stethoscope
}

export function ClinicsConfiguration({ language }) {
  const [selectedExam, setSelectedExam] = useState('دورات_داخلية_خارجية')
  const [clinicsData, setClinicsData] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [modifiedRoutes, setModifiedRoutes] = useState(EXAM_ROUTES)
  const [hasChanges, setHasChanges] = useState(false)

  const handleSaveChanges = async () => {
    try {
      // TODO: حفظ التعديلات إلى API
      // await api.updateExamRoutes(modifiedRoutes)

      setHasChanges(false)
      setEditMode(false)
      alert(language === 'ar' ? 'تم حفظ التعديلات بنجاح' : 'Changes saved successfully')
    } catch (error) {
      console.error('Error saving changes:', error)
      alert(language === 'ar' ? 'فشل حفظ التعديلات' : 'Failed to save changes')
    }
  }

  const handleCancelEdit = () => {
    setModifiedRoutes(EXAM_ROUTES)
    setHasChanges(false)
    setEditMode(false)
  }

  const handleAddClinic = (examKey, floorKey) => {
    const clinicName = prompt(language === 'ar' ? 'أدخل اسم العيادة الجديدة:' : 'Enter new clinic name:')
    if (clinicName && clinicName.trim()) {
      const newRoutes = { ...modifiedRoutes }
      newRoutes[examKey].floors[floorKey].clinics.push(clinicName.trim())
      setModifiedRoutes(newRoutes)
      setHasChanges(true)
    }
  }

  const handleRemoveClinic = (examKey, floorKey, clinicIndex) => {
    const confirmed = confirm(language === 'ar' ? 'هل تريد حذف هذه العيادة؟' : 'Remove this clinic?')
    if (confirmed) {
      const newRoutes = { ...modifiedRoutes }
      newRoutes[examKey].floors[floorKey].clinics.splice(clinicIndex, 1)
      setModifiedRoutes(newRoutes)
      setHasChanges(true)
    }
  }

  const getClinicIcon = (clinicName) => {
    const IconComponent = CLINIC_ICONS[clinicName] || Stethoscope
    return <IconComponent className="h-4 w-4" />
  }

  const getFloorColor = (floorKey) => {
    switch (floorKey) {
      case 'mezzanine': return 'bg-blue-50 border-blue-200'
      case 'second': return 'bg-green-50 border-green-200'
      case 'third': return 'bg-purple-50 border-purple-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const getFloorIcon = (floorKey) => {
    switch (floorKey) {
      case 'mezzanine': return 'M'
      case 'second': return '2'
      case 'third': return '3'
      default: return '?'
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تكوين العيادات والمسارات</h1>
          <div className="text-sm text-gray-500 mt-1">
            بناءً على نماذج الفحص الطبي المعتمدة
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)} variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              <span>تعديل المسارات</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                <span>إلغاء</span>
              </Button>
              <Button
                onClick={handleSaveChanges}
                variant="default"
                disabled={!hasChanges}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                <span>حفظ التغييرات</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Exam Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            اختيار نوع الفحص
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(EXAM_ROUTES).map(([key, exam]) => (
              <Button
                key={key}
                variant={selectedExam === key ? "default" : "outline"}
                className="h-auto p-4 text-right justify-start"
                onClick={() => setSelectedExam(key)}
              >
                <div>
                  <div className="font-medium text-sm">{exam.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Object.keys(exam.floors).length} طوابق
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Exam Route */}
      {selectedExam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>مسار الفحص: {modifiedRoutes[selectedExam].name}</span>
              </div>
              {editMode && (
                <div className="text-sm text-gray-500">
                  وضع التعديل نشط
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(modifiedRoutes[selectedExam].floors).map(([floorKey, floor]) => (
                <div key={floorKey} className={`p-4 rounded-lg border-2 ${getFloorColor(floorKey)}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-lg border-2">
                      {getFloorIcon(floorKey)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{floor.name}</h3>
                      {floor.note && (
                        <p className="text-sm text-gray-600 mt-1">{floor.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {floor.clinics.map((clinic, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-blue-600 flex-shrink-0">
                            {getClinicIcon(clinic)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{clinic}</div>
                            <div className="text-xs text-gray-500">
                              الخطوة {index + 1}
                            </div>
                          </div>
                        </div>
                        {editMode && (
                          <Button
                            onClick={() => handleRemoveClinic(selectedExam, floorKey, index)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {editMode && (
                      <Button
                        onClick={() => handleAddClinic(selectedExam, floorKey)}
                        variant="outline"
                        className="p-3 h-auto border-dashed gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>إضافة عيادة</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Clinic Assignment Note */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 mt-1">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium text-yellow-800 mb-2">نظام التوزيع الديناميكي</h4>
              <p className="text-sm text-yellow-700">
                يتم توزيع المراجعين على العيادات بشكل ديناميكي (نموذج A و B و C و D)
                لضمان عدم تراكم المراجعين على عيادة معينة وتحسين تدفق المرضى.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
