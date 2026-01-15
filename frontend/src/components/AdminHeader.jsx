import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Admin Header Component
 * Navigation header for admin dashboard with logout and home buttons
 */
export default function AdminHeader() {
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      // Clear admin session
      localStorage.removeItem('admin_authenticated')
      localStorage.removeItem('admin_pin')
      
      // Navigate to home
      navigate('/')
    }
  }

  function handleHome() {
    navigate('/')
  }

  function handleDashboard() {
    navigate('/admin')
  }

  function handleStatistics() {
    navigate('/admin/statistics')
  }

  function handlePINManager() {
    navigate('/admin/pins')
  }

  function handleUserManager() {
    navigate('/admin/users')
  }

  function handleReports() {
    navigate('/admin/reports')
  }

  const isActive = (path) => location.pathname === path

  return (
    <header className="bg-gradient-to-r from-red-900 to-red-700 text-white shadow-lg">
      <div className="container mx-auto px-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between py-4 border-b border-red-600">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">لوحة التحكم</h1>
              <p className="text-sm opacity-90">المركز الطبي المتخصص العسكري - العطار</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleHome}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-900 rounded-lg hover:bg-red-50 transition-colors font-semibold"
            >
              <span>🏠</span>
              <span>الرئيسية</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-800 hover:bg-red-900 rounded-lg transition-colors font-semibold"
            >
              <span>🚪</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="py-3">
          <ul className="flex items-center gap-2 overflow-x-auto">
            <li>
              <button
                onClick={handleDashboard}
                className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive('/admin')
                    ? 'bg-white text-red-900 font-bold'
                    : 'bg-red-800 hover:bg-red-700'
                }`}
              >
                📊 لوحة المعلومات
              </button>
            </li>
            
            <li>
              <button
                onClick={handleStatistics}
                className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive('/admin/statistics')
                    ? 'bg-white text-red-900 font-bold'
                    : 'bg-red-800 hover:bg-red-700'
                }`}
              >
                📈 الإحصائيات
              </button>
            </li>
            
            <li>
              <button
                onClick={handlePINManager}
                className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive('/admin/pins')
                    ? 'bg-white text-red-900 font-bold'
                    : 'bg-red-800 hover:bg-red-700'
                }`}
              >
                🔑 إدارة البن كود
              </button>
            </li>
            
            <li>
              <button
                onClick={handleUserManager}
                className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive('/admin/users')
                    ? 'bg-white text-red-900 font-bold'
                    : 'bg-red-800 hover:bg-red-700'
                }`}
              >
                👥 إدارة المستخدمين
              </button>
            </li>
            
            <li>
              <button
                onClick={handleReports}
                className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive('/admin/reports')
                    ? 'bg-white text-red-900 font-bold'
                    : 'bg-red-800 hover:bg-red-700'
                }`}
              >
                📄 التقارير
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
