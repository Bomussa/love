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
import api from '../lib/api-unified'

export function NotificationsPage({ language }) {
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all') // all, unread, read
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadNotifications()

    // Fallback polling كل 60 ثانية (الإشعارات غير حرجة)
    const interval = setInterval(loadNotifications, 60000)

    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      // استدعاء API للحصول على الإشعارات
      // const data = await api.getNotifications()

      // بيانات تجريبية للعرض
      const mockData = [
        {
          id: 1,
          type: 'YOUR_TURN',
          title: language === 'ar' ? 'حان دورك' : 'Your Turn',
          message: language === 'ar'
            ? 'يرجى التوجه إلى عيادة الباطنية - الرقم 15'
            : 'Please proceed to Internal Medicine - Number 15',
          timestamp: new Date(Date.now() - 2 * 60000),
          read: false,
          priority: 'high',
          clinic: language === 'ar' ? 'الباطنية' : 'Internal Medicine',
          number: 15
        },
        {
          id: 2,
          type: 'NEAR_TURN',
          title: language === 'ar' ? 'قريب من دورك' : 'Near Your Turn',
          message: language === 'ar'
            ? 'أنت الثالث في قائمة الانتظار - عيادة العيون'
            : 'You are 3rd in queue - Ophthalmology',
          timestamp: new Date(Date.now() - 5 * 60000),
          read: false,
          priority: 'medium',
          clinic: language === 'ar' ? 'العيون' : 'Ophthalmology',
          position: 3
        },
        {
          id: 3,
          type: 'STEP_DONE_NEXT',
          title: language === 'ar' ? 'اكتمل الفحص' : 'Examination Completed',
          message: language === 'ar'
            ? 'تم إتمام فحص الأشعة - انتقل إلى المختبر'
            : 'Radiology completed - Proceed to Laboratory',
          timestamp: new Date(Date.now() - 15 * 60000),
          read: true,
          priority: 'low',
          clinic: language === 'ar' ? 'الأشعة' : 'Radiology'
        },
        {
          id: 4,
          type: 'SYSTEM',
          title: language === 'ar' ? 'تحديث النظام' : 'System Update',
          message: language === 'ar'
            ? 'تم تحديث نظام الطوابير - الإصدار 2026'
            : 'Queue system updated - Version 2026',
          timestamp: new Date(Date.now() - 30 * 60000),
          read: true,
          priority: 'low'
        }
      ]

      setNotifications(mockData)
    } catch (error) {
      // console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    )
  }

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
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
        return <Info className="w-6 h-6 text-blue-500" />
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
        return 'bg-white'
    }
  }

  const filteredNotifications = notifications
    .filter(notif => {
      if (filter === 'unread') return !notif.read
      if (filter === 'read') return notif.read
      return true
    })
    .filter(notif => {
      if (!searchTerm) return true
      return notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.message.toLowerCase().includes(searchTerm.toLowerCase())
    })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="icon icon-xl icon-brand" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8A1538] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'ar' ? 'الإشعارات' : 'Notifications'}
            </h2>
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? `${unreadCount} إشعار غير مقروء`
                : `${unreadCount} unread notifications`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="border-gray-300"
          >
            {soundEnabled ? (
              <Volume2 className="icon icon-md icon-brand" />
            ) : (
              <VolumeX className="icon icon-md icon-muted" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadNotifications}
            disabled={loading}
            className="border-gray-300"
          >
            <RefreshCw className={`icon icon-md icon-brand ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="border-gray-300"
          >
            {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark All Read'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="border-gray-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث في الإشعارات...' : 'Search notifications...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8A1538] focus:border-transparent"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'الكل' : 'All'}
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
                className={filter === 'unread' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'غير مقروء' : 'Unread'}
              </Button>
              <Button
                variant={filter === 'read' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('read')}
                className={filter === 'read' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-gray-300'}
              >
                {language === 'ar' ? 'مقروء' : 'Read'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="icon icon-xl icon-muted mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all hover:shadow-md ${getPriorityColor(notification.priority)} ${!notification.read ? 'shadow-lg' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className={`font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {notification.timestamp.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className={`text-sm mb-3 ${!notification.read ? 'text-gray-700' : 'text-gray-500'}`}>
                      {notification.message}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {notification.clinic && (
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {notification.clinic}
                        </span>
                      )}
                      {notification.number && (
                        <span className="flex items-center gap-1 font-semibold text-[#8A1538]">
                          #{notification.number}
                        </span>
                      )}
                      {notification.position && (
                        <span className="flex items-center gap-1 font-semibold text-[#C9A54C]">
                          {language === 'ar' ? 'الترتيب:' : 'Position:'} {notification.position}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="text-[#8A1538] hover:bg-[#8A1538]/10"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

