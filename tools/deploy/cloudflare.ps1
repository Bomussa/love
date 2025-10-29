param(
  [string]$Mode = 'auto',               # auto | quick | token | official
  [int]$Port = 3000,                    # Local app port
  [string]$Domain = 'mmc-mms.com',      # Used if CF_URL not provided
  [string]$TunnelName = 'mms-tunnel',   # For named tunnels when token/cert configured
  [string]$LogFile = 'logs/cloudflared.log',
  [string]$PublicUrlFile = 'logs/public_url.txt'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Dir($p) {
  if (-not (Test-Path $p)) { [void](New-Item -ItemType Directory -Path $p) }
}

function Find-Cloudflared {
  $localPath = Join-Path -Path (Join-Path -Path $PSScriptRoot -ChildPath '.') -ChildPath 'cloudflared.exe'
  $toolsPath = Join-Path -Path $PSScriptRoot -ChildPath '..\..\deploy\cloudflared\cloudflared.exe'
  $paths = @($localPath, $toolsPath)
  foreach ($p in $paths) { if (Test-Path $p) { return (Resolve-Path $p).Path } }
  # Try PATH
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Download-Cloudflared($dest) {
  Ensure-Dir (Split-Path -Parent $dest)
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Write-Host "[cloudflared] Downloading from $url ..."
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  Write-Host "[cloudflared] Saved to $dest"
}

function Write-PublicUrl($url) {
  Ensure-Dir (Split-Path -Parent $PublicUrlFile)
  $url.Trim() | Out-File -FilePath $PublicUrlFile -Encoding utf8 -Force
  Write-Host "[cloudflared] Public URL: $url"
}

function Start-QuickTunnel($cfPath, $uri) {
  Ensure-Dir (Split-Path -Parent $LogFile)
  if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction SilentlyContinue }
  $args = @('tunnel','--no-autoupdate','--loglevel','info','--logfile', $LogFile, '--url', $uri)
  Write-Host "[cloudflared] Starting Quick Tunnel to $uri ..."
  $proc = Start-Process -FilePath $cfPath -ArgumentList $args -PassThru -WindowStyle Hidden
  # Wait for URL to appear in log
  $deadline = (Get-Date).AddMinutes(2)
  $public = $null
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $LogFile) {
      $text = Get-Content -Path $LogFile -Raw -ErrorAction SilentlyContinue
      if ($text) {
        $m = [regex]::Match($text, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
        if ($m.Success) { $public = $m.Value; break }
      }
    }
  }
  if (-not $public) { Write-Warning '[cloudflared] Could not detect public URL in logs. Check logs/cloudflared.log'; return }
  Write-PublicUrl $public
  Write-Host '[cloudflared] Tunnel running in background. Press Ctrl+C to stop if running in foreground.'
}

try {
  Ensure-Dir 'logs'

  $cf = Find-Cloudflared
  if (-not $cf) {
    $preferred = Join-Path -Path $PSScriptRoot -ChildPath 'cloudflared.exe'
    Download-Cloudflared -dest $preferred
    $cf = $preferred
  }

  if ($Mode -eq 'official') {
    Write-Host '[cloudflared] Creating and configuring official named tunnel ...'
    # Create named tunnel (idempotent; will exit non-zero if exists, ignore errors)
    try { & $cf tunnel create $TunnelName } catch { Write-Host "[cloudflared] tunnel may already exist: $TunnelName" }
    # Route DNS to the tunnel
    try { & $cf tunnel route dns $TunnelName $Domain } catch { Write-Host "[cloudflared] DNS route may already exist for $Domain" }
    # Write config.yml to user profile
    $home = $env:USERPROFILE
    $cfDir = Join-Path $home '.cloudflared'
    Ensure-Dir $cfDir
    $cred = Join-Path $cfDir ("$TunnelName.json")
    $cfgPath = Join-Path $cfDir 'config.yml'
    $cfg = @(
      "tunnel: $TunnelName",
      "credentials-file: $cred",
      "ingress:",
      "  - hostname: $Domain",
      "    service: http://localhost:$Port",
      "  - service: http_status:404"
    ) -join "`n"
    Set-Content -Path $cfgPath -Value $cfg -Encoding UTF8
    Write-Host "[cloudflared] Wrote config: $cfgPath"
    # Install and start Windows service
    try {
      & $cf service install | Out-Null
      Write-Host '[cloudflared] Service installed.'
    } catch { Write-Host '[cloudflared] Service may already be installed.' }
    try { Start-Service cloudflared -ErrorAction Stop } catch { Write-Host '[cloudflared] Service already running or requires elevation.' }
    Write-PublicUrl ("https://$Domain")
    return
  }

  $useToken = $false
  if ($Mode -eq 'token' -or $env:CF_TUNNEL_TOKEN) { $useToken = $true }

  if ($useToken) {
    $token = $env:CF_TUNNEL_TOKEN
    if (-not $token) { throw 'CF_TUNNEL_TOKEN environment variable is required for token mode.' }
    Write-Host '[cloudflared] Starting named tunnel using CF_TUNNEL_TOKEN ...'
    # Best-effort: write domain/CF_URL if provided
    $cfUrl = if ($env:CF_URL) { $env:CF_URL } elseif ($Domain) { "https://$Domain" } else { '' }
    if ($cfUrl) { Write-PublicUrl $cfUrl }
    $args = @('tunnel','--no-autoupdate','run','--token', $token)
    & $cf @args
  } else {
    $local = "http://localhost:$Port"
    Start-QuickTunnel -cfPath $cf -uri $local
  }
}
catch {
  Write-Error $_
  exit 1
}
