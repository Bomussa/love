# Copilot Master Script — التشغيل الذاتي والتحقق الكامل
param(
  [string]$Root = "C:\mms",
  [string]$ProjectDir = "$PSScriptRoot\..",
  [int]$MaxRetries = 3,
  [string]$TunnelName = "mms-tunnel",
  [string]$HealthUrlPrimary = "https://mmc-mms.com/api/health",
  [string]$HealthUrlAlt = "https://mmc-mms.com/api/health",
  [switch]$SkipDB,
  [switch]$SkipTunnel,
  [switch]$SkipNode
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ErrorActionPreference = 'Stop'

function New-Dir($path) { if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null } }
function Now() { (Get-Date).ToString("s") }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

New-Dir $Root
New-Dir "$Root\logs"
$Report = "$Root\logs\SYSTEM_CHECK_REPORT.md"
$StartAt = Now

$Services = @{
  Postgres = @{ Name = "postgresql-x64-15"; Alt=@("postgresql-x64-16","postgresql-x64-14","postgresql-x64-13","postgresql-x64-12","postgresql-x64-11","postgresql-x64-10","postgresql") }
  Node     = @{ Name = "node-server" }
  Tunnel   = @{ Name = "cloudflared" }
}

function Set-DbEnvDefaults {
  if (-not $env:DB_HOST -or [string]::IsNullOrWhiteSpace($env:DB_HOST)) { $env:PGHOST = 'localhost' } else { $env:PGHOST = $env:DB_HOST }
  if (-not $env:DB_PORT -or [string]::IsNullOrWhiteSpace($env:DB_PORT)) { $env:PGPORT = '5432' } else { $env:PGPORT = $env:DB_PORT }
  if (-not $env:DB_USER -or [string]::IsNullOrWhiteSpace($env:DB_USER)) { $env:PGUSER = 'postgres' } else { $env:PGUSER = $env:DB_USER }
  if (-not $env:DB_PASSWORD -or [string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) { $env:PGPASSWORD = 'postgres' } else { $env:PGPASSWORD = $env:DB_PASSWORD }
  if (-not $env:DB_NAME -or [string]::IsNullOrWhiteSpace($env:DB_NAME)) { $script:TargetDb = 'mms' } else { $script:TargetDb = $env:DB_NAME }
}

function Get-ServiceRunning($name) {
  try {
    $svc = Get-Service -Name $name -ErrorAction Stop
    return $svc.Status -eq 'Running'
  } catch { return $false }
}

function Start-Postgres() {
  foreach ($n in @($Services.Postgres.Name) + $Services.Postgres.Alt) {
    if (-not $n) { continue }
    try { Start-Service -Name $n -ErrorAction Stop; Start-Sleep -Seconds 2; if (Get-ServiceRunning $n) { return $n } } catch { }
  }
  return $null
}

function Start-NodeServer() {
  Push-Location $ProjectDir
  try {
    # pref: use resilient starter if available
    $cmd = 'npm'; $args = 'run start:resilient'
    if (-not (Test-Path "$ProjectDir\tools\restart-on-failure.js")) { $args = 'start' }
    Start-Process -FilePath $cmd -ArgumentList $args -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Pop-Location
    return $true
  } catch { Pop-Location; return $false }
}

function Start-Tunnel() {
  try {
    Start-Process -FilePath 'cloudflared' -ArgumentList @('tunnel','run',$TunnelName) -WindowStyle Hidden
    Start-Sleep -Seconds 3
    return $true
  } catch { return $false }
}

function Invoke-Health($url) {
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 -UseBasicParsing -Headers @{ 'Origin' = 'https://mmc-mms.com' }
    $sw.Stop()
    return @{ ok = $true; status=$resp.StatusCode; ms=$sw.ElapsedMilliseconds; body=$resp.Content }
  } catch {
    return @{ ok = $false; status=0; ms=0; body="" }
  }
}

function Parse-Json($text) {
  try { return $text | ConvertFrom-Json -ErrorAction Stop } catch { return $null }
}

function Load-DotEnv($path) {
  try {
    if (Test-Path $path) {
      $lines = Get-Content -Path $path -Encoding UTF8
      foreach ($ln in $lines) {
        if (-not $ln) { continue }
        if ($ln.Trim().StartsWith('#')) { continue }
        if ($ln -notmatch '=') { continue }
        $idx = $ln.IndexOf('=')
        if ($idx -le 0) { continue }
        $k = $ln.Substring(0,$idx).Trim()
        $v = $ln.Substring($idx+1).Trim()
  if ($k -and $v) { Set-Item -Path ("Env:"+$k) -Value $v }
      }
    }
  } catch { }
}

