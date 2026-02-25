import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  Bell,
  BellRing,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  User,
  Activity,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  Volume2,
  VolumeX
} from 'lucide-react'
import { t } from '../lib/i18n'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Notifications Page - صفحة الإشعارات
 * ✅ تستخدم بيانات حقيقية من Supabase
 * ✅ لا توجد بيانات وهمية
 */
export function NotificationsPage({ language, patientId }) {
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all') // all, unread, read
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState(null)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  useEffect(() => {
    loadNotifications()

    // تحديث كل 30 ثانية
    const interval = setInterval(loadNotifications, 30000)

    return () => clearInterval(interval)
  }, [patientId])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!patientId) {
        // إذا لم يكن هناك patient ID، نعرض رسالة فارغة
        setNotifications([])
        setLoading(false)
        return
      }

      // جلب الإشعارات من جدول notifications
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) {
        console.error('[Notifications] Error fetching:', fetchError)
        setError(fetchError.message)
        setNotifications([])
        return
      }

      // تحويل البيانات إلى الشكل المطلوب
      const transformedNotifications = (data || []).map(notif => ({
        id: notif.id,
        type: notif.type?.toUpperCase() || 'INFO',
        title: getNotificationTitle(notif.type, language),
        message: notif.message,
        timestamp: new Date(notif.created_at),
        read: notif.read,
        priority: getPriorityFromType(notif.type),
        clinic: notif.clinic_id || '',
        metadata: notif.metadata || {}
      }))

      setNotifications(transformedNotifications)
    } catch (err) {
      console.error('[Notifications] Failed to load:', err)
      setError(err.message)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const getNotificationTitle = (type, lang) => {
    const titles = {
      'YOUR_TURN': lang === 'ar' ? 'حان دورك' : 'Your Turn',
      'NEAR_TURN': lang === 'ar' ? 'قريب من دورك' : 'Near Your Turn',
      'STEP_DONE_NEXT': lang === 'ar' ? 'اكتمل الفحص' : 'Examination Completed',
      'SYSTEM': lang === 'ar' ? 'إشعار النظام' : 'System Notification',
      'INFO': lang === 'ar' ? 'معلومة' : 'Information',
      'WARNING': lang === 'ar' ? 'تحذير' : 'Warning',
      'SUCCESS': lang === 'ar' ? 'نجاح' : 'Success',
      'ERROR': lang === 'ar' ? 'خطأ' : 'Error'
    }
    return titles[type?.toUpperCase()] || (lang === 'ar' ? 'إشعار' : 'Notification')
  }

  const getPriorityFromType = (type) => {
    const priorities = {
      'YOUR_TURN': 'high',
      'NEAR_TURN': 'medium',
      'STEP_DONE_NEXT': 'medium',
      'ERROR': 'high',
      'WARNING': 'medium',
      'SUCCESS': 'low',
      'INFO': 'low',
      'SYSTEM': 'low'
    }
    return priorities[type?.toUpperCase()] || 'low'
  }

  const markAsRead = async (id) => {
    try {
      // تحديث في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (updateError) {
        console.error('[Notifications] Error marking as read:', updateError)
        return
      }

      // تحديث محلياً
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      )
    } catch (err) {
      console.error('[Notifications] Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      if (!patientId) return

      // تحديث جميع الإشعارات في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('patient_id', patientId)
        .eq('read', false)

      if (updateError) {
        console.error('[Notifications] Error marking all as read:', updateError)
        return
      }

      // تحديث محلياً
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      )
    } catch (err) {
      console.error('[Notifications] Failed to mark all as read:', err)
    }
  }

  const deleteNotification = async (id) => {
    try {
      // حذف من قاعدة البيانات
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('[Notifications] Error deleting:', deleteError)
        return
      }

      // حذف محلياً
      setNotifications(prev => prev.filter(notif => notif.id !== id))
    } catch (err) {
      console.error('[Notifications] Failed to delete:', err)
    }
  }

  const clearAll = async () => {
    try {
      if (!patientId) return

      // حذف جميع الإشعارات من قاعدة البيانات
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('patient_id', patientId)

      if (deleteError) {
        console.error('[Notifications] Error clearing all:', deleteError)
        return
      }

      // حذف محلياً
      setNotifications([])
    } catch (err) {
      console.error('[Notifications] Failed to clear all:', err)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'YOUR_TURN':
        return <BellRing className="w-6 h-6 text-[#8A1538]" />
      case 'NEAR_TURN':
        return <Clock className="w-6 h-6 text-[#C9A54C]" />
      case 'STEP_DONE_NEXT':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'SYSTEM':
      case 'INFO':
        return <Info className="w-6 h-6 text-blue-500" />
      case 'WARNING':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />
      case 'ERROR':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      case 'SUCCESS':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      default:
        return <Bell className="w-6 h-6 text-gray-500" />
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-r-4 border-[#8A1538] bg-red-50'
      case 'medium':
        return 'border-r-4 border-[#C9A54C] bg-yellow-50'
      case 'low':
        return 'border-r-4 border-gray-300 bg-gray-50'
      default:
        return 'border-r-4 border-gray-300 bg-white'
    }
  }

  const filteredNotifications = notifications.filter(notif => {
    // Filter by read/unread
    if (filter === 'unread' && notif.read) return false
    if (filter === 'read' && !notif.read) return false

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        notif.title?.toLowerCase().includes(search) ||
        notif.message?.toLowerCase().includes(search) ||
        notif.clinic?.toLowerCase().includes(search)
      )
    }

    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-8 h-8 text-[#C9A54C]" />
                <div>
                  <CardTitle className="text-white text-2xl">
                    {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-1">
                    {unreadCount > 0
                      ? language === 'ar'
                        ? `${unreadCount} إشعار غير مقروء`
                        : `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                      : language === 'ar'
                        ? 'لا توجد إشعارات غير مقروءة'
                        : 'No unread notifications'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={loadNotifications}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  disabled={loading}
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Error Alert */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400 text-sm">
                  {language === 'ar' ? 'خطأ في تحميل الإشعارات: ' : 'Error loading notifications: '}
                  {error}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={language === 'ar' ? 'بحث في الإشعارات...' : 'Search notifications...'}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#C9A54C]"
                />
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilter('all')}
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className={filter === 'all' ? 'bg-[#C9A54C] hover:bg-[#B8944B]' : 'border-gray-600 text-gray-300'}
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                </Button>
                <Button
                  onClick={() => setFilter('unread')}
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  className={filter === 'unread' ? 'bg-[#C9A54C] hover:bg-[#B8944B]' : 'border-gray-600 text-gray-300'}
                >
                  {language === 'ar' ? 'غير مقروء' : 'Unread'}
                </Button>
                <Button
                  onClick={() => setFilter('read')}
                  variant={filter === 'read' ? 'default' : 'outline'}
                  size="sm"
                  className={filter === 'read' ? 'bg-[#C9A54C] hover:bg-[#B8944B]' : 'border-gray-600 text-gray-300'}
                >
                  {language === 'ar' ? 'مقروء' : 'Read'}
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    onClick={markAllAsRead}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    onClick={clearAll}
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {language === 'ar' ? 'حذف الكل' : 'Clear all'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading && notifications.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A54C] mx-auto mb-4"></div>
                <p className="text-gray-400">
                  {language === 'ar' ? 'جاري تحميل الإشعارات...' : 'Loading notifications...'}
                </p>
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-8 text-center">
                <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {language === 'ar' 
                    ? 'سيتم عرض الإشعارات هنا عند توفرها' 
                    : 'Notifications will appear here when available'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notif) => (
              <Card
                key={notif.id}
                className={`${getPriorityColor(notif.priority)} ${
                  !notif.read ? 'border-l-4 border-l-[#C9A54C]' : ''
                } hover:shadow-lg transition-shadow cursor-pointer`}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            {notif.title}
                            {!notif.read && (
                              <span className="inline-block w-2 h-2 bg-[#C9A54C] rounded-full"></span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-700 mt-1">{notif.message}</p>
                          {notif.clinic && (
                            <p className="text-xs text-gray-500 mt-2">
                              {language === 'ar' ? 'العيادة: ' : 'Clinic: '}
                              {notif.clinic}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notif.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {notif.timestamp.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
