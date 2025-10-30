# MMC-MMS Production Monitoring

## نظرة عامة

نظام مراقبة شامل لضمان **الموثوقية الشبه مؤكدة (R > 0.98)** لنظام إدارة طوابير العيادات الطبية.

## المكونات

### 1. Prometheus
- **الدور:** جمع وتخزين المقاييس (Metrics)
- **التكوين:** `prometheus.yml`
- **القواعد:** `alerts.yml`
- **Scrape Interval:** 30 ثانية

### 2. Grafana
- **الدور:** عرض المقاييس والتنبيهات
- **Dashboard:** `grafana-dashboard.json`
- **Refresh Rate:** 30 ثانية

### 3. Metrics Endpoint
- **URL:** `https://rujwuruuosffcxazymit.supabase.co/functions/v1/metrics`
- **Format:** Prometheus text format
- **Authentication:** Supabase anon key

## المقاييس المراقبة

### System Health
- `mmc_system_up`: حالة النظام (1 = يعمل، 0 = متوقف)
- `mmc_reliability`: معدل الموثوقية (0-1)

### Queue Metrics
- `mmc_queue_total`: إجمالي عدد المراجعين
- `mmc_queue_waiting`: عدد المنتظرين
- `mmc_queue_serving`: عدد من يتم خدمتهم
- `mmc_queue_done`: عدد المنتهين

### PIN Metrics
- `mmc_pins_total`: إجمالي أكواد PIN
- `mmc_pins_active`: أكواد PIN النشطة
- `mmc_pins_used`: أكواد PIN المستخدمة

### Error Metrics
- `http_requests_total`: إجمالي الطلبات
- `http_requests_total{status=~"5.."}`: طلبات 5xx

## التنبيهات

### Critical Alerts (فورية)
1. **SystemDown**: النظام متوقف (> 1 دقيقة)
2. **LowReliability**: الموثوقية < 98% (> 2 دقيقة)
3. **CriticalErrorRate**: معدل أخطاء 5xx > 5% (> 1 دقيقة)
4. **QueueStalled**: توقف معالجة الطوابير (> 10 دقائق)
5. **NoPINs**: لا توجد أكواد PIN نشطة (> 1 دقيقة)

### Warning Alerts (تحذيرية)
1. **HighErrorRate**: معدل أخطاء 5xx > 2% (> 2 دقيقة)
2. **QueueBacklog**: تراكم الطوابير > 50 مراجع (> 5 دقائق)
3. **LowPINs**: أكواد PIN النشطة < 5 (> 5 دقائق)

## التثبيت والتشغيل

### 1. تثبيت Prometheus
```bash
# تحميل Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# نسخ التكوين
cp /path/to/monitoring/prometheus.yml ./
cp /path/to/monitoring/alerts.yml ./

# تشغيل Prometheus
./prometheus --config.file=prometheus.yml
```

### 2. تثبيت Grafana
```bash
# تثبيت Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# تشغيل Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

### 3. إعداد Grafana Dashboard
1. افتح Grafana: `http://localhost:3000`
2. تسجيل الدخول: `admin/admin`
3. أضف Prometheus كـ Data Source:
   - URL: `http://localhost:9090`
   - Access: Server
4. استورد Dashboard:
   - Dashboard → Import
   - رفع `grafana-dashboard.json`

### 4. نشر Metrics Edge Function
```bash
cd /path/to/love-supabase
supabase functions deploy metrics --no-verify-jwt
```

## التحقق من عمل النظام

### اختبار Metrics Endpoint
```bash
curl https://rujwuruuosffcxazymit.supabase.co/functions/v1/metrics \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### التحقق من Prometheus
```bash
# التحقق من Targets
curl http://localhost:9090/api/v1/targets

# التحقق من Alerts
curl http://localhost:9090/api/v1/alerts
```

### التحقق من Grafana
```bash
# التحقق من Health
curl http://localhost:3000/api/health
```

## الصيانة

### مراجعة Alerts يومياً
```bash
# عرض Alerts النشطة
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
```

### مراجعة Reliability أسبوعياً
```bash
# حساب Reliability لآخر 7 أيام
curl 'http://localhost:9090/api/v1/query?query=avg_over_time(mmc_reliability[7d])'
```

### Backup التكوينات شهرياً
```bash
# Backup Prometheus config
cp prometheus.yml prometheus.yml.backup.$(date +%Y%m%d)

# Backup Grafana dashboards
curl http://admin:admin@localhost:3000/api/dashboards/db/mmc-mms-production-monitoring > dashboard.backup.$(date +%Y%m%d).json
```

## الدعم الفني

للمساعدة أو الإبلاغ عن مشاكل:
- Email: support@mmc-mms.com
- Documentation: https://mmc-mms.com/docs/monitoring

## الترخيص

© 2025 MMC-MMS. جميع الحقوق محفوظة.
