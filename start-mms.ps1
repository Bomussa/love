# ═══════════════════════════════════════════════════════════
# نظام اللجنة الطبية العسكرية - سكربت التشغيل التلقائي
# Medical Committee Management System - Auto Start Script
# ═══════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  نظام اللجنة الطبية العسكرية" -ForegroundColor Yellow
Write-Host "  Medical Committee Management System" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 1. التحقق من المتطلبات
# ─────────────────────────────────────────────────────────────

Write-Host "[1/6] التحقق من المتطلبات..." -ForegroundColor Green

# التحقق من Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ خطأ: Node.js غير مثبت!" -ForegroundColor Red
    Write-Host "  قم بتحميله من: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# التحقق من npm
try {
    $npmVersion = npm --version
    Write-Host "  ✓ npm: v$npmVersion" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ خطأ: npm غير متوفر!" -ForegroundColor Red
    exit 1
}

# التحقق من المجلد
$projectPath = "C:\Users\$env:USERNAME\Desktop\mms-2026"
if (-not (Test-Path $projectPath)) {
    Write-Host "  ✗ خطأ: المشروع غير موجود في: $projectPath" -ForegroundColor Red
    Write-Host "  قم بنسخ المشروع من GitHub أولاً" -ForegroundColor Yellow
    exit 1
}

Set-Location $projectPath
Write-Host "  ✓ المجلد: $projectPath" -ForegroundColor Gray

# ─────────────────────────────────────────────────────────────
# 2. التحقق من قاعدة البيانات
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] التحقق من قاعدة البيانات..." -ForegroundColor Green

# التحقق من خدمة PostgreSQL
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if ($pgService) {
    if ($pgService.Status -eq "Running") {
        Write-Host "  ✓ PostgreSQL يعمل" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ PostgreSQL متوقف، جاري التشغيل..." -ForegroundColor Yellow
        try {
            Start-Service $pgService.Name
            Write-Host "  ✓ تم تشغيل PostgreSQL" -ForegroundColor Gray
        } catch {
            Write-Host "  ✗ فشل تشغيل PostgreSQL" -ForegroundColor Red
            Write-Host "  سيعمل التطبيق بدون قاعدة بيانات" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ⚠ PostgreSQL غير مثبت" -ForegroundColor Yellow
    Write-Host "  سيعمل التطبيق بدون قاعدة بيانات" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────
# 3. التحقق من ملف .env
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] التحقق من الإعدادات..." -ForegroundColor Green

if (Test-Path ".env") {
    Write-Host "  ✓ ملف .env موجود" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ ملف .env غير موجود، جاري الإنشاء..." -ForegroundColor Yellow
    
    $envContent = @"
# Database Configuration
DATABASE_URL=postgresql://admin:password@localhost:5432/medical_center
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456

# Cloudflare Tunnel
TUNNEL_NAME=mms-tunnel
DOMAIN=mmc-mms.com
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "  ✓ تم إنشاء ملف .env" -ForegroundColor Gray
}

# ─────────────────────────────────────────────────────────────
# 4. بناء التطبيق
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/6] بناء التطبيق..." -ForegroundColor Green

# التحقق من وجود dist
if (Test-Path "dist\index.js") {
    Write-Host "  ✓ التطبيق مبني مسبقاً" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ جاري بناء التطبيق..." -ForegroundColor Yellow
    
    # بناء Backend
    npm run build:backend 2>&1 | Out-Null
    
    if (Test-Path "dist\index.js") {
        Write-Host "  ✓ تم بناء Backend بنجاح" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ فشل بناء Backend" -ForegroundColor Red
        exit 1
    }
}

# ─────────────────────────────────────────────────────────────
# 5. تشغيل الخادم
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[5/6] تشغيل الخادم..." -ForegroundColor Green

# إيقاف أي عملية سابقة على المنفذ 3000
$existingProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($existingProcess) {
    $processId = $existingProcess.OwningProcess
    Write-Host "  ⚠ إيقاف العملية السابقة (PID: $processId)..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# تشغيل Backend
Write-Host "  ▶ تشغيل Backend Server..." -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist\index.js" -RedirectStandardOutput "logs\backend.log" -RedirectStandardError "logs\backend-error.log"

# انتظار بدء الخادم
Start-Sleep -Seconds 3

# التحقق من تشغيل الخادم
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/stats" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Backend Server يعمل على http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ فشل تشغيل Backend Server" -ForegroundColor Red
    Write-Host "  راجع السجلات في: logs\backend-error.log" -ForegroundColor Yellow
    exit 1
}

# ─────────────────────────────────────────────────────────────
# 6. تشغيل Cloudflare Tunnel (اختياري)
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[6/6] تشغيل Cloudflare Tunnel..." -ForegroundColor Green

# التحقق من cloudflared
try {
    $cfVersion = cloudflared --version
    Write-Host "  ✓ cloudflared مثبت" -ForegroundColor Gray
    
    # تشغيل النفق
    Write-Host "  ▶ تشغيل النفق..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "cloudflared" -ArgumentList "tunnel run mms-tunnel" -RedirectStandardOutput "logs\tunnel.log" -RedirectStandardError "logs\tunnel-error.log"
    
    Write-Host "  ✓ Cloudflare Tunnel يعمل" -ForegroundColor Green
    Write-Host "  📡 الموقع: https://mmc-mms.com" -ForegroundColor Cyan
    
} catch {
    Write-Host "  ⚠ cloudflared غير مثبت" -ForegroundColor Yellow
    Write-Host "  التطبيق سيعمل محلياً فقط على: http://localhost:3000" -ForegroundColor Yellow
    Write-Host "  لتثبيت cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Gray
}

# ─────────────────────────────────────────────────────────────
# النتيجة النهائية
# ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ تم تشغيل نظام اللجنة الطبية بنجاح!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐 الوصول المحلي:  http://localhost:3000" -ForegroundColor White
Write-Host "  🌍 الوصول الخارجي: https://mmc-mms.com" -ForegroundColor White
Write-Host ""
Write-Host "  📊 لوحة الإدارة:   http://localhost:3000?admin=true" -ForegroundColor Gray
Write-Host "  👤 اسم المستخدم:   admin" -ForegroundColor Gray
Write-Host "  🔑 كلمة المرور:    123456" -ForegroundColor Gray
Write-Host ""
Write-Host "  📝 السجلات:        logs\" -ForegroundColor Gray
Write-Host "  📄 التقارير:       reports\" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# إبقاء النافذة مفتوحة
Write-Host "اضغط أي زر للخروج..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

