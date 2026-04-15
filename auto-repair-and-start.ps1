# ================================================================
# 🧠 auto-repair-and-start.ps1
# سكربت ذكي لإصلاح وتشغيل خادم مشروع 2026 تلقائيًا
# إعداد إياد - نسخة محسّنة 100% بدون تدخل يدوي
# ================================================================

$ErrorActionPreference = 'Stop'
Write-Host "`n🚀 بدء فحص النظام وإصلاحه..." -ForegroundColor Cyan

# 1️⃣ تحديد المسارات الأساسية
$projectRoot = "C:\Users\USER\OneDrive\Desktop\تجميع من 3\الملازم غانم"
$srcCore     = "$projectRoot\src\core"
$distCore    = "$projectRoot\dist_server\core"
$indexFile   = "$projectRoot\dist_server\index.js"
$envFile     = "$projectRoot\.env"

# 2️⃣ ضبط المتغيرات البيئية الأساسية
$env:PORT = "8096"
$env:HEALTH_STRICT = "false"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:DB_NAME = "mms"
$env:SITE_ORIGIN = "https://mmc-mms.com"

# 3️⃣ فحص وجود core في dist_server
if (!(Test-Path $distCore)) {
  Write-Host "⚠️ لم يتم العثور على dist_server/core، يتم إنشاؤه..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $distCore | Out-Null
}

# 4️⃣ نسخ الملفات الناقصة من src/core إلى dist_server/core
if (Test-Path $srcCore) {
  $srcFiles = Get-ChildItem $srcCore -Filter *.js -Recurse -ErrorAction SilentlyContinue
  foreach ($file in $srcFiles) {
    $relativePath = $file.FullName.Replace($srcCore, "").TrimStart("\")
    $dest = Join-Path $distCore $relativePath
    $destDir = Split-Path $dest -Parent
    if (!(Test-Path $destDir)) {
      New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    if (!(Test-Path $dest)) {
      Copy-Item $file.FullName $dest -Force
      Write-Host "✅ تم نسخ: $relativePath"
    }
  }
}

# 5️⃣ التحقق من وجود index.js بعد البناء
if (!(Test-Path $indexFile)) {
  Write-Host "⚙️ ملف index.js غير موجود، جاري تنفيذ build..." -ForegroundColor Yellow
  cd $projectRoot
  if (Test-Path "$projectRoot\package.json") {
    npm run build 2>&1 | Out-Null
  } else {
    Write-Host "❌ لم يتم العثور على package.json، تأكد من مسار المشروع!" -ForegroundColor Red
    exit 1
  }
}

# 6️⃣ إيقاف أي عمليات node قديمة تعمل على المنفذ
Write-Host "`n🔄 إيقاف أي عمليات node قديمة..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { 
  $_.Path -like "*الملازم*" -or $_.CommandLine -like "*8096*" 
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# 7️⃣ تشغيل الخادم
Write-Host "`n🟢 تشغيل خادم 2026 على المنفذ 8096 ..." -ForegroundColor Green
cd $projectRoot
$serverProcess = Start-Process -FilePath "node" -ArgumentList ".\dist_server\index.js" -PassThru -WindowStyle Hidden

# 8️⃣ الانتظار قليلاً للسماح بالتشغيل
Write-Host "⏳ انتظار بدء الخادم..." -ForegroundColor Gray
Start-Sleep -Seconds 8

# 9️⃣ اختبار الصحة /healthz
Write-Host "`n🧠 فحص صحة النظام..." -ForegroundColor Cyan
$healthOk = $false
$retries = 3
for ($i = 1; $i -le $retries; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8096/healthz" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match '"ok":true') {
      Write-Host "✅ النظام يعمل بكفاءة كاملة!" -ForegroundColor Green
      $healthOk = $true
      break
    } else {
      Write-Host "⚠️ النظام يعمل جزئياً. محاولة $i من $retries" -ForegroundColor Yellow
    }
  }
  catch {
    Write-Host "❌ محاولة $i من $retries فشلت. إعادة المحاولة..." -ForegroundColor Red
    Start-Sleep -Seconds 3
  }
}

if (!$healthOk) {
  Write-Host "`n🔧 إعادة تشغيل النظام بعد فشل الصحة..." -ForegroundColor Yellow
  Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  $serverProcess = Start-Process -FilePath "node" -ArgumentList ".\dist_server\index.js" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 8
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8096/healthz" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match '"ok":true') {
      Write-Host "✅ النظام يعمل بعد إعادة التشغيل!" -ForegroundColor Green
      $healthOk = $true
    }
  }
  catch {
    Write-Host "❌ فشل بدء النظام. تحقق من الأخطاء يدوياً." -ForegroundColor Red
  }
}

# 🔟 اختبار داخلي لكل خدمة
if ($healthOk) {
  Write-Host "`n🔍 فحص الخدمات الفردية..." -ForegroundColor Cyan
  $services = @(
    @{Name="PIN"; Url="/api/pin/peek?clinicId=opd-1"},
    @{Name="Queue"; Url="/api/queue/live"},
    @{Name="Route"; Url="/api/route/test-visit"},
    @{Name="Events SSE"; Url="/api/events/pull"}
  )
  
  foreach ($s in $services) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:8096$($s.Url)" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
      if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 404) {
        Write-Host "✅ [$($s.Name)] متصل" -ForegroundColor Green
      } else {
        Write-Host "⚠️ [$($s.Name)] رد بكود $($r.StatusCode)" -ForegroundColor Yellow
      }
    }
    catch {
      Write-Host "⚠️ [$($s.Name)] غير متاح حالياً" -ForegroundColor DarkYellow
    }
  }
}

# 1️⃣1️⃣ النتيجة النهائية
Write-Host "`n🎯 اكتمل الفحص والإصلاح." -ForegroundColor Cyan
if ($healthOk) {
  Write-Host "🔁 السيرفر يعمل على http://127.0.0.1:8096" -ForegroundColor Green
  Write-Host "📊 لوحة الإدارة: http://127.0.0.1:8096/admin/dashboard" -ForegroundColor Gray
  Write-Host "🔔 إشعارات SSE: http://127.0.0.1:8096/api/events" -ForegroundColor Gray
  Write-Host "`n💡 Process ID: $($serverProcess.Id)" -ForegroundColor DarkGray
} else {
  Write-Host "❌ النظام لم يبدأ بشكل صحيح. راجع الأخطاء أعلاه." -ForegroundColor Red
}

# ================================================================
