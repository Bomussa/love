import React from 'react'
import { Home, Settings, Globe, Moon } from 'lucide-react'
import { t, getCurrentLanguage } from '../lib/i18n'
import { Button } from './Button'

export function Header({ currentPage, onPageChange, onThemeChange, currentTheme, language, toggleLanguage }) {
  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white"
            onClick={toggleLanguage}
          >
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="قيادة الخدمات الطبية" className="w-16 h-16 rounded-full" />
            <div className="text-right">
              <h1 className="text-white font-semibold text-lg">قيادة الخدمات الطبية</h1>
              <p className="text-gray-400 text-sm">Medical Services</p>
            </div>
          </div>
        </div>

        {/* Center Title */}
        <div className="text-center">
          <h2 className="text-white font-medium">Welcome to the Medical Committee System</h2>
        </div>

        {/* Left Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white"
            onClick={() => onPageChange('admin')}
          >
            <Settings className="icon icon-md me-2" />
            Admin
          </Button>



          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white"
            onClick={onThemeChange}
          >
            <Moon className="icon icon-md me-2" />
            Night Shift
          </Button>
        </div>
      </div>
    </header>
  )
}
