import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  RefreshCw,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { t } from '../lib/i18n'

export function PatientsManagement({ language }) {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    setLoading(true)
    // بيانات تجريبية
    const mockPatients = [
      {
        id: 1,
        militaryId: '12345',
        name: language === 'ar' ? 'محمد أحمد' : 'Mohammed Ahmed',
        gender: 'male',
        examType: language === 'ar' ? 'فحص شامل' : 'Complete Exam',
        status: 'in-progress',
        currentClinic: language === 'ar' ? 'الباطنية' : 'Internal Medicine',
        queueNumber: 15,
        startTime: '09:30',
        completedStations: 3,
        totalStations: 6
      },
      {
        id: 2,
        militaryId: '67890',
        name: language === 'ar' ? 'فاطمة علي' : 'Fatima Ali',
        gender: 'female',
        examType: language === 'ar' ? 'فحص دوري' : 'Periodic Exam',
        status: 'completed',
        currentClinic: '-',
        queueNumber: 8,
        startTime: '08:45',
        completedStations: 5,
        totalStations: 5
      },
      {
        id: 3,
        militaryId: '11223',
        name: language === 'ar' ? 'خالد محمود' : 'Khaled Mahmoud',
        gender: 'male',
        examType: language === 'ar' ? 'فحص تخصصي' : 'Specialized Exam',
        status: 'waiting',
        currentClinic: language === 'ar' ? 'العيون' : 'Ophthalmology',
        queueNumber: 3,
        startTime: '10:15',
        completedStations: 1,
        totalStations: 4
      }
    ]

    setPatients(mockPatients)
    setLoading(false)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" />
            {language === 'ar' ? 'في الانتظار' : 'Waiting'}
          </span>
        )
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <Activity className="w-3 h-3" />
            {language === 'ar' ? 'جاري الفحص' : 'In Progress'}
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3 h-3" />
            {language === 'ar' ? 'مكتمل' : 'Completed'}
          </span>
        )
      default:
        return null
    }
  }

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.militaryId.includes(searchTerm) ||
      patient.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || patient.status === filterStatus
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="icon icon-xl icon-brand" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'ar' ? 'إدارة المراجعين' : 'Patients Management'}
            </h2>
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? `${patients.length} مراجع`
                : `${patients.length} patients`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPatients}
            disabled={loading}
            className="border-gray-300"
          >
            <RefreshCw className={`icon icon-md icon-brand ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-gray-300"
          >
            <Download className="icon icon-md icon-brand me-2" />
            {language === 'ar' ? 'تصدير' : 'Export'}
          </Button>

          <Button
            variant="default"
            size="sm"
            className="bg-[#8A1538] hover:bg-[#6B0F2A]"
          >
            <UserPlus className="icon icon-md me-2" />
            {language === 'ar' ? 'مراجع جديد' : 'New Patient'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 icon icon-md icon-muted" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث بالرقم العسكري أو الاسم...' : 'Search by ID or name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8A1538] focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
                className={filterStatus === 'all' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'الكل' : 'All'}
              </Button>
              <Button
                variant={filterStatus === 'waiting' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('waiting')}
                className={filterStatus === 'waiting' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'انتظار' : 'Waiting'}
              </Button>
              <Button
                variant={filterStatus === 'in-progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('in-progress')}
                className={filterStatus === 'in-progress' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'جاري' : 'In Progress'}
              </Button>
              <Button
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('completed')}
                className={filterStatus === 'completed' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'مكتمل' : 'Completed'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'الرقم العسكري' : 'Military ID'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'الاسم' : 'Name'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'نوع الفحص' : 'Exam Type'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'العيادة الحالية' : 'Current Clinic'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'التقدم' : 'Progress'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'ar' ? 'الإجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {patient.militaryId}
                      </div>
                      <div className="text-xs text-gray-500">
                        <Clock className="icon icon-sm me-1 inline" />
                        {patient.startTime}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.name}</div>
                      <div className="text-xs text-gray-500">
                        {patient.gender === 'male' ? '👨' : '👩'} {patient.gender === 'male' ? (language === 'ar' ? 'ذكر' : 'Male') : (language === 'ar' ? 'أنثى' : 'Female')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.examType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(patient.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.currentClinic}</div>
                      {patient.queueNumber > 0 && (
                        <div className="text-xs text-[#8A1538] font-semibold">
                          #{patient.queueNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#8A1538] h-2 rounded-full transition-all"
                            style={{ width: `${(patient.completedStations / patient.totalStations) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {patient.completedStations}/{patient.totalStations}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-[#8A1538] hover:bg-[#8A1538]/10">
                          <Eye className="icon icon-md" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#C9A54C] hover:bg-[#C9A54C]/10">
                          <Edit className="icon icon-md" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                          <Trash2 className="icon icon-md" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

