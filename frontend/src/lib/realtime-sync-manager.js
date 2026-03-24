/**
 * Realtime Sync Manager
 * 
 * مدير مركزي للتحديثات اللحظية بين شاشة الإدارة وشاشة المراجع
 * 
 * ✅ تحديث فوري لحظي
 * ✅ استهلاك موارد منخفض
 * ✅ أداء ممتاز
 * ✅ معالجة الأخطاء والانقطاعات
 */

import { apiClient } from "./lib/api/client";

class RealtimeSyncManager {
  constructor() {
    this.subscriptions = new Map()
    this.callbacks = new Map()
    this.isConnected = true
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
  }

  /**
   * الاشتراك في تحديثات جدول معين
   */
  subscribe(tableName, clinicId = null, callback) {
    try {
      const channelName = clinicId ? `${tableName}-${clinicId}` : tableName
      
      // تجنب الاشتراكات المكررة
      if (this.subscriptions.has(channelName)) {
        console.log(`Already subscribed to ${channelName}`)
        return
      }

      const filter = clinicId ? `clinic_id=eq.${clinicId}` : undefined

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            ...(filter && { filter }),
          },
          (payload) => {
            this.handleUpdate(channelName, payload, callback)
          }
        )
        .subscribe((status) => {
          console.log(`Channel ${channelName} status:`, status)
          this.isConnected = status === 'SUBSCRIBED'
        })

      this.subscriptions.set(channelName, channel)
      this.callbacks.set(channelName, callback)

      console.log(`✅ Subscribed to ${channelName}`)
    } catch (error) {
      console.error(`Error subscribing to ${tableName}:`, error)
      this.handleReconnect()
    }
  }

  /**
   * إلغاء الاشتراك
   */
  unsubscribe(tableName, clinicId = null) {
    const channelName = clinicId ? `${tableName}-${clinicId}` : tableName
    
    if (this.subscriptions.has(channelName)) {
      const channel = this.subscriptions.get(channelName)
      supabase.removeChannel(channel)
      this.subscriptions.delete(channelName)
      this.callbacks.delete(channelName)
      console.log(`✅ Unsubscribed from ${channelName}`)
    }
  }

  /**
   * معالجة التحديثات
   */
  handleUpdate(channelName, payload, callback) {
    try {
      const { eventType, new: newData, old: oldData } = payload

      // تسجيل التحديث
      console.log(`📡 Update on ${channelName}:`, {
        event: eventType,
        new: newData,
        old: oldData,
        timestamp: new Date().toISOString(),
      })

      // استدعاء الـ callback
      if (callback && typeof callback === 'function') {
        callback({
          eventType,
          newData,
          oldData,
          timestamp: new Date().toISOString(),
        })
      }

      // إعادة تعيين عدد محاولات إعادة الاتصال
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('Error handling update:', error)
    }
  }

  /**
   * معالجة إعادة الاتصال
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.reconnectAll()
    }, delay)
  }

  /**
   * إعادة الاتصال بجميع الاشتراكات
   */
  reconnectAll() {
    try {
      const subscriptionsToReconnect = Array.from(this.subscriptions.entries())
      
      // إلغاء جميع الاشتراكات
      subscriptionsToReconnect.forEach(([channelName, channel]) => {
        supabase.removeChannel(channel)
        this.subscriptions.delete(channelName)
      })

      // إعادة الاشتراك
      subscriptionsToReconnect.forEach(([channelName, _]) => {
        const [tableName, clinicId] = channelName.includes('-') 
          ? [channelName.split('-')[0], channelName.split('-')[1]]
          : [channelName, null]

        const callback = this.callbacks.get(channelName)
        this.subscribe(tableName, clinicId, callback)
      })

      this.isConnected = true
      console.log('✅ Reconnected successfully')
    } catch (error) {
      console.error('Error reconnecting:', error)
      this.handleReconnect()
    }
  }

  /**
   * الحصول على حالة الاتصال
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      activeSubscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    }
  }

  /**
   * إلغاء جميع الاشتراكات
   */
  unsubscribeAll() {
    try {
      this.subscriptions.forEach((channel) => {
        supabase.removeChannel(channel)
      })
      this.subscriptions.clear()
      this.callbacks.clear()
      console.log('✅ Unsubscribed from all channels')
    } catch (error) {
      console.error('Error unsubscribing from all:', error)
    }
  }
}

// إنشاء instance واحد للاستخدام في التطبيق
export const realtimeSyncManager = new RealtimeSyncManager()

export default realtimeSyncManager
