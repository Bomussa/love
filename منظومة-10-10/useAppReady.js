/**
 * Hook لإدارة حالة جاهزية التطبيق
 * يضمن تحميل جميع الموارد قبل عرض المحتوى
 * تاريخ: 15 يناير 2026
 */

import { useState, useEffect } from 'react'

export function useAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const checkReadiness = async () => {
      try {
        // 1. التحقق من تحميل DOM
        if (document.readyState === 'loading') {
          await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true })
          })
        }
        setProgress(25)

        // 2. التحقق من تحميل الخطوط
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
        }
        setProgress(50)

        // 3. التحقق من تحميل الصور الأساسية
        const logo = document.querySelector('img[src="/logo.jpeg"]')
        if (logo && !logo.complete) {
          await new Promise(resolve => {
            logo.addEventListener('load', resolve, { once: true })
            logo.addEventListener('error', resolve, { once: true })
          })
        }
        setProgress(75)

        // 4. التحقق من تحميل CSS
        const stylesheets = Array.from(document.styleSheets)
        const cssLoaded = stylesheets.every(sheet => {
          try {
            return sheet.cssRules !== null
          } catch (e) {
            return true // CORS stylesheet
          }
        })
        
        if (!cssLoaded) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        setProgress(100)

        // 5. تأخير صغير للتأكد من تطبيق الأنماط
        await new Promise(resolve => setTimeout(resolve, 150))

        setIsReady(true)
      } catch (error) {
        console.error('Error checking app readiness:', error)
        // في حالة الخطأ، نعرض التطبيق على أي حال بعد 1 ثانية
        setTimeout(() => setIsReady(true), 1000)
      }
    }

    checkReadiness()
  }, [])

  return { isReady, progress }
}

export default useAppReady
