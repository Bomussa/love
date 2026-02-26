/**
 * UIEffectsManager — لوحة تحكم كاملة للتأثيرات البصرية
 * يستخدم: framer-motion + react-colorful + @dnd-kit/sortable
 * يحفظ في: Supabase (جدول ui_effects)
 * يطبق: CSS Variables ديناميكياً على كامل التطبيق
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Play, Pause, Plus, Trash2, Save, RefreshCw,
  ChevronDown, ChevronUp, Sliders, Palette, Zap, Move,
  Timer, RotateCcw, Copy, Check, AlertCircle, Sparkles,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Maximize2,
  Minimize2, Layers, Settings2, ToggleLeft, ToggleRight
} from 'lucide-react';

// ===== ثوابت =====
const EFFECT_TYPES = [
  { id: 'fadeIn',      label: 'ظهور ناعم',        css: 'fade-in-effect',       icon: '✨' },
  { id: 'slideUp',     label: 'انزلاق للأعلى',     css: 'slide-up-effect',      icon: '⬆️' },
  { id: 'slideDown',   label: 'انزلاق للأسفل',     css: 'slide-down-effect',    icon: '⬇️' },
  { id: 'slideLeft',   label: 'انزلاق لليسار',     css: 'slide-left-effect',    icon: '⬅️' },
  { id: 'slideRight',  label: 'انزلاق لليمين',     css: 'slide-right-effect',   icon: '➡️' },
  { id: 'scaleIn',     label: 'تكبير ظهور',        css: 'scale-in-effect',      icon: '🔍' },
  { id: 'bounce',      label: 'ارتداد',            css: 'bounce-effect',        icon: '🏀' },
  { id: 'pulse',       label: 'نبض',               css: 'pulse-effect',         icon: '💓' },
  { id: 'shake',       label: 'اهتزاز',            css: 'shake-effect',         icon: '📳' },
  { id: 'float',       label: 'طفو',               css: 'float-effect',         icon: '🎈' },
  { id: 'glow',        label: 'توهج',              css: 'glow-effect',          icon: '💡' },
  { id: 'shimmer',     label: 'بريق',              css: 'shimmer-effect',       icon: '✴️' },
  { id: 'hoverLift',   label: 'رفع عند التحويم',   css: 'hover-lift-effect',    icon: '🖱️' },
  { id: 'hoverGlow',   label: 'توهج عند التحويم',  css: 'hover-glow-effect',    icon: '🌟' },
  { id: 'typewriter',  label: 'آلة كاتبة',         css: 'typewriter-effect',    icon: '⌨️' },
];

const EASING_OPTIONS = [
  { id: 'ease',        label: 'ناعم' },
  { id: 'ease-in',     label: 'بداية بطيئة' },
  { id: 'ease-out',    label: 'نهاية بطيئة' },
  { id: 'ease-in-out', label: 'بداية ونهاية بطيئة' },
  { id: 'linear',      label: 'خطي' },
  { id: 'spring',      label: 'نابض' },
];

const TRIGGER_OPTIONS = [
  { id: 'load',       label: 'عند التحميل' },
  { id: 'hover',      label: 'عند التحويم' },
  { id: 'click',      label: 'عند النقر' },
  { id: 'scroll',     label: 'عند التمرير' },
  { id: 'focus',      label: 'عند التركيز' },
  { id: 'always',     label: 'دائماً' },
];

const TARGET_OPTIONS = [
  { id: null,                  label: 'كل العناصر' },
  { id: '.card',               label: 'البطاقات' },
  { id: 'button',              label: 'الأزرار' },
  { id: '.header',             label: 'الرأس' },
  { id: '.notification',       label: 'الإشعارات' },
  { id: '.queue-number',       label: 'أرقام الطابور' },
  { id: '.status-badge',       label: 'شارات الحالة' },
  { id: '.logo',               label: 'الشعار' },
  { id: 'input',               label: 'حقول الإدخال' },
  { id: '.progress-bar',       label: 'شريط التقدم' },
];

const DEFAULT_EFFECT = {
  id: null,
  name_ar: 'تأثير جديد',
  effect_type: 'fadeIn',
  enabled: true,
  color: null,
  duration_ms: 400,
  delay_ms: 0,
  easing: 'ease-out',
  direction: 'normal',
  repeat_count: '1',
  trigger_event: 'load',
  target_selector: null,
  custom_css: null,
  order_index: 99,
};

// ===== مكوّن ColorPicker مع Popover =====
const ColorPickerPopover = ({ color, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all w-full"
      >
        <div
          className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0"
          style={{ backgroundColor: color || '#C9A54C' }}
        />
        <span className="text-sm font-mono">{color || 'افتراضي'}</span>
        {color && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="mr-auto text-gray-400 hover:text-white"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-2 right-0 bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-2xl"
          >
            <HexColorPicker color={color || '#C9A54C'} onChange={onChange} />
            <div className="mt-3 flex gap-2">
              {['#C9A54C', '#8A1538', '#3b82f6', '#22c55e', '#a855f7', '#f97316'].map(c => (
                <button
                  key={c}
                  onClick={() => onChange(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ===== مكوّن Slider مخصص =====
const SliderInput = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-xs text-gray-400">{label}</label>
      <span className="text-xs font-mono text-[#C9A54C]">{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #C9A54C ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)`
      }}
    />
  </div>
);

// ===== مكوّن بطاقة التأثير =====
const EffectCard = ({ effect, onUpdate, onDelete, onPreview, expanded, onToggleExpand }) => {
  const effectType = EFFECT_TYPES.find(e => e.id === effect.effect_type) || EFFECT_TYPES[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`rounded-2xl border transition-all ${
        effect.enabled
          ? 'border-[#C9A54C]/30 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]'
          : 'border-white/5 bg-white/3 opacity-60'
      }`}
    >
      {/* رأس البطاقة */}
      <div className="flex items-center gap-3 p-4">
        {/* أيقونة السحب */}
        <div className="text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0">
          <Move size={16} />
        </div>

        {/* أيقونة النوع */}
        <span className="text-xl flex-shrink-0">{effectType.icon}</span>

        {/* الاسم */}
        <input
          value={effect.name_ar}
          onChange={(e) => onUpdate({ ...effect, name_ar: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium text-white border-b border-transparent hover:border-white/20 focus:border-[#C9A54C] outline-none transition-colors min-w-0"
          placeholder="اسم التأثير"
        />

        {/* شارة النوع */}
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#C9A54C]/10 text-[#C9A54C] flex-shrink-0 hidden sm:block">
          {effectType.label}
        </span>

        {/* أزرار التحكم */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* معاينة */}
          <button
            onClick={() => onPreview(effect)}
            className="p-1.5 rounded-lg hover:bg-[#C9A54C]/10 text-[#C9A54C] transition-colors"
            title="معاينة"
          >
            <Play size={14} />
          </button>

          {/* تفعيل/تعطيل */}
          <button
            onClick={() => onUpdate({ ...effect, enabled: !effect.enabled })}
            className={`p-1.5 rounded-lg transition-colors ${
              effect.enabled ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-white/5'
            }`}
            title={effect.enabled ? 'تعطيل' : 'تفعيل'}
          >
            {effect.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          {/* توسيع */}
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* حذف */}
          <button
            onClick={() => onDelete(effect.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
            title="حذف"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* تفاصيل التأثير */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* نوع التأثير */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">نوع التأثير</label>
                <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                  {EFFECT_TYPES.map(et => (
                    <button
                      key={et.id}
                      onClick={() => onUpdate({ ...effect, effect_type: et.id })}
                      className={`p-2 rounded-lg text-xs text-center transition-all ${
                        effect.effect_type === et.id
                          ? 'bg-[#C9A54C] text-black font-medium'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      <div>{et.icon}</div>
                      <div className="mt-0.5 truncate">{et.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* إعدادات التوقيت */}
              <div className="space-y-3">
                <SliderInput
                  label="المدة"
                  value={effect.duration_ms}
                  min={50} max={3000} step={50} unit="ms"
                  onChange={(v) => onUpdate({ ...effect, duration_ms: v })}
                />
                <SliderInput
                  label="التأخير"
                  value={effect.delay_ms}
                  min={0} max={2000} step={50} unit="ms"
                  onChange={(v) => onUpdate({ ...effect, delay_ms: v })}
                />

                {/* التسهيل */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">طريقة الحركة</label>
                  <div className="flex flex-wrap gap-1">
                    {EASING_OPTIONS.map(e => (
                      <button
                        key={e.id}
                        onClick={() => onUpdate({ ...effect, easing: e.id })}
                        className={`px-2 py-1 rounded-lg text-xs transition-all ${
                          effect.easing === e.id
                            ? 'bg-[#8A1538] text-white'
                            : 'bg-white/5 hover:bg-white/10 text-gray-400'
                        }`}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* حدث التشغيل */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">متى يعمل</label>
                <div className="flex flex-wrap gap-1">
                  {TRIGGER_OPTIONS.map(tr => (
                    <button
                      key={tr.id}
                      onClick={() => onUpdate({ ...effect, trigger_event: tr.id })}
                      className={`px-2 py-1 rounded-lg text-xs transition-all ${
                        effect.trigger_event === tr.id
                          ? 'bg-[#C9A54C]/20 text-[#C9A54C] border border-[#C9A54C]/40'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400'
                      }`}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* الهدف */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">يُطبَّق على</label>
                <select
                  value={effect.target_selector || ''}
                  onChange={(e) => onUpdate({ ...effect, target_selector: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#C9A54C] outline-none"
                >
                  {TARGET_OPTIONS.map(t => (
                    <option key={t.id || 'all'} value={t.id || ''} className="bg-[#1a1a2e]">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* اللون */}
              <ColorPickerPopover
                color={effect.color}
                onChange={(c) => onUpdate({ ...effect, color: c })}
                label="لون التأثير (اختياري)"
              />

              {/* التكرار */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">التكرار</label>
                <div className="flex gap-1">
                  {['1', '2', '3', 'infinite'].map(r => (
                    <button
                      key={r}
                      onClick={() => onUpdate({ ...effect, repeat_count: r })}
                      className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                        effect.repeat_count === r
                          ? 'bg-[#C9A54C] text-black font-medium'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400'
                      }`}
                    >
                      {r === 'infinite' ? '∞' : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* CSS مخصص */}
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-400 block mb-1">CSS مخصص (متقدم)</label>
                <textarea
                  value={effect.custom_css || ''}
                  onChange={(e) => onUpdate({ ...effect, custom_css: e.target.value || null })}
                  placeholder="/* أضف CSS مخصص هنا */"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 focus:border-[#C9A54C] outline-none resize-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ===== المكوّن الرئيسي =====
const UIEffectsManager = ({ language, t: tFn }) => {
  const t = tFn || ((ar) => ar);
  const [effects, setEffects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [previewEffect, setPreviewEffect] = useState(null);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewTarget, setPreviewTarget] = useState('card');
  const previewRef = useRef(null);

  // ===== تحميل التأثيرات من Supabase =====
  const loadEffects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ui_effects')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      setEffects(data || []);

      // تحميل الإعداد العام
      const { data: globalData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ui_effects_global')
        .single();
      if (globalData?.value?.enabled !== undefined) {
        setGlobalEnabled(globalData.value.enabled);
      }
    } catch (e) {
      toast.error(t('خطأ في تحميل التأثيرات'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEffects(); }, [loadEffects]);

  // ===== تطبيق التأثيرات على الـ DOM =====
  const applyEffectsToDOM = useCallback((effectsList, isGlobalEnabled) => {
    // إزالة الـ style القديم
    const oldStyle = document.getElementById('ui-effects-dynamic');
    if (oldStyle) oldStyle.remove();

    if (!isGlobalEnabled) return;

    const css = effectsList
      .filter(e => e.enabled)
      .map(e => {
        const type = EFFECT_TYPES.find(t => t.id === e.effect_type);
        if (!type) return '';
        const selector = e.target_selector || '*';
        const duration = `${e.duration_ms}ms`;
        const delay = e.delay_ms ? `${e.delay_ms}ms` : '0ms';
        const easing = e.easing === 'spring' ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : e.easing;
        const color = e.color || 'var(--effect-color, #C9A54C)';
        const repeat = e.repeat_count || '1';
        const customCss = e.custom_css || '';

        const animations = {
          fadeIn:      `@keyframes ${type.css} { from { opacity: 0; } to { opacity: 1; } }`,
          slideUp:     `@keyframes ${type.css} { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`,
          slideDown:   `@keyframes ${type.css} { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }`,
          slideLeft:   `@keyframes ${type.css} { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`,
          slideRight:  `@keyframes ${type.css} { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }`,
          scaleIn:     `@keyframes ${type.css} { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }`,
          bounce:      `@keyframes ${type.css} { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`,
          pulse:       `@keyframes ${type.css} { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`,
          shake:       `@keyframes ${type.css} { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }`,
          float:       `@keyframes ${type.css} { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`,
          glow:        `@keyframes ${type.css} { 0%,100% { box-shadow: 0 0 5px ${color}40; } 50% { box-shadow: 0 0 20px ${color}80, 0 0 40px ${color}40; } }`,
          shimmer:     `@keyframes ${type.css} { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }`,
          hoverLift:   '',
          hoverGlow:   '',
          typewriter:  `@keyframes ${type.css} { from { width: 0; } to { width: 100%; } }`,
        };

        const applyRules = {
          hoverLift:  `${selector}:hover { transform: translateY(-4px) !important; box-shadow: 0 8px 25px rgba(0,0,0,0.3) !important; transition: all ${duration} ${easing} !important; }`,
          hoverGlow:  `${selector}:hover { box-shadow: 0 0 20px ${color}60 !important; transition: all ${duration} ${easing} !important; }`,
          shimmer:    `${selector} { background: linear-gradient(90deg, transparent 25%, ${color}20 50%, transparent 75%); background-size: 200% 100%; animation: ${type.css} ${duration} ${easing} ${repeat === 'infinite' ? 'infinite' : repeat} ${delay}; }`,
          typewriter: `${selector} { overflow: hidden; white-space: nowrap; animation: ${type.css} ${duration} steps(40) ${delay} both; }`,
        };

        const keyframe = animations[e.effect_type] || '';
        const applyRule = applyRules[e.effect_type] ||
          `${selector} { animation: ${type.css} ${duration} ${easing} ${repeat === 'infinite' ? 'infinite' : repeat} ${delay} both; }`;

        return `${keyframe}\n${applyRule}\n${customCss}`;
      })
      .filter(Boolean)
      .join('\n\n');

    if (css.trim()) {
      const style = document.createElement('style');
      style.id = 'ui-effects-dynamic';
      style.textContent = `/* تأثيرات بصرية ديناميكية — UIEffectsManager */\n${css}`;
      document.head.appendChild(style);
    }
  }, []);

  // تطبيق التأثيرات عند تغيير القائمة
  useEffect(() => {
    if (!loading) applyEffectsToDOM(effects, globalEnabled);
  }, [effects, globalEnabled, loading, applyEffectsToDOM]);

  // ===== حفظ في Supabase =====
  const saveAll = async () => {
    setSaving(true);
    try {
      // حفظ كل تأثير
      for (let i = 0; i < effects.length; i++) {
        const e = { ...effects[i], order_index: i };
        if (e.id && !e.id.startsWith('new_')) {
          const { error } = await supabase.from('ui_effects').upsert(e, { onConflict: 'id' });
          if (error) throw error;
        } else {
          const { id: _id, ...rest } = e;
          const { error } = await supabase.from('ui_effects').insert({ ...rest, order_index: i });
          if (error) throw error;
        }
      }

      // حفظ الإعداد العام
      await supabase.from('app_settings').upsert(
        { key: 'ui_effects_global', value: { enabled: globalEnabled }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      setHasChanges(false);
      toast.success(t('✅ تم حفظ التأثيرات بنجاح'));
      await loadEffects();
    } catch (e) {
      toast.error(t('خطأ في الحفظ: ') + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ===== تحديث تأثير =====
  const updateEffect = useCallback((updated) => {
    setEffects(prev => prev.map(e => e.id === updated.id ? updated : e));
    setHasChanges(true);
  }, []);

  // ===== حذف تأثير =====
  const deleteEffect = useCallback(async (id) => {
    if (!id || id.startsWith('new_')) {
      setEffects(prev => prev.filter(e => e.id !== id));
      return;
    }
    if (!confirm(t('هل تريد حذف هذا التأثير؟'))) return;
    const { error } = await supabase.from('ui_effects').delete().eq('id', id);
    if (error) { toast.error(t('خطأ في الحذف')); return; }
    setEffects(prev => prev.filter(e => e.id !== id));
    toast.success(t('تم الحذف'));
    setHasChanges(true);
  }, []);

  // ===== إضافة تأثير جديد =====
  const addEffect = () => {
    const newEffect = {
      ...DEFAULT_EFFECT,
      id: `new_${Date.now()}`,
      order_index: effects.length,
    };
    setEffects(prev => [...prev, newEffect]);
    setExpandedId(newEffect.id);
    setHasChanges(true);
  };

  // ===== معاينة تأثير =====
  const previewEffectFn = (effect) => {
    setPreviewEffect(effect);
    if (previewRef.current) {
      const type = EFFECT_TYPES.find(t => t.id === effect.effect_type);
      if (!type) return;
      previewRef.current.style.animation = 'none';
      previewRef.current.offsetHeight; // reflow
      const easing = effect.easing === 'spring' ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : effect.easing;
      previewRef.current.style.animation = `${type.css} ${effect.duration_ms}ms ${easing} ${effect.repeat_count === 'infinite' ? 'infinite' : effect.repeat_count} ${effect.delay_ms}ms both`;
    }
  };

  // ===== تبديل الكل =====
  const toggleAll = (enabled) => {
    setEffects(prev => prev.map(e => ({ ...e, enabled })));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A54C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* الرأس */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A54C] to-[#B8943D] flex items-center justify-center">
            <Sparkles size={20} className="text-black" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('إدارة التأثيرات البصرية')}</h3>
            <p className="text-xs text-gray-400">{effects.filter(e => e.enabled).length} تأثير نشط من {effects.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* تفعيل/تعطيل الكل */}
          <button
            onClick={() => { setGlobalEnabled(!globalEnabled); setHasChanges(true); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              globalEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {globalEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {globalEnabled ? t('التأثيرات مفعّلة') : t('التأثيرات معطّلة')}
          </button>

          <button onClick={() => toggleAll(true)} className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all">
            {t('تفعيل الكل')}
          </button>
          <button onClick={() => toggleAll(false)} className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all">
            {t('تعطيل الكل')}
          </button>

          <button
            onClick={addEffect}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-[#8A1538]/20 text-[#C9A54C] border border-[#8A1538]/30 hover:bg-[#8A1538]/30 transition-all"
          >
            <Plus size={16} /> {t('تأثير جديد')}
          </button>

          <button
            onClick={saveAll}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              hasChanges
                ? 'bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black hover:opacity-90'
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('جاري الحفظ...') : t('حفظ التغييرات')}
          </button>
        </div>
      </div>

      {/* منطقة المعاينة */}
      <div className="bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] rounded-2xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Eye size={16} className="text-[#C9A54C]" /> {t('منطقة المعاينة')}
          </h4>
          <div className="flex gap-2">
            {['card', 'button', 'number', 'badge'].map(target => (
              <button
                key={target}
                onClick={() => setPreviewTarget(target)}
                className={`px-2 py-1 rounded-lg text-xs transition-all ${
                  previewTarget === target ? 'bg-[#C9A54C] text-black' : 'bg-white/5 text-gray-400'
                }`}
              >
                {target === 'card' ? 'بطاقة' : target === 'button' ? 'زر' : target === 'number' ? 'رقم' : 'شارة'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[120px]">
          {previewTarget === 'card' && (
            <div
              ref={previewRef}
              className="bg-gradient-to-br from-[#8A1538]/20 to-[#6B0F2A]/20 border border-[#C9A54C]/20 rounded-2xl p-6 w-64 text-center"
            >
              <div className="text-[#C9A54C] text-2xl font-bold mb-1">42</div>
              <div className="text-white text-sm">عيادة الباطنة</div>
              <div className="text-gray-400 text-xs mt-1">الطابق الثاني</div>
            </div>
          )}
          {previewTarget === 'button' && (
            <button
              ref={previewRef}
              className="px-6 py-3 bg-gradient-to-r from-[#8A1538] to-[#6B0F2A] text-white rounded-xl font-medium"
            >
              دخول العيادة
            </button>
          )}
          {previewTarget === 'number' && (
            <div ref={previewRef} className="text-6xl font-bold text-[#C9A54C]">
              007
            </div>
          )}
          {previewTarget === 'badge' && (
            <span ref={previewRef} className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
              متاح الآن
            </span>
          )}
        </div>

        {previewEffect && (
          <p className="text-center text-xs text-gray-500 mt-2">
            {t('معاينة:')} {previewEffect.name_ar} — {previewEffect.duration_ms}ms {previewEffect.easing}
          </p>
        )}
      </div>

      {/* قائمة التأثيرات */}
      {effects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t('لا توجد تأثيرات. أضف تأثيراً جديداً.')}</p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={effects}
          onReorder={(newOrder) => { setEffects(newOrder); setHasChanges(true); }}
          className="space-y-3"
        >
          <AnimatePresence>
            {effects.map((effect) => (
              <Reorder.Item key={effect.id} value={effect}>
                <EffectCard
                  effect={effect}
                  onUpdate={updateEffect}
                  onDelete={deleteEffect}
                  onPreview={previewEffectFn}
                  expanded={expandedId === effect.id}
                  onToggleExpand={() => setExpandedId(expandedId === effect.id ? null : effect.id)}
                />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* ملاحظة */}
      <div className="flex items-start gap-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
        <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400">
          {t('التأثيرات تُطبَّق فوراً على التطبيق عند الحفظ. يمكن سحب وإفلات التأثيرات لترتيبها.')}
        </p>
      </div>
    </div>
  );
};

export default UIEffectsManager;
