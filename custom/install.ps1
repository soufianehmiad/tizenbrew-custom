# Install the custom TizenBrew from this PC.
#   .\custom\install.ps1            (builds first if custom\build\AdFreeTube.wgt is missing)
# Needs the TV's Developer Mode "Host PC IP" set to this PC. Afterwards set it back to 127.0.0.1.
param(
    [string]$Tv = $env:TIZEN_TV_IP,          # the TV's IP (set TIZEN_TV_IP, e.g. in env.ps1)
    [switch]$Rebuild
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\env.ps1"
if (-not $Tv) { $Tv = $env:TIZEN_TV_IP }   # env.ps1 sets it
if (-not $Tv) { throw 'Set the TV IP: -Tv <ip>, or $env:TIZEN_TV_IP in env.ps1' }
$wgt = Join-Path $PSScriptRoot 'build\AdFreeTube.wgt'

function Invoke-Tool([string]$cmd) {
    cmd /c "$cmd < nul 2>&1" | Where-Object { $_ -notmatch 'installing\[|updating\[' } | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "Failed: $cmd" }
}

# 1. Is the TV on, and does it accept this PC?
try {
    $dev = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://${Tv}:8001/api/v2/").Content | ConvertFrom-Json
} catch {
    throw "The TV at $Tv is not reachable. Turn it on (same network) and try again."
}
$myIps = (Get-NetIPAddress -AddressFamily IPv4).IPAddress
if ($dev.device.developerMode -ne '1' -or $myIps -notcontains $dev.device.developerIP) {
    Write-Host "The TV's Host PC IP is $($dev.device.developerIP), so it won't accept this PC." -ForegroundColor Yellow
    Write-Host "On the TV: Apps > type 12345 > Host PC IP = this PC's Wi-Fi IP > OK > hold power until the logo."
    exit 1
}

# 2. Build if needed, connect.
if ($Rebuild -or -not (Test-Path $wgt)) { & "$PSScriptRoot\build.ps1" }
sdb connect $Tv | Write-Host
$target = "${Tv}:26101"

# 3. Install TizenBrew (custom). Updates go this way (Host PC IP switch), not via the TizenBrew Installer app.
Invoke-Tool "tizen install -n AdFreeTube.wgt -s $target -- `"$(Split-Path $wgt)`""

Write-Host ''
Write-Host 'Installed. Last step on the TV:' -ForegroundColor Green
Write-Host 'Apps > type 12345 > Host PC IP = 127.0.0.1 > OK > hold power until the logo.'
