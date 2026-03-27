/**
 * Instant Update Broadcaster
 * 
 * بث فوري للتحديثات من شاشة الإدارة إلى شاشة المراجع
 * 
 * ✅ تحديث فوري لحظي
 * ✅ بدون تأخير
 * ✅ معالجة شاملة لجميع العمليات
 */

import { apiClient } from "@/lib/api/client";

class InstantUpdateBroadcaster {
  constructor() {
    this.listeners = new Map()
    this.updateQueue = []
    this.isProcessing = false
  }

  /**
   * تسجيل مستمع للتحديثات
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType).push(callback)

    // إرجاع دالة لإلغاء الاستماع
    return () => {
      const callbacks = this.listeners.get(eventType)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * بث تحديث فوري
   */
  broadcast(eventType, data) {
    try {
      console.log(`📢 Broadcasting ${eventType}:`, data)

      const callbacks = this.listeners.get(eventType) || []
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in callback for ${eventType}:`, error)
        }
      })
    } catch (error) {
      console.error('Error broadcasting update:', error)
    }
  }

  /**
   * تحديث الدور (Queue) - مع بث فوري
   */
  async updateQueue(queueId, updates) {
    try {
      const { data, error } = await supabase
        .from('unified_queue')
        .update(updates)
        .eq('id', queueId)
        .select()
        .single()

      if (!error && data) {
        // بث التحديث فوراً
        this.broadcast('queue:updated', {
          queueId,
          updates,
          data,
          timestamp: new Date().toISOString(),
        })

        return { success: true, data }
      }

      throw error
    } catch (error) {
      console.error('Error updating queue:', error)
      this.broadcast('queue:error', {
        queueId,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * إضافة مسار جديد - مع بث فوري
   */
  async addPathway(pathwayData) {
    try {
      const { data, error } = await supabase
        .from('pathways')
        .insert(pathwayData)
        .select()
        .single()

      if (!error && data) {
        // بث التحديث فوراً
        this.broadcast('pathway:added', {
          pathway: data,
          timestamp: new Date().toISOString(),
        })

        return { success: true, data }
      }

      throw error
    } catch (error) {
      console.error('Error adding pathway:', error)
      this.broadcast('pathway:error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * إضافة عيادة جديدة - مع بث فوري
   */
  async addClinic(clinicData) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .insert(clinicData)
        .select()
        .single()

      if (!error && data) {
        // بث التحديث فوراً
        this.broadcast('clinic:added', {
          clinic: data,
          timestamp: new Date().toISOString(),
        })

        return { success: true, data }
      }

      throw error
    } catch (error) {
      console.error('Error adding clinic:', error)
      this.broadcast('clinic:error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * تحديث دور (تمرير الدور) - مع بث فوري
   */
  async transferRole(fromClinicId, toClinicId, reason = '') {
    try {
      // جلب أول مراجع في الانتظار
      const { data: queueData, error: queueError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', fromClinicId)
        .eq('status', 'waiting')
        .order('display_number', { ascending: true })
        .limit(1)
        .single()

      if (queueError && queueError.code !== 'PGRST116') {
        throw queueError
      }

      if (!queueData) {
        throw new Error('لا يوجد مراجع للتمرير')
      }

      // تحديث الدور
      const { data, error } = await supabase
        .from('unified_queue')
        .update({
          clinic_id: toClinicId,
          transferred_from: fromClinicId,
          transfer_reason: reason,
          transferred_at: new Date().toISOString(),
        })
        .eq('id', queueData.id)
        .select()
        .single()

      if (!error && data) {
        // بث التحديث فوراً
        this.broadcast('role:transferred', {
          fromClinic: fromClinicId,
          toClinic: toClinicId,
          queue: data,
          reason,
          timestamp: new Date().toISOString(),
        })

        return { success: true, data }
      }

      throw error
    } catch (error) {
      console.error('Error transferring role:', error)
      this.broadcast('role:error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * تحديث الخيارات (Settings) - مع بث فوري
   */
  async updateSettings(settingType, value) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          type: settingType,
          value,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (!error && data) {
        // بث التحديث فوراً
        this.broadcast('settings:updated', {
          type: settingType,
          value,
          timestamp: new Date().toISOString(),
        })

        return { success: true, data }
      }

      throw error
    } catch (error) {
      console.error('Error updating settings:', error)
      this.broadcast('settings:error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * الحصول على عدد المستمعين
   */
  getListenerCount(eventType = null) {
    if (eventType) {
      return (this.listeners.get(eventType) || []).length
    }

    let total = 0
    this.listeners.forEach((callbacks) => {
      total += callbacks.length
    })
    return total
  }

  /**
   * مسح جميع المستمعين
   */
  clear() {
    this.listeners.clear()
    console.log('✅ All listeners cleared')
  }
}

// إنشاء instance واحد
export const instantUpdateBroadcaster = new InstantUpdateBroadcaster()

export default instantUpdateBroadcaster
