#Requires -Version 5.1
param(
  [switch]$DryRun
)

function Has-CodeCli { return $null -ne (Get-Command code -ErrorAction SilentlyContinue) }

# 1) جمع قائمة الامتدادات
$warnings = @()
if (Has-CodeCli) {
  $extensions = code --list-extensions 2>$null
} else {
  $warnings += "VSCode 'code' CLI not found in PATH; will generate report without uninstall actions."
  $extensions = @()
}
$all = @($extensions)

# تصنيف مبدئي حسب أسماء مشهورة
$builtIn = @() # لا يمكن تمييز المدمج عبر CLI بسهولة
$projectSpecific = @("github.copilot", "github.vscode-pull-request-github", "dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "bradlc.vscode-tailwindcss")
$aiCloud = @("github.copilot")
$experimental = @()

# إضافات غير مرغوبة لتقليل الأدوات
$blocklist = @(
  'ms-python.python', 'ms-toolsai.jupyter', 'ms-toolsai.vscode-ai',
  'ms-azuretools.vscode-azure', 'ms-vscode.azurecli',
  'googlecloudtools.cloudcode', 'redhat.vscode-openshift-connector'
)

$active = @{}
foreach ($e in $all) { $active[$e] = $true }

$keep = @(
  'github.copilot', 'github.vscode-pull-request-github',
  'dbaeumer.vscode-eslint', 'esbenp.prettier-vscode', 'bradlc.vscode-tailwindcss'
)

$toDisable = @()
foreach ($e in $all) {
  if ($blocklist -contains $e) { $toDisable += $e }
}

# 2) تلخيص
$reportPath = Join-Path -Path (Join-Path -Path $PSScriptRoot -ChildPath '..\\.vscode') -ChildPath 'tools_cleanup_report.md'
$beforeCount = $all.Count

# 3) تعطيل
if (-not $DryRun -and (Has-CodeCli)) {
  foreach ($e in $toDisable) {
    try { code --uninstall-extension $e | Out-Null } catch { $warnings += "Failed to uninstall: $e" }
  }
}

# 4) بعد التنظيف
$after = if (Has-CodeCli) { code --list-extensions 2>$null } else { @() }
$afterCount = @($after).Count

# 5) كتابة التقرير
$lines = @()
$lines += "# Tools cleanup report (Copilot/VS Code)"
$lines += ""
$lines += "- Before cleanup: $beforeCount"
$lines += "- After cleanup: $afterCount"
$lines += ""
$lines += "## Kept extensions"
$lines += ($keep | ForEach-Object { "- $_" })
$lines += ""
$lines += "## Disabled extensions"
$lines += ($toDisable | ForEach-Object { "- $_" })
$lines += ""
$lines += "## Warnings"
if ($afterCount -gt 120) {
  $lines += "- Count ($afterCount) > 120 - recommend re-cleanup or manual review of extensions."
} else {
  $lines += "- None"
}

if ($warnings.Count -gt 0) {
  $lines += ""
  $lines += "### System notes"
  $lines += ($warnings | ForEach-Object { "- $_" })
}

$lines += ""
$lines += "## Categories"
$lines += "- Built-In: " + ($builtIn -join ', ')
$lines += "- Project Specific: " + ($projectSpecific -join ', ')
$lines += "- AI/Cloud: " + ($aiCloud -join ', ')
$lines += "- Test/Playground: " + ($experimental -join ', ')

$dir = Split-Path $reportPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -Path $reportPath -Value ($lines -join "`n") -Encoding UTF8

Write-Host "Tools cleanup report written to $reportPath"
