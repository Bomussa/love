/**
 * لوحة الإدارة المحدثة - نظام إدارة العيادات
 * تاريخ: 15 يناير 2026
 * 
 * المزايا الجديدة:
 * - إدارة المستخدمين والصلاحيات
 * - إحصائيات وتقارير شاملة
 * - إدارة أرقام البن كود
 * - مراقبة الطوابير الحية
 * - زر خروج من الصفحة
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  Users, UserPlus, BarChart3, Settings, LogOut, 
  RefreshCw, Download, Eye, EyeOff, Edit, Trash2,
  Plus, Check, X, Clock, Activity, TrendingUp,
  Calendar, FileText, Shield, Key
} from 'lucide-react'
import api from '../lib/api-unified'

export function AdminDashboard({ adminData, onLogout, language = 'ar' }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [statistics, setStatistics] = useState(null)
  const [clinicPins, setClinicPins] = useState({})
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // تحميل الإحصائيات
      const stats = await api.getDailyStatistics()
      setStatistics(stats)

      // تحميل أرقام البن كود
      const pins = await api.getPinStatus()
      setClinicPins(pins.pins || {})

      // تحميل قائمة المدراء
      const adminsList = await api.getAdminsList()
      setAdmins(adminsList.admins || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'dashboard', icon: BarChart3, label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard' },
    { id: 'pins', icon: Key, label: language === 'ar' ? 'أرقام البن' : 'PIN Codes' },
    { id: 'admins', icon: Shield, label: language === 'ar' ? 'المدراء' : 'Admins' },
    { id: 'reports', icon: FileText, label: language === 'ar' ? 'التقارير' : 'Reports' },
    { id: 'settings', icon: Settings, label: language === 'ar' ? 'الإعدادات' : 'Settings' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}
            </h1>
            <p className="text-gray-400 mt-1">
              {language === 'ar' ? 'مرحباً' : 'Welcome'}, {adminData?.name || 'Admin'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadDashboardData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
            
            <Button
              variant="destructive"
              onClick={onLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {language === 'ar' ? 'خروج' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'dashboard' && (
          <DashboardTab statistics={statistics} language={language} />
        )}
        
        {activeTab === 'pins' && (
          <PinsTab 
            clinicPins={clinicPins} 
            onUpdate={loadDashboardData}
            language={language} 
          />
        )}
        
        {activeTab === 'admins' && (
          <AdminsTab 
            admins={admins}
            onUpdate={loadDashboardData}
            language={language}
          />
        )}
        
        {activeTab === 'reports' && (
          <ReportsTab language={language} />
        )}
        
        {activeTab === 'settings' && (
          <SettingsTab language={language} />
        )}
      </div>
    </div>
  )
}

// ========== Dashboard Tab ==========
function DashboardTab({ statistics, language }) {
  if (!statistics) {
    return <div className="text-white">Loading...</div>
  }

  const stats = statistics.statistics || {}

  const cards = [
    {
      title: language === 'ar' ? 'إجمالي الزيارات' : 'Total Visits',
      value: stats.total_visits || 0,
      icon: Users,
      color: 'blue'
    },
    {
      title: language === 'ar' ? 'جاري التنفيذ' : 'In Progress',
      value: stats.in_progress || 0,
      icon: Activity,
      color: 'yellow'
    },
    {
      title: language === 'ar' ? 'مكتمل' : 'Completed',
      value: stats.completed || 0,
      icon: Check,
      color: 'green'
    },
    {
      title: language === 'ar' ? 'ملغي' : 'Cancelled',
      value: stats.cancelled || 0,
      icon: X,
      color: 'red'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <Card key={index} className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{card.title}</p>
                  <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full bg-${card.color}-500/20 flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-400`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Exam Type */}
      {stats.by_exam_type && Object.keys(stats.by_exam_type).length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              {language === 'ar' ? 'حسب نوع الفحص' : 'By Exam Type'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.by_exam_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-white">{type}</span>
                  <span className="text-blue-400 font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== PINs Tab ==========
function PinsTab({ clinicPins, onUpdate, language }) {
  const [editingPin, setEditingPin] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [showPins, setShowPins] = useState({})

  const handleUpdatePin = async (clinicId) => {
    try {
      await api.updateClinicPin(clinicId, newPin)
      alert(language === 'ar' ? 'تم تحديث رقم البن بنجاح' : 'PIN updated successfully')
      setEditingPin(null)
      setNewPin('')
      onUpdate()
    } catch (error) {
      alert(language === 'ar' ? 'فشل تحديث رقم البن' : 'Failed to update PIN')
    }
  }

  const handleGeneratePin = async (clinicId) => {
    try {
      await api.generateNewPin(clinicId)
      alert(language === 'ar' ? 'تم إنشاء رقم بن جديد' : 'New PIN generated')
      onUpdate()
    } catch (error) {
      alert(language === 'ar' ? 'فشل إنشاء رقم البن' : 'Failed to generate PIN')
    }
  }

  const toggleShowPin = (clinicId) => {
    setShowPins(prev => ({ ...prev, [clinicId]: !prev[clinicId] }))
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Key className="w-5 h-5" />
          {language === 'ar' ? 'إدارة أرقام البن كود' : 'PIN Code Management'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(clinicPins).map(([clinicId, pinData]) => {
            const pin = typeof pinData === 'object' ? pinData.pin : pinData
            const isEditing = editingPin === clinicId
            const isVisible = showPins[clinicId]

            return (
              <div key={clinicId} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-white font-medium">{clinicId}</p>
                  <p className="text-gray-400 text-sm mt-1">
                    {language === 'ar' ? 'رقم البن' : 'PIN'}: {' '}
                    {isEditing ? (
                      <input
                        type="text"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="bg-gray-600 text-white px-2 py-1 rounded"
                        placeholder="Enter new PIN"
                      />
                    ) : (
                      <span className="font-mono">
                        {isVisible ? pin : '••••'}
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleShowPin(clinicId)}
                  >
                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePin(clinicId)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingPin(null)
                          setNewPin('')
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPin(clinicId)
                          setNewPin(pin)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleGeneratePin(clinicId)}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ========== Admins Tab ==========
function AdminsTab({ admins, onUpdate, language }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', name: '' })

  const handleAddAdmin = async () => {
    try {
      await api.addAdmin(newAdmin)
      alert(language === 'ar' ? 'تم إضافة المدير بنجاح' : 'Admin added successfully')
      setShowAddForm(false)
      setNewAdmin({ username: '', password: '', name: '' })
      onUpdate()
    } catch (error) {
      alert(language === 'ar' ? 'فشل إضافة المدير' : 'Failed to add admin')
    }
  }

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المدير؟' : 'Are you sure you want to delete this admin?')) {
      return
    }

    try {
      await api.deleteAdmin(adminId)
      alert(language === 'ar' ? 'تم حذف المدير بنجاح' : 'Admin deleted successfully')
      onUpdate()
    } catch (error) {
      alert(language === 'ar' ? 'فشل حذف المدير' : 'Failed to delete admin')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {language === 'ar' ? 'إدارة المدراء' : 'Admin Management'}
            </CardTitle>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'إضافة مدير' : 'Add Admin'}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-700/50 rounded-lg space-y-3">
              <input
                type="text"
                placeholder={language === 'ar' ? 'اسم المستخدم' : 'Username'}
                value={newAdmin.username}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded"
              />
              <input
                type="password"
                placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded"
              />
              <input
                type="text"
                placeholder={language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                value={newAdmin.name}
                onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddAdmin}>
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{admin.name}</p>
                  <p className="text-gray-400 text-sm">@{admin.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteAdmin(admin.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========== Reports Tab ==========
function ReportsTab({ language }) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const handleExportReport = async (format) => {
    try {
      const result = await api.exportVisitsReport(dateRange.start, dateRange.end, format)
      
      if (result.success) {
        const blob = new Blob([result.data], { 
          type: format === 'csv' ? 'text/csv' : 'application/json' 
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report_${dateRange.start}_${dateRange.end}.${format}`
        a.click()
      }
    } catch (error) {
      alert(language === 'ar' ? 'فشل تصدير التقرير' : 'Failed to export report')
    }
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {language === 'ar' ? 'التقارير والإحصائيات' : 'Reports & Statistics'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm">
              {language === 'ar' ? 'من تاريخ' : 'From Date'}
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded mt-1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">
              {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => handleExportReport('json')}>
            <Download className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'تصدير JSON' : 'Export JSON'}
          </Button>
          <Button onClick={() => handleExportReport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ========== Settings Tab ==========
function SettingsTab({ language }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400">
          {language === 'ar' ? 'قريباً...' : 'Coming soon...'}
        </p>
      </CardContent>
    </Card>
  )
}

export default AdminDashboard
