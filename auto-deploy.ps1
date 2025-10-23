# 🚀 سكريبت النشر والاختبار التلقائي
# Auto Deploy, Test & Update Script

param(
    [Parameter(Mandatory = $true)]
    [string]$CommitMessage,
    
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    🚀 بدء عملية النشر التلقائي" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# التأكد من وجود repository 2027
$repoPath = "C:\Users\USER\OneDrive\Desktop\تجميع من 3\2027"
if (!(Test-Path $repoPath)) {
    Write-Host "❌ المشروع 2027 غير موجود في: $repoPath" -ForegroundColor Red
    exit 1
}

Set-Location $repoPath

# 1️⃣ نسخة احتياطية
Write-Host "1️⃣  إنشاء نسخة احتياطية..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups/auto-backup-$timestamp"

if (!(Test-Path "backups")) {
    New-Item -ItemType Directory -Path "backups" | Out-Null
}

Copy-Item "src" $backupDir -Recurse -Force
Write-Host "   ✅ نسخة احتياطية في: $backupDir" -ForegroundColor Green

# 2️⃣ التأكد من التغييرات
Write-Host "`n2️⃣  التحقق من التغييرات..." -ForegroundColor Cyan
$changes = git status --porcelain
if (!$changes) {
    Write-Host "   ⚠️  لا توجد تغييرات للنشر" -ForegroundColor Yellow
    exit 0
}

Write-Host "   ✅ وجدت تغييرات:" -ForegroundColor Green
git status --short

# 3️⃣ بناء المشروع
Write-Host "`n3️⃣  بناء المشروع..." -ForegroundColor Cyan
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ فشل البناء!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ البناء نجح" -ForegroundColor Green

# 4️⃣ اختبار محلي (إذا لم يتم تخطيه)
if (!$SkipTests) {
    Write-Host "`n4️⃣  اختبار محلي..." -ForegroundColor Cyan
    
    # تشغيل السيرفر في الخلفية
    $serverProcess = Start-Process -FilePath "node" `
        -ArgumentList "dist/index.js" `
        -WindowStyle Hidden `
        -PassThru

    Start-Sleep -Seconds 3

    try {
        # اختبار الصفحة الرئيسية
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ السيرفر يعمل بنجاح" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   ⚠️  تحذير: فشل الاختبار المحلي" -ForegroundColor Yellow
    }
    finally {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host "`n4️⃣  تم تخطي الاختبارات" -ForegroundColor Gray
}

# 5️⃣ Git commit & push
Write-Host "`n5️⃣  رفع التغييرات إلى GitHub..." -ForegroundColor Cyan

git add .
git commit -m "$CommitMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ فشل الـ commit" -ForegroundColor Red
    exit 1
}

git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ فشل الـ push" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ تم رفع التغييرات إلى GitHub" -ForegroundColor Green

# الحصول على commit hash
$commitHash = git rev-parse --short HEAD
Write-Host "   📌 Commit: $commitHash" -ForegroundColor Gray

# 6️⃣ نشر على Cloudflare Pages
Write-Host "`n6️⃣  نشر على Cloudflare Pages..." -ForegroundColor Cyan

$deployOutput = wrangler pages deploy dist --project-name=2027 --branch=main 2>&1
$deploymentUrl = ""

foreach ($line in $deployOutput) {
    Write-Host "   $line" -ForegroundColor Gray
    if ($line -match "https://[^\s]+\.pages\.dev") {
        $deploymentUrl = $matches[0]
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ فشل النشر على Cloudflare" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ تم النشر على Cloudflare Pages" -ForegroundColor Green

# 7️⃣ اختبار الموقع المنشور
Write-Host "`n7️⃣  اختبار الموقع المنشور..." -ForegroundColor Cyan

$testUrls = @(
    "https://2027-5a0.pages.dev",
    "https://www.mmc-mms.com"
)

foreach ($url in $testUrls) {
    Write-Host "   🔍 اختبار: $url" -ForegroundColor Gray
    
    try {
        Start-Sleep -Seconds 2
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $url يعمل بنجاح" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠️  $url رد بحالة: $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "   ❌ $url لا يستجيب: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 8️⃣ فتح الموقع في المتصفح
Write-Host "`n8️⃣  فتح الموقع للمراجعة..." -ForegroundColor Cyan
Start-Process "https://2027-5a0.pages.dev"

# 9️⃣ تسجيل النشر
Write-Host "`n9️⃣  تسجيل النشر..." -ForegroundColor Cyan

$deployLog = @{
    timestamp     = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    commit        = $commitHash
    message       = $CommitMessage
    deploymentUrl = $deploymentUrl
    backup        = $backupDir
} | ConvertTo-Json

if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

$deployLog | Out-File "logs/deployment-$timestamp.json" -Encoding UTF8
Write-Host "   ✅ تم تسجيل النشر في: logs/deployment-$timestamp.json" -ForegroundColor Green

# النتيجة النهائية
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "    ✅ اكتمل النشر بنجاح!" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📊 ملخص النشر:" -ForegroundColor Cyan
Write-Host "  • Commit: $commitHash" -ForegroundColor White
Write-Host "  • الرسالة: $CommitMessage" -ForegroundColor White
Write-Host "  • النسخة الاحتياطية: $backupDir" -ForegroundColor White
Write-Host "  • الموقع: https://2027-5a0.pages.dev" -ForegroundColor White
Write-Host ""
Write-Host "🌐 الروابط:" -ForegroundColor Cyan
Write-Host "  • Production: https://2027-5a0.pages.dev" -ForegroundColor White
Write-Host "  • Custom Domain: https://www.mmc-mms.com" -ForegroundColor White
Write-Host "  • GitHub: https://github.com/Bomussa/2027/commit/$commitHash" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
