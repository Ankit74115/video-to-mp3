<#
.SYNOPSIS
  Publishes the local Trackbay cluster on a public HTTPS URL through a Cloudflare quick tunnel.

.DESCRIPTION
  No Cloudflare account needed. Prints a https://<random>.trycloudflare.com address, points
  the notification emails at it, and keeps running until you press Ctrl+C. The address
  changes every time the tunnel starts, so start it shortly before you share the link.
  Requires deploy/local/up.ps1 to have been run.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\local\tunnel.ps1
#>
param(
  [string]$Cluster = "trackbay",
  [int]$Port = 8088
)

$ErrorActionPreference = "Stop"
$env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
            [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + $env:Path
$ctx = "k3d-$Cluster"
$ns = "trackbay"

# ---- cloudflared (portable exe, no admin rights needed) --------------------------
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  $cf = Join-Path $env:LOCALAPPDATA "trackbay\bin\cloudflared.exe"
  if (-not (Test-Path $cf)) {
    Write-Host "Downloading cloudflared..."
    New-Item -ItemType Directory -Force (Split-Path $cf) | Out-Null
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -UseBasicParsing -OutFile $cf `
      -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $sig = Get-AuthenticodeSignature $cf
    if ($sig.Status -ne "Valid" -or $sig.SignerCertificate.Subject -notmatch "Cloudflare") {
      Remove-Item $cf -Force
      throw "Downloaded cloudflared is not signed by Cloudflare; refusing to run it."
    }
  }
}

# ---- the app must be up locally first --------------------------------------------
try {
  Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:$Port/api/health" | Out-Null
} catch {
  throw "Nothing answers on http://localhost:$Port. Run deploy\local\up.ps1 first."
}

# ---- start the tunnel and wait for its URL ---------------------------------------
$log = Join-Path $env:TEMP "trackbay-tunnel.log"
Remove-Item $log -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $cf -NoNewWindow -PassThru -RedirectStandardError $log `
  -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://localhost:$Port"

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if ($proc.HasExited) { Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 15; throw "cloudflared exited." }
  $hit = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($hit) { $url = $hit.Matches[0].Value }
}
if (-not $url) { Stop-Process -Id $proc.Id -Force; throw "No tunnel URL after 60 s. See $log" }

# Wait until the edge actually routes to us (new hostnames take a few seconds in DNS).
$live = $false
for ($i = 0; $i -lt 30 -and -not $live; $i++) {
  try { $live = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$url/api/health").StatusCode -eq 200 }
  catch { Start-Sleep -Seconds 2 }
}

# ---- make emails link to the public address --------------------------------------
$patch = [IO.Path]::GetTempFileName()
try {
  '{"data":{"APP_URL":"' + $url + '"}}' | Set-Content -Path $patch -Encoding ascii
  kubectl --context $ctx -n $ns patch configmap trackbay-config --type merge --patch-file $patch | Out-Null
  kubectl --context $ctx -n $ns rollout restart deployment/notification | Out-Null
} finally {
  Remove-Item $patch -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "  Trackbay is public at:  $url" -ForegroundColor Green
if (-not $live) { Write-Host "  (DNS is still propagating; give it a minute if it does not open yet.)" -ForegroundColor Yellow }
Write-Host "  Uploads over the tunnel are capped at about 100 MB by Cloudflare."
Write-Host "  Keep this window open. Press Ctrl+C to stop the tunnel."
Write-Host ""
try {
  Wait-Process -Id $proc.Id
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
