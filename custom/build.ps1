# Build, sign and (optionally) install the custom TizenBrew.
#   .\custom\build.ps1             build -> custom\build\AdFreeTube.wgt
#   .\custom\build.ps1 -Install    ...and install it (TV Host PC IP must be this PC while installing)
# Changes vs upstream v2.0.5: icon home screen with official logos, autolaunch fix (issue #151),
# own package id (AdFreeTube) so it is signed with your own certificate.
param(
    [string]$SignProfile = 'CleanTube',     # from: tizen security-profiles list
    [string]$Tv = $env:TIZEN_TV_IP,          # the TV's IP (set TIZEN_TV_IP, e.g. in env.ps1)
    [switch]$Install
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\env.ps1"              # Tizen Studio + JDK paths (tv\env.ps1)
if (-not $Tv) { $Tv = $env:TIZEN_TV_IP }   # env.ps1 sets it
$tb  = Join-Path $PSScriptRoot '..\tizenbrew-app\TizenBrew' | Resolve-Path
$svc = Join-Path $tb 'service-nextgen\service'
$ui  = Join-Path $tb 'tizenbrew-ui'
$out = Join-Path $PSScriptRoot 'build'

function Invoke-Tool([string]$cmd, [string]$dir) {
    # npm/npx/tizen are .cmd/.bat files: run through cmd, stop on failure.
    Push-Location $dir
    try {
        cmd /c "$cmd < nul 2>&1" | Write-Host
        if ($LASTEXITCODE -ne 0) { throw "Failed: $cmd" }
    } finally { Pop-Location }
}

# 1. App icon: flask with apps and a plus (custom\icon.svg rendered to custom\tizenbrew-icon.png, 512x512).
Copy-Item (Join-Path $PSScriptRoot 'tizenbrew-icon.png') "$tb\icon.png" -Force

# 2. Test the autolaunch fix, then build the service (Babel for old Tizen Node, bundled to dist\index.js) and UI.
node "$PSScriptRoot\test-pending-launch.js"
if ($LASTEXITCODE -ne 0) { throw 'Autolaunch fix test failed' }
node "$PSScriptRoot\test-fixes.js"
if ($LASTEXITCODE -ne 0) { throw 'Fixes loader test failed' }
Invoke-Tool 'npm run build' $svc
Remove-Item "$svc\transpiled" -Recurse -Force -ErrorAction SilentlyContinue
# Run the built service on this PC and talk to it like the TV interface does (needs internet; warning only).
node "$PSScriptRoot\test-service.js" | Select-String 'PASS|FAIL' | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { Write-Warning 'Service test failed (offline, or port 8081 busy?). Check before installing.' }
Invoke-Tool 'npm run build' $ui

# 3. Tizen web build (no sources, no node_modules) and signing.
Remove-Item "$tb\.buildResult" -Recurse -Force -ErrorAction SilentlyContinue
Invoke-Tool 'tizen build-web -e ".*" -e "node_modules/*" -e "*/node_modules/*" -e "package*.json" -e "tizenbrew-ui/src/*" -e "*.md" -- .' $tb
Invoke-Tool "tizen package -t wgt -s $SignProfile -- .buildResult" $tb
New-Item -ItemType Directory -Force $out | Out-Null
$wgt = Get-ChildItem "$tb\.buildResult\*.wgt" | Select-Object -First 1
Copy-Item $wgt.FullName "$out\AdFreeTube.wgt" -Force
Write-Host "Built $out\AdFreeTube.wgt ($([math]::Round((Get-Item "$out\AdFreeTube.wgt").Length/1KB)) KB)" -ForegroundColor Green

if ($Install) {
    sdb connect $Tv | Write-Host
    Invoke-Tool "tizen install -n AdFreeTube.wgt -s ${Tv}:26101 -- `"$out`"" $out
}
