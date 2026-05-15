import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Bell, CheckCircle, AlertTriangle, ArrowRight, Navigation, Clock, Info } from 'lucide-react'

/**
 * NotificationSystem - نظام الإشعارات اللحظي
 * المبادئ:
 * 1. إشعار واحد من كل نوع في نفس الوقت - لا تداخل
 * 2. الإشعارات ذات الأولوية الأعلى تظهر أولاً
 * 3. كل إشعار له مدة محددة ثم يختفي تلقائياً
 * 4. يمكن إغلاقه يدوياً
 * 5. لا يُعاد عرض نفس الإشعار مرتين إلا إذا كان خطأ/تحذيراً جديداً
 */

const PRIORITY = {
  info: 1, floor_guide: 2, success: 3, next_clinic: 4,
  queue_update: 5, near_turn: 6, your_turn: 7, warning: 8, error: 9,
}

const DURATION = {
  info: 5000, floor_guide: 8000, success: 5000, next_clinic: 8000,
  queue_update: 6000, near_turn: 10000, your_turn: 15000, warning: 6000, error: 7000,
}

const STYLES = {
  info: { bg: 'bg-slate-800/95', border: 'border-slate-500/50', Icon: Info, iconColor: 'text-slate-300', titleColor: 'text-white', msgColor: 'text-slate-200' },
  floor_guide: { bg: 'bg-blue-900/95', border: 'border-blue-500/60', Icon: Navigation, iconColor: 'text-blue-300', titleColor: 'text-blue-100', msgColor: 'text-blue-200' },
  success: { bg: 'bg-green-900/95', border: 'border-green-500/60', Icon: CheckCircle, iconColor: 'text-green-300', titleColor: 'text-green-100', msgColor: 'text-green-200' },
  next_clinic: { bg: 'bg-purple-900/95', border: 'border-purple-500/60', Icon: ArrowRight, iconColor: 'text-purple-300', titleColor: 'text-purple-100', msgColor: 'text-purple-200' },
  queue_update: { bg: 'bg-indigo-900/95', border: 'border-indigo-500/60', Icon: Clock, iconColor: 'text-indigo-300', titleColor: 'text-indigo-100', msgColor: 'text-indigo-200' },
  near_turn: { bg: 'bg-amber-900/95', border: 'border-amber-500/60', Icon: Bell, iconColor: 'text-amber-300', titleColor: 'text-amber-100', msgColor: 'text-amber-200' },
  your_turn: { bg: 'bg-green-800/98', border: 'border-green-400/80', Icon: Bell, iconColor: 'text-green-200', titleColor: 'text-white', msgColor: 'text-green-100' },
  warning: { bg: 'bg-orange-900/95', border: 'border-orange-500/60', Icon: AlertTriangle, iconColor: 'text-orange-300', titleColor: 'text-orange-100', msgColor: 'text-orange-200' },
  error: { bg: 'bg-red-900/95', border: 'border-red-500/60', Icon: AlertTriangle, iconColor: 'text-red-300', titleColor: 'text-red-100', msgColor: 'text-red-200' },
}

function NotificationCard({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const timerRef = useRef(null)
  const progressRef = useRef(null)
  const startTimeRef = useRef(null)
  const duration = DURATION[notification.type] || 6000
  const style = STYLES[notification.type] || STYLES.info
  const { Icon } = style

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50)
    startTimeRef.current = Date.now()
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100))
    }, 50)
    timerRef.current = setTimeout(() => handleDismiss(), duration)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(timerRef.current)
      clearInterval(progressRef.current)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    clearInterval(progressRef.current)
    setTimeout(() => onDismiss(), 300)
  }, [onDismiss])

  return (
    <div className={`relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out ${style.bg} ${style.border} ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}`} style={{ minWidth: '280px', maxWidth: '360px' }}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 rounded-t-2xl overflow-hidden">
        <div className="h-full bg-white/40 transition-none" style={{ width: `${progress}%` }} />
      </div>
      <div className="p-4 pt-5">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
            <Icon size={22} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            {notification.title && (
              <p className={`font-bold text-base leading-snug mb-1 ${style.titleColor}`}>{notification.title}</p>
            )}
            <p className={`text-[15px] leading-6 ${style.msgColor}`}>{notification.message}</p>
            {notification.clinic && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${style.iconColor}`}>
                <MapPin size={13} />
                <span>{notification.clinic}</span>
              </div>
            )}
            {notification.floor && (
              <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${style.iconColor}`}>
                <Navigation size={13} />
                <span>{notification.floor}</span>
              </div>
            )}
          </div>
          <button onClick={handleDismiss} className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5 p-1 rounded-lg hover:bg-white/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationSystem({ notifications = [], onDismiss }) {
  if (!notifications || notifications.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2" style={{ pointerEvents: 'none' }}>
      {notifications.map((notif) => (
        <div key={notif.id} style={{ pointerEvents: 'auto' }}>
          <NotificationCard notification={notif} onDismiss={() => onDismiss(notif.id)} />
        </div>
      ))}
    </div>
  )
}

function getDedupKey(notif) {
  return notif.dedupeKey || `${notif.type}:${notif.message}`
}

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const seenRef = useRef(new Set())
  const counterRef = useRef(0)

  const push = useCallback((notif) => {
    const dedupeKey = getDedupKey(notif)
    if (seenRef.current.has(dedupeKey)) return

    const id = ++counterRef.current
    const newNotif = { ...notif, id, dedupeKey }

    seenRef.current.add(dedupeKey)

    setNotifications(prev => {
      const updated = prev.filter(n => getDedupKey(n) !== dedupeKey)
      const next = [...updated, newNotif]
      next.sort((a, b) => (PRIORITY[b.type] || 1) - (PRIORITY[a.type] || 1))
      return next.slice(-4)
    })

    const duration = DURATION[notif.type] || 6000
    setTimeout(() => {
      seenRef.current.delete(dedupeKey)
    }, duration + 500)
  }, [])

  const dismiss = useCallback((id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id)
      if (notif) seenRef.current.delete(getDedupKey(notif))
      return prev.filter(n => n.id !== id)
    })
  }, [])

  const clear = useCallback(() => {
    setNotifications([])
    seenRef.current.clear()
  }, [])

  return { notifications, push, dismiss, clear }
}
