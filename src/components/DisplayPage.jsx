/**
 * @file DisplayPage.jsx
 * @description شاشة العرض التلفزيوني — تعرض الأرقام المستدعاة لكل عيادة
 *              في الوقت الفعلي. مخصصة لشاشات الانتظار.
 * @module DisplayPage
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';

/**
 * @component DisplayPage
 * @param {string}   props.language ar | en
 * @param {Function} props.t        (ar,en)=>string
 */
export const DisplayPage = ({ language, t }) => {
  const [called, setCalled] = useState([]);
  const tr = t || ((ar, en) => language === 'ar' ? ar : en);

  useEffect(() => {
    const fetchCalled = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('unified_queue')
        .select('display_number, patient_name, clinic_id, clinics(name_ar, name_en)')
        .eq('queue_date', today)
        .in('status', ['called','serving','in_progress'])
        .order('called_at', { ascending: false })
        .limit(20);
      if (data) setCalled(data);
    };

    fetchCalled();

    const ch = supabase
      .channel('display_page')
      .on('postgres_changes', { event:'*', schema:'public', table:'unified_queue' }, () => fetchCalled())
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8"
      dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* شعار */}
      <div className="text-center mb-12">
        <h1 className="text-[#C9A54C] text-4xl font-black mb-2">
          {tr('اللجنة الطبية العسكرية','Military Medical Committee')}
        </h1>
        <p className="text-white/50 text-xl">{tr('الأرقام المستدعاة','Called Numbers')}</p>
      </div>

      {/* الأرقام */}
      {called.length === 0 ? (
        <div className="text-white/30 text-2xl">{tr('لا توجد أرقام مستدعاة حالياً','No numbers called yet')}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-5xl">
          {called.map((c, i) => (
            <div key={i} className="bg-[#8A1538] rounded-3xl p-6 text-center border border-[#C9A54C]/30">
              <div className="text-[#C9A54C] text-6xl font-black mb-3">{c.display_number}</div>
              <div className="text-white text-sm font-bold truncate">
                {language === 'ar'
                  ? (c.clinics?.name_ar || c.clinic_id)
                  : (c.clinics?.name_en || c.clinic_id)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-4 text-white/20 text-sm">
        {new Date().toLocaleTimeString('ar-SA')}
      </div>
    </div>
  );
};

export default DisplayPage;