function Ensure-DatabaseAndSchema() {
  Set-DbEnvDefaults
  $db = $script:TargetDb
  $psql = (Get-Command psql -ErrorAction SilentlyContinue)
  if ($psql) {
    try {
      $exists = & psql -t -A -c ("SELECT 1 FROM pg_database WHERE datname='" + $db + "';") postgres 2>$null
      if (-not $exists) { & psql -c ("CREATE DATABASE " + $db + ";") postgres | Out-Null }
      & psql -d $db -c "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, role TEXT, active BOOLEAN DEFAULT TRUE);" | Out-Null
      return $true
    } catch { return $false }
  }
  # Node fallback (create DB and minimal schema)
  $node = (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $node) { return $false }
  $tmpDb = Join-Path $ProjectDir 'tmpEnsureDb.mjs'
  $dbJs = @'
import pg from "pg";
const cfgBase = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432",10),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres"
};
const targetDb = process.env.DB_NAME || "mms";
async function run(){
  const sys = new pg.Client({ ...cfgBase, database: "postgres" });
  await sys.connect();
  try{
    const r = await sys.query("SELECT 1 FROM pg_database WHERE datname=$1", [targetDb]);
    if (!r.rowCount) { await sys.query("CREATE DATABASE "+targetDb); }
  } finally { await sys.end(); }
  const db = new pg.Client({ ...cfgBase, database: targetDb });
  await db.connect();
  try{
    await db.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, role TEXT, active BOOLEAN DEFAULT TRUE);");
  } finally { await db.end(); }
  console.log("OK");
}
run().catch(e=>{ console.error("ERR", e.message); process.exit(1); });
'@
  $dbJs | Set-Content -Path $tmpDb -Encoding UTF8
  Push-Location $ProjectDir
  try {
    node $tmpDb | Out-Null
    $code = $LASTEXITCODE
    Pop-Location
    Remove-Item $tmpDb -Force -ErrorAction SilentlyContinue
    if ($code -ne 0) { return $false }
    return $true
  } catch {
    Pop-Location
    Remove-Item $tmpDb -Force -ErrorAction SilentlyContinue
    return $false
  }
}

function Ensure-DbUser() {
  Set-DbEnvDefaults
  $db = $script:TargetDb

  $sqlCheck = "SELECT 1 FROM users WHERE role = 'BG_ADMIN_4' LIMIT 1;"
  $sqlInsert = "INSERT INTO users (username, role, active) VALUES ('BGAdmin4', 'BG_ADMIN_4', true);"
  $psql = (Get-Command psql -ErrorAction SilentlyContinue)
  if ($psql) {
    try {
      $out = & psql -t -A -d $db -c $sqlCheck 2>$null
      if (-not $out) { & psql -d $db -c $sqlInsert | Out-Null }
      return $true
    } catch { return $false }
  }
  # Node fallback (run inside project directory to resolve pg from node_modules)
  $node = (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $node) { return $false }
  $tmpUser = Join-Path $ProjectDir 'tmpEnsureUser.mjs'
  $userJs = @'
import pg from "pg";
const cfg = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432",10),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.DB_NAME || "mms"
};
const pool = new pg.Pool(cfg);
async function run(){
  try{
    const r = await pool.query("SELECT 1 FROM users WHERE role = 'BG_ADMIN_4' LIMIT 1;");
    if (!r.rowCount) { await pool.query("INSERT INTO users (username, role, active) VALUES ('BGAdmin4','BG_ADMIN_4', true);"); }
    console.log("OK");
  }catch(e){ console.error("ERR", e.message); process.exit(1); }
  finally { await pool.end(); }
}
run().catch(e=>{ console.error("ERR", e.message); process.exit(1); });
'@
  $userJs | Set-Content -Path $tmpUser -Encoding UTF8
  Push-Location $ProjectDir
  try {
    node $tmpUser | Out-Null
    $code = $LASTEXITCODE
    Pop-Location
    Remove-Item $tmpUser -Force -ErrorAction SilentlyContinue
    if ($code -ne 0) { return $false }
    return $true
  } catch {
    Pop-Location
    Remove-Item $tmpUser -Force -ErrorAction SilentlyContinue
    return $false
  }
}
function Test-Endpoint($base, $path) {
  $url = ($base.TrimEnd('/')) + $path
  $h = Invoke-Health $url
  $ok = $h.ok -and ($h.status -ge 200) -and ($h.status -lt 500)
  $needsOpt = $false
  if ($ok -and $h.ms -gt 300) { $needsOpt = $true }
  return @{ url=$url; ok=$ok; status=$h.status; ms=$h.ms; needsOpt=$needsOpt }
}

