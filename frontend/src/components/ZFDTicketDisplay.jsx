/**
 * ZFD Ticket Display Component - عرض رقم التذكرة
 * @module ZFDTicketDisplay
 */

import React from 'react'
import { Ticket, Clock } from 'lucide-react'

/**
 * عرض رقم التذكرة مع التصميم
 * @param {Object} props
 * @param {number|string} props.ticketNumber - رقم التذكرة
 * @param {string} props.status - حالة التذكرة
 */
export function ZFDTicketDisplay({ ticketNumber, status }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#8A1538]/20 to-[#C9A54C]/20 rounded-2xl border border-[#C9A54C]/30">
      <Ticket className="w-12 h-12 text-[#C9A54C] mb-4" />
      <div className="text-6xl font-bold text-[#C9A54C] mb-2">
        #{ticketNumber}
      </div>
      <div className={`px-4 py-1 rounded-full text-sm ${
        status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
        status === 'called' ? 'bg-blue-500/20 text-blue-400' :
        'bg-green-500/20 text-green-400'
      }`}>
        {status === 'waiting' ? 'في الانتظار' : status === 'called' ? 'تم المناداة' : 'تم الخدمة'}
      </div>
    </div>
  )
}

/**
 * بانر عرض المعلومات
 * @param {Object} props
 * @param {string} props.title - العنوان
 * @param {string} props.message - الرسالة
 * @param {string} props.type - النوع (info/success/warning)
 */
export function ZFDBanner({ title, message, type = 'info' }) {
  const colors = {
    info: 'border-blue-500 bg-blue-500/10',
    success: 'border-green-500 bg-green-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10'
  }

  return (
    <div className={`p-4 rounded-xl border ${colors[type]}`}>
      <div className="font-bold text-white mb-1">{title}</div>
      <div className="text-sm text-gray-300">{message}</div>
    </div>
  )
}

export default { ZFDTicketDisplay, ZFDBanner }