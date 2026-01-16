/**
 * الهيدر الرسمي للجنة الطبية العسكرية
 * Official Header for Military Medical Committee
 * 
 * يُستخدم في جميع الصفحات والتقارير
 */

import React from 'react';

const OfficialHeader = ({ 
  size = 'normal', // 'small', 'normal', 'large'
  showSubtitle = true,
  className = '',
  language = 'ar'
}) => {
  const sizes = {
    small: {
      logo: 'w-12 h-12',
      title: 'text-sm',
      subtitle: 'text-xs',
      gap: 'gap-2'
    },
    normal: {
      logo: 'w-20 h-20',
      title: 'text-xl',
      subtitle: 'text-sm',
      gap: 'gap-3'
    },
    large: {
      logo: 'w-28 h-28',
      title: 'text-2xl',
      subtitle: 'text-base',
      gap: 'gap-4'
    }
  };

  const s = sizes[size] || sizes.normal;

  return (
    <div className={`text-center ${className}`}>
      {/* الشعار */}
      <div className="flex justify-center mb-2">
        <img 
          src="/logo.jpeg" 
          alt="قيادة الخدمات الطبية العسكرية" 
          className={`${s.logo} object-contain rounded-full shadow-lg border-2 border-[#C9A54C]/30`}
        />
      </div>
      
      {/* العنوان الرئيسي */}
      <div className={`${s.gap} flex flex-col items-center`}>
        <h1 className={`${s.title} font-bold text-white`}>
          {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
        </h1>
        
        {showSubtitle && (
          <>
            <p className={`${s.subtitle} text-[#C9A54C] font-semibold`}>
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className={`${s.subtitle} text-gray-400`}>
              {language === 'ar' ? 'المركز الطبي المتخصص العسكري - العطار' : 'Military Specialized Medical Center - Al-Attar'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// نسخة للطباعة (بدون خلفية شفافة)
export const OfficialHeaderPrint = ({ language = 'ar' }) => {
  return (
    <div style={{ 
      textAlign: 'center', 
      marginBottom: '30px',
      fontFamily: "'Cairo', 'Tajawal', 'Arial', sans-serif"
    }}>
      <img 
        src="/logo.jpeg" 
        alt="قيادة الخدمات الطبية العسكرية" 
        style={{ 
          width: '80px', 
          height: '80px', 
          objectFit: 'contain',
          borderRadius: '50%',
          border: '2px solid #C9A54C',
          marginBottom: '10px'
        }}
      />
      <h1 style={{ 
        fontSize: '22px', 
        fontWeight: 'bold', 
        color: '#8A1538',
        margin: '10px 0 5px 0'
      }}>
        {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
      </h1>
      <p style={{ 
        fontSize: '16px', 
        color: '#C9A54C',
        fontWeight: '600',
        margin: '5px 0'
      }}>
        {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
      </p>
      <p style={{ 
        fontSize: '14px', 
        color: '#666',
        margin: '5px 0'
      }}>
        {language === 'ar' ? 'المركز الطبي المتخصص العسكري - العطار' : 'Military Specialized Medical Center - Al-Attar'}
      </p>
    </div>
  );
};

export default OfficialHeader;