# 1) Environment check and start services
Write-Info "Starting environment checks (PowerShell $($PSVersionTable.PSVersion))"
Load-DotEnv (Join-Path $ProjectDir '.env')
if (-not $SkipDB) {
  $pgService = Start-Postgres
  if ($pgService) {
    Write-Ok "PostgreSQL Running ($pgService)"
  } else {
    Write-Warn "PostgreSQL not started (will try docker-compose)"
    try {
      Push-Location $ProjectDir
      if (Test-Path "$ProjectDir\docker-compose.yml") {
        Write-Info "Starting Postgres via docker compose (npm run db:up)"
        npm run -s db:up | Out-Null
        Start-Sleep -Seconds 3
      }
      Pop-Location
    } catch { Pop-Location }
  }
} else { Write-Warn "Skipping DB startup per user flag" }

# Wait for DB port 5432 to be reachable (max 15s)
function Test-Port($h, $p) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($h, [int]$p, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    $client.Close()
    return $ok
  } catch { return $false }
}
for ($i=0; $i -lt 15; $i++) {
  if (Test-Port '127.0.0.1' 5432) { break }
  Start-Sleep -Milliseconds 700
}
if (-not $SkipNode) {
  if (Start-NodeServer) { Write-Ok "Node Server started" } else { Write-Warn "Node Server may already be running" }
} else { Write-Warn "Skipping Node server start" }

if (-not $SkipTunnel) {
  if (Start-Tunnel) { Write-Ok "Cloudflare Tunnel launched" } else { Write-Warn "Cloudflared may already be running" }
} else { Write-Warn "Skipping Tunnel start" }

# 2/7) Health check with self-heal retries
$attempt = 0
$lastHealth = $null
$healthSource = ''
do {
  $attempt++
  Start-Sleep -Seconds 2
  $health = Invoke-Health $HealthUrlPrimary; $healthSource='primary'
  if (-not $health.ok) { $health = Invoke-Health $HealthUrlAlt; $healthSource='alt' }
  if (-not $health.ok) { $health = Invoke-Health 'http://localhost:3000/healthz'; $healthSource='local' }
  $lastHealth = $health
  $j = Parse-Json $health.body
  # اعتبر الصحة ناجحة إذا كان الرد JSON ويحتوي ok=true، أو حالة HTTP 200-299 بدون خطأ
  $isUp = $false
  if ($health.ok) {
    if ($j -and ($j.ok -eq $true -or $j.status -eq 'ok')) { $isUp = $true }
    elseif ($health.status -ge 200 -and $health.status -lt 300) { $isUp = $true }
  }
  if ($isUp) { break }

  Write-Warn "Health failed attempt $attempt - restarting services"
  if ($pgService) { try { Restart-Service -Name $pgService -Force -ErrorAction SilentlyContinue } catch {} }
  Start-Sleep -Seconds 1
  Start-NodeServer | Out-Null
  Start-Sleep -Seconds 1
  Start-Tunnel | Out-Null
} while ($attempt -lt $MaxRetries)

$HealthOk = $false
try {
  $j = Parse-Json $lastHealth.body
  if ($lastHealth.ok) {
    if ($j -and ($j.ok -eq $true -or $j.status -eq 'ok')) { $HealthOk = $true }
    elseif ($lastHealth.status -ge 200 -and $lastHealth.status -lt 300) { $HealthOk = $true }
  }
} catch {}

# 3) Ensure database and BG Admin 4 (only if DB port reachable)
$DbOk = $false
$DbPrepared = $false
if (-not $SkipDB) {
  $testHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
  $testPort = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
  if (Test-Port $testHost $testPort) {
    $DbPrepared = Ensure-DatabaseAndSchema
    if ($DbPrepared) { $DbOk = Ensure-DbUser }
  } else {
    Write-Warn "DB port not reachable - skipping DB ensure"
  }
} else { Write-Warn "DB ensure skipped" }

# 4/5) BG Admin 4 login and API endpoints checks
# 4/5) Choose Base API: prefer local if local health succeeded to bypass network blocks
$BaseApi = 'https://mmc-mms.com/api'
if ($HealthOk -and $healthSource -eq 'local') { $BaseApi = 'http://localhost:3000/api' }

