/**
 * شاشة الإحصائيات الرقمية الاحترافية
 * Live Statistics Panel
 * 
 * تعرض إحصائيات حية ورسمية للمراجعين
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Activity,
  Building2,
  Timer,
  UserCheck,
  UserX,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { getAllLogs, filterLogsByPeriod, getLogStatistics, ActivityTypes } from '../lib/activityLogger';

const LiveStatisticsPanel = ({ isOpen, onClose, clinics = [], examTypes = [] }) => {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('today');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // تحديث الإحصائيات
  const refreshStats = () => {
    setIsLoading(true);
    
    const logs = filterLogsByPeriod(period);
    const statistics = getLogStatistics(logs);
    
    // إحصائيات إضافية
    const patientLogs = logs.filter(l => 
      l.type === ActivityTypes.PATIENT_REGISTERED ||
      l.type === ActivityTypes.PATIENT_ENTERED_CLINIC ||
      l.type === ActivityTypes.PATIENT_EXITED_CLINIC ||
      l.type === ActivityTypes.PATIENT_COMPLETED_EXAM
    );
    
    // عدد المراجعين الفريدين
    const uniquePatients = new Set(patientLogs.map(l => l.patientMilitaryId).filter(Boolean));
    
    // المراجعين في الانتظار حالياً
    const enteredClinic = logs.filter(l => l.type === ActivityTypes.PATIENT_ENTERED_CLINIC);
    const exitedClinic = logs.filter(l => l.type === ActivityTypes.PATIENT_EXITED_CLINIC);
    const currentlyInClinic = enteredClinic.length - exitedClinic.length;
    
    // متوسط وقت الانتظار بالدقائق
    const avgWaitMinutes = statistics.avgDuration ? Math.round(statistics.avgDuration / 60) : 0;
    
    // إحصائيات حسب الساعة
    const hourlyStats = {};
    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });
    
    // أكثر ساعة ازدحاماً
    let peakHour = 0;
    let peakCount = 0;
    Object.entries(hourlyStats).forEach(([hour, count]) => {
      if (count > peakCount) {
        peakHour = parseInt(hour);
        peakCount = count;
      }
    });
    
    setStats({
      ...statistics,
      uniquePatients: uniquePatients.size,
      currentlyInClinic: Math.max(0, currentlyInClinic),
      avgWaitMinutes,
      hourlyStats,
      peakHour,
      peakCount,
      totalLogs: logs.length
    });
    
    setLastUpdate(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      // تحديث كل 30 ثانية
      const interval = setInterval(refreshStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, period]);

  if (!isOpen) return null;

  const periodLabels = {
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    halfYear: 'نصف سنة',
    year: 'هذه السنة'
  };

  // مكون البطاقة الإحصائية
  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue', trend }) => (
    <div className={`bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:border-${color}-500/50 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg bg-${color}-500/20`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        {trend && (
          <span className={`text-xs px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-gray-400 text-xs">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  // مكون الرسم البياني البسيط
  const SimpleBarChart = ({ data, title }) => {
    const maxValue = Math.max(...Object.values(data), 1);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          {title}
        </h3>
        <div className="flex items-end justify-between h-32 gap-1">
          {hours.filter(h => h >= 7 && h <= 16).map(hour => {
            const value = data[hour] || 0;
            const height = (value / maxValue) * 100;
            return (
              <div key={hour} className="flex flex-col items-center flex-1">
                <div 
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${hour}:00 - ${value} عملية`}
                />
                <span className="text-[10px] text-gray-500 mt-1">{hour}</span>
              </div>
            );
          })}
        </div>
        <p className="text-center text-gray-500 text-xs mt-2">الساعات (7 صباحاً - 4 مساءً)</p>
      </div>
    );
  };

  // مكون إحصائيات العيادات
  const ClinicStats = ({ clinicStats }) => {
    const sortedClinics = Object.entries(clinicStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const maxValue = Math.max(...sortedClinics.map(([_, v]) => v), 1);
    
    return (
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-green-400" />
          أكثر العيادات نشاطاً
        </h3>
        <div className="space-y-3">
          {sortedClinics.map(([clinic, count], index) => (
            <div key={clinic} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-yellow-500 text-black' :
                index === 1 ? 'bg-gray-400 text-black' :
                index === 2 ? 'bg-amber-700 text-white' :
                'bg-gray-700 text-gray-300'
              }`}>
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white text-sm">{clinic}</span>
                  <span className="text-gray-400 text-xs">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {sortedClinics.length === 0 && (
            <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
          )}
        </div>
      </div>
    );
  };

  // مكون إحصائيات أنواع الفحص
  const ExamTypeStats = ({ examStats }) => {
    const sortedExams = Object.entries(examStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-cyan-500'];
    const total = sortedExams.reduce((sum, [_, v]) => sum + v, 0);
    
    return (
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          توزيع أنواع الفحص
        </h3>
        <div className="space-y-3">
          {sortedExams.map(([exam, count], index) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={exam} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm truncate max-w-[150px]">{exam}</span>
                    <span className="text-gray-400 text-xs">{percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          {sortedExams.length === 0 && (
            <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
          )}
        </div>
        
        {/* شريط التوزيع */}
        {sortedExams.length > 0 && (
          <div className="mt-4 h-3 bg-gray-700 rounded-full overflow-hidden flex">
            {sortedExams.map(([exam, count], index) => {
              const percentage = total > 0 ? (count / total) * 100 : 0;
              return (
                <div 
                  key={exam}
                  className={`${colors[index % colors.length]} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                  title={`${exam}: ${Math.round(percentage)}%`}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/95 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-700/50 shadow-2xl">
        {/* الهيدر */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">الإحصائيات الرقمية</h2>
                <p className="text-gray-400 text-sm">إحصائيات حية ومحدثة</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <span className="text-gray-400 text-2xl">×</span>
            </button>
          </div>
          
          {/* فلتر الفترة الزمنية */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {Object.entries(periodLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  period === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={refreshStats}
              className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors mr-auto"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* المحتوى */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              {/* البطاقات الرئيسية */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={Users}
                  title="إجمالي المراجعين"
                  value={stats.uniquePatients}
                  subtitle={`${periodLabels[period]}`}
                  color="blue"
                />
                <StatCard
                  icon={CheckCircle2}
                  title="فحوصات مكتملة"
                  value={stats.completedExams}
                  subtitle="تم إنهاؤها بنجاح"
                  color="green"
                />
                <StatCard
                  icon={Timer}
                  title="متوسط الانتظار"
                  value={`${stats.avgWaitMinutes} د`}
                  subtitle="للمراجع الواحد"
                  color="yellow"
                />
                <StatCard
                  icon={UserX}
                  title="تم تخطيهم"
                  value={stats.skippedPatients}
                  subtitle="لم يحضروا"
                  color="red"
                />
              </div>
              
              {/* بطاقات إضافية */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={UserCheck}
                  title="داخل العيادات الآن"
                  value={stats.currentlyInClinic}
                  subtitle="يتم فحصهم حالياً"
                  color="purple"
                />
                <StatCard
                  icon={TrendingUp}
                  title="ساعة الذروة"
                  value={`${stats.peakHour}:00`}
                  subtitle={`${stats.peakCount} عملية`}
                  color="orange"
                />
                <StatCard
                  icon={Users}
                  title="ذكور"
                  value={stats.byGender.male}
                  subtitle={`${stats.uniquePatients > 0 ? Math.round((stats.byGender.male / stats.uniquePatients) * 100) : 0}%`}
                  color="blue"
                />
                <StatCard
                  icon={Users}
                  title="إناث"
                  value={stats.byGender.female}
                  subtitle={`${stats.uniquePatients > 0 ? Math.round((stats.byGender.female / stats.uniquePatients) * 100) : 0}%`}
                  color="pink"
                />
              </div>
              
              {/* الرسوم البيانية */}
              <div className="grid md:grid-cols-2 gap-4">
                <SimpleBarChart 
                  data={stats.hourlyStats} 
                  title="توزيع العمليات حسب الساعة"
                />
                <ClinicStats clinicStats={stats.byClinic} />
              </div>
              
              {/* إحصائيات أنواع الفحص */}
              <ExamTypeStats examStats={stats.byExamType} />
              
              {/* وقت آخر تحديث */}
              <div className="text-center text-gray-500 text-xs pt-2 border-t border-gray-700/50">
                آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              لا توجد بيانات للعرض
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStatisticsPanel;
