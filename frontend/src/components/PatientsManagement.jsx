/**
 * إدارة المراجعين - بيانات حقيقية فقط من قاعدة البيانات
 * ✅ لا توجد بيانات وهمية
 * ✅ جميع البيانات من Supabase عبر نظام GDS
 */
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import {
  Users,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { GDS, getQueues, getRoutes } from '../lib/guaranteed-data-system'

export function PatientsManagement({ language }) {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // جلب بيانات الطوابير من نظام GDS
      const queuesResult = await getQueues()
      const routesResult = await getRoutes()

      if (queuesResult.error) throw new Error(queuesResult.error)

      const patientsMap = new Map()

      // معالجة بيانات الطوابير
      if (queuesResult.data && queuesResult.data.length > 0) {
        queuesResult.data.forEach(queue => {
          const patientId = queue.patient_id
          if (!patientsMap.has(patientId)) {
            patientsMap.set(patientId, {
              id: patientId,
              militaryId: patientId.substring(0, 8),
              status: queue.status,
              currentClinic: queue.clinic_id,
              queueNumber: queue.display_number,
              startTime: queue.entered_at ? new Date(queue.entered_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '-',
              completedStations: 0,
              totalStations: 0,
              queues: [queue]
            })
          } else {
            const patient = patientsMap.get(patientId)
            patient.queues.push(queue)
            if (queue.status === 'serving') {
              patient.status = 'in-progress'
              patient.currentClinic = queue.clinic_id
            }
          }
        })
      }

      // إضافة بيانات المسارات
      if (routesResult.data && routesResult.data.length > 0) {
        routesResult.data.forEach(route => {
          const patientId = route.patient_id
          if (patientsMap.has(patientId)) {
            const patient = patientsMap.get(patientId)
            patient.examType = route.exam_type || '-'
            patient.totalStations = route.stations ? route.stations.length : 0
            patient.completedStations = route.current_station_index || 0
            if (route.status === 'completed') {
              patient.status = 'completed'
            }
          }
        })
      }

      const patientsArray = Array.from(patientsMap.values())
      
      patientsArray.forEach(patient => {
        if (patient.queues) {
          patient.completedStations = patient.queues.filter(q => q.status === 'completed').length
          patient.totalStations = Math.max(patient.totalStations, patient.queues.length)
        }
      })

      setPatients(patientsArray)
    } catch (err) {
      console.error('Error loading patients:', err)
      setError(language === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data')
      setPatients([])
    } finally {
      setLoading(false)
    }
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
      case 'serving':
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
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            <AlertCircle className="w-3 h-3" />
            {status || '-'}
          </span>
        )
    }
  }

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.militaryId?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || patient.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleExport = () => {
    if (patients.length === 0) {
      alert(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }

    const csvContent = [
      ['الرقم العسكري', 'الحالة', 'العيادة الحالية', 'رقم الدور', 'وقت البدء', 'العيادات المكتملة'].join(','),
      ...filteredPatients.map(p => [
        p.militaryId,
        p.status,
        p.currentClinic,
        p.queueNumber,
        p.startTime,
        `${p.completedStations}/${p.totalStations}`
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `patients_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            {language === 'ar' ? 'إدارة المراجعين' : 'Patients Management'}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPatients} disabled={loading} className="border-gray-600 text-gray-300">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={patients.length === 0} className="border-gray-600 text-gray-300">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={language === 'ar' ? 'بحث بالرقم العسكري...' : 'Search by military ID...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Status'}</option>
            <option value="waiting">{language === 'ar' ? 'في الانتظار' : 'Waiting'}</option>
            <option value="serving">{language === 'ar' ? 'جاري الفحص' : 'In Progress'}</option>
            <option value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'الرقم العسكري' : 'Military ID'}</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'العيادة الحالية' : 'Current Clinic'}</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'رقم الدور' : 'Queue #'}</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'وقت البدء' : 'Start Time'}</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">{language === 'ar' ? 'التقدم' : 'Progress'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {language === 'ar' ? 'لا يوجد مراجعين' : 'No patients found'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-white font-mono">{patient.militaryId}</td>
                    <td className="py-3 px-4">{getStatusBadge(patient.status)}</td>
                    <td className="py-3 px-4 text-gray-300">{patient.currentClinic || '-'}</td>
                    <td className="py-3 px-4 text-gray-300">{patient.queueNumber || '-'}</td>
                    <td className="py-3 px-4 text-gray-300">{patient.startTime}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 transition-all" style={{ width: patient.totalStations > 0 ? `${(patient.completedStations / patient.totalStations) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-xs text-gray-400">{patient.completedStations}/{patient.totalStations}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-sm text-gray-400">
          <span>{language === 'ar' ? 'إجمالي المراجعين:' : 'Total Patients:'} {patients.length}</span>
          <span>{language === 'ar' ? 'معروض:' : 'Showing:'} {filteredPatients.length}</span>
        </div>
      </CardContent>
    </Card>
  )
}