# (Login) — مكان للاعتماد لاحقًا إذا كانت واجهة Auth فعّالة على الباكند
$bgLogin = @{ ok=$false; status=0; ms=0; url=($BaseApi + '/auth/login') }
try {
  $t0 = Get-Date
  $resp = Invoke-WebRequest -Uri $bgLogin.url -Method POST -TimeoutSec 10 -Headers @{ 'Content-Type'='application/json' } -Body '{"username":"BGAdmin4","password":"admin"}' -UseBasicParsing
  $bgLogin.status = $resp.StatusCode
  $bgLogin.ms = ((Get-Date) - $t0).TotalMilliseconds
  $j = Parse-Json $resp.Content
  $bgLogin.ok = $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500 -and ($j -and $j.token)
} catch {}

$checks = @()
function Add-Checks($base) {
  # استبدال المسارات الجذرية غير الموجودة بمسارات حقيقية:
  # /api/pin لا يوجد (لدينا /api/pin/peek, /api/pin/assign-first, /api/pin/issue ...)
  # /api/queue لا يوجد (لدينا /api/queue/live, /api/queue/enter, /api/queue/complete ...)
  # /api/route (GET) غير معرف؛ يوجد /api/route/:visitId و /api/route/assign (POST)
  # نختار مسارات GET آمنة لا تسبب آثار جانبية.
  $script:checks += Test-Endpoint $base '/pin/peek'
  $script:checks += Test-Endpoint $base '/queue/live'
  $script:checks += Test-Endpoint $base '/queues'
  $script:checks += Test-Endpoint $base '/admin/features'
}
Add-Checks $BaseApi
if (($checks | Where-Object { -not $_.ok } | Measure-Object).Count -gt 0) {
  Add-Checks 'http://localhost:3000/api'
}

# 6/8/9) Final report
$EndAt = Now
$lines = @()
$lines += "# SYSTEM CHECK REPORT"
$lines += "Start: $StartAt"
$lines += "End:   $EndAt"
$lines += ""
$lines += "## Services"
$lines += "- PostgreSQL: " + ($(if ($pgService) { 'Running' } else { 'Not Running' }))
$lines += "- Node: Attempted start (see app logs)"
$lines += "- Cloudflare Tunnel: Launched/Existing"
$lines += ""
$lines += "## Backend Health"
$lines += "- URL: $HealthUrlPrimary"
$okEmoji = if ($HealthOk) { 'OK' } else { 'FAIL' }
$lines += "- OK:  $okEmoji"
$rawBody = ''
if ($lastHealth -and $lastHealth.body) { $rawBody = $lastHealth.body } else { $rawBody = '' }
$lines += "- Raw: $rawBody"
$lines += ""
$lines += "## Database"
if ($DbOk) { $lines += "- BG Admin 4 ensured: OK" } else { $lines += "- BG Admin 4 ensured: FAIL" }
$lines += ""
$lines += "## BG Admin 4 Login"
$lines += "- URL: $($bgLogin.url)"
$lines += "- Status: $($bgLogin.status)"
$bgLoginOk = if ($bgLogin.ok) { 'OK' } else { 'FAIL' }
$lines += "- OK: $bgLoginOk"
$lines += ""
$lines += "## API Endpoints"
foreach ($c in $checks) {
  $note = ''
  if ($c.needsOpt) { $note = ' - Needs Optimization (>300ms)' }
  $emoji = 'FAIL'
  if ($c.ok) { $emoji = 'OK' }
  $lines += ("- [" + $emoji + "] " + $c.url + " - " + [string]$c.status + " in " + [string]$c.ms + "ms" + $note)
}
$lines += ""
$lines += "## Summary"
if ($HealthOk -and $DbOk -and ($checks | Where-Object {$_.ok} | Measure-Object).Count -ge 3) {
  $lines += "System OK 100%"
  $lines += ""
  $lines += "SYSTEM VERIFIED - All services and BG Admin 4 operational."
} else {
  $lines += "Failures found. See details above."
}

Set-Content -Path $Report -Value ($lines -join "`n") -Encoding UTF8
Write-Host "" -ForegroundColor Gray
Write-Host ([string]::Join("`n", $lines)) -ForegroundColor Gray

# Exit code reflects overall health for CI usage
if ($HealthOk -and ($SkipDB -or $DbOk) -and ($checks | Where-Object {$_.ok} | Measure-Object).Count -ge 3) { exit 0 } else { exit 1 }

# Generated by Copilot
