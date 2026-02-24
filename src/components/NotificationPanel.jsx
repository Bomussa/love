import React, { useState, useEffect } from 'react'
import notificationEngine from '../core/notification-engine.js'

export default function NotificationPanel({ patientId, isAdmin = false }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // تحميل الإشعارات الموجودة
    if (isAdmin) {
      const adminNotifs = notificationEngine.adminNotifications || []
      setNotifications(adminNotifs)
      setUnreadCount(adminNotifs.filter(n => !n.read).length)
    } else if (patientId) {
      const patientNotifs = notificationEngine.getNotifications(patientId)
      setNotifications(patientNotifs)
      setUnreadCount(patientNotifs.filter(n => !n.read).length)
    }

    // الاشتراك في الإشعارات الجديدة
    const unsubscribe = isAdmin
      ? notificationEngine.subscribeAdmin((notification) => {
          setNotifications(prev => [...prev, notification])
          setUnreadCount(prev => prev + 1)
        })
      : patientId
      ? notificationEngine.subscribe(patientId, (notification) => {
          setNotifications(prev => [...prev, notification])
          setUnreadCount(prev => prev + 1)
        })
      : null

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [patientId, isAdmin])

  const handleMarkAllRead = () => {
    if (isAdmin) {
      notificationEngine.adminNotifications.forEach(n => n.read = true)
      localStorage.setItem('admin_notifications', JSON.stringify(notificationEngine.adminNotifications))
    } else if (patientId) {
      notificationEngine.markAllAsRead(patientId)
    }
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleClearAll = () => {
    if (isAdmin) {
      notificationEngine.adminNotifications = []
      localStorage.removeItem('admin_notifications')
    } else if (patientId) {
      notificationEngine.clearAll(patientId)
    }
    setNotifications([])
    setUnreadCount(0)
  }

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'normal': return 'bg-blue-500'
      case 'low': return 'bg-gray-500'
      default: return 'bg-blue-500'
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'الآن'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} دقيقة`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ساعة`
    return date.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* زر الإشعارات */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* لوحة الإشعارات */}
      {isOpen && (
        <div className="absolute top-16 right-0 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
          {/* الرأس */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">الإشعارات</h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
                    >
                      تحديد الكل كمقروء
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
                    >
                      مسح الكل
                    </button>
                  </>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <p className="text-sm mt-1 opacity-90">{unreadCount} إشعار غير مقروء</p>
            )}
          </div>

          {/* قائمة الإشعارات */}
          <div className="overflow-y-auto max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.slice().reverse().map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* مؤشر الأولوية */}
                    <div className={`w-1 h-full ${getPriorityColor(notification.priority)} rounded-full`} />
                    
                    <div className="flex-1">
                      {/* العنوان */}
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm">{notification.title}</h4>
                        <span className="text-xs text-gray-500">{formatTime(notification.timestamp)}</span>
                      </div>
                      
                      {/* الرسالة */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                      
                      {/* معلومات إضافية */}
                      {notification.clinicName && (
                        <div className="mt-2 flex gap-2 flex-wrap">
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            {notification.clinicName}
                          </span>
                          {notification.position && (
                            <span className="text-xs bg-blue-200 dark:bg-blue-700 px-2 py-1 rounded">
                              الموقع: {notification.position}
                            </span>
                          )}
                          {notification.number && (
                            <span className="text-xs bg-green-200 dark:bg-green-700 px-2 py-1 rounded">
                              الرقم: {notification.number}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* مؤشر غير مقروء */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

