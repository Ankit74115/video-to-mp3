<#
.SYNOPSIS
  Runs Trackbay on a local single-node Kubernetes cluster (k3d = k3s in Docker).

.DESCRIPTION
  First run creates the cluster. Every run then builds the five images with docker compose,
  imports them into the cluster, (re)creates the secret from the repo's .env, applies
  deploy/k8s and waits until everything is ready. Safe to run again after code changes.

  App:        http://localhost:8088
  Public URL: run deploy/local/tunnel.ps1 afterwards.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\local\up.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\local\up.ps1 -SkipBuild
#>
param(
  [string]$Cluster = "trackbay",
  [int]$Port = 8088,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

# winget installs update PATH for new shells only; pick them up here too.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
            [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + $env:Path

$ctx = "k3d-$Cluster"
$ns = "trackbay"
$services = @("auth", "gateway", "converter", "notification", "frontend")

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# Native tools log progress on stderr. Windows PowerShell 5.1 turns that into errors, which
# would abort the script under "Stop", so run them with "Continue" and check the exit code.
function Exec([scriptblock]$Block) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Block; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
  if ($code -ne 0) { throw "Command failed (exit $code): $Block" }
}
function Succeeds([scriptblock]$Block) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Block *> $null; return ($LASTEXITCODE -eq 0) } finally { $ErrorActionPreference = $prev }
}
function Need($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "$name is not installed. $hint" }
}

Need docker  "Install Docker Desktop and start it."
Need kubectl "winget install -e --id Kubernetes.kubectl"
Need k3d     "winget install -e --id k3d.k3d"
if (-not (Succeeds { docker info })) { throw "Docker is not running. Start Docker Desktop and try again." }

# ---- settings from .env ----------------------------------------------------------
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { throw "No .env in $root. Copy .env.example to .env and fill in the secrets." }
$cfg = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
  }
}
foreach ($k in "MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "JWT_SECRET") {
  if (-not $cfg[$k]) { throw "$k is empty in .env" }
}
if (-not $cfg["RABBITMQ_USER"]) { $cfg["RABBITMQ_USER"] = "guest" }
if (-not $cfg["RABBITMQ_PASSWORD"]) { $cfg["RABBITMQ_PASSWORD"] = "guest" }
$cfg["RABBITMQ_URL"] = "amqp://{0}:{1}@rabbitmq:5672/%2F" -f `
  [uri]::EscapeDataString($cfg["RABBITMQ_USER"]), [uri]::EscapeDataString($cfg["RABBITMQ_PASSWORD"])

# ---- cluster ---------------------------------------------------------------------
Step "Cluster $Cluster"
if (Succeeds { k3d cluster get $Cluster }) {
  Exec { k3d cluster start $Cluster --wait --timeout 300s }
} else {
  # Docker Desktop's WSL kernel may still use cgroup v1, which the kubelet
  # refuses by default since Kubernetes 1.35.
  Exec {
    k3d cluster create $Cluster --servers 1 --agents 0 `
      -p "${Port}:80@loadbalancer" `
      --k3s-arg "--disable=metrics-server@server:0" `
      --k3s-arg "--kubelet-arg=fail-cgroupv1=false@server:0" `
      --wait --timeout 300s
  }
}
Exec { kubectl config use-context $ctx }

# ---- images ----------------------------------------------------------------------
$images = $services | ForEach-Object { "trackbay/${_}:local" }
if (-not $SkipBuild) {
  Step "Building images"
  $env:IMAGE_PREFIX = "trackbay"
  $env:IMAGE_TAG = "local"
  Exec { docker compose build @services }
}
# Also hand over the database and broker images if Docker already has them, so the
# cluster does not download them again from Docker Hub.
foreach ($img in "mongo:7.0", "mysql:8.4", "rabbitmq:3.13-management") {
  if (Succeeds { docker image inspect $img }) { $images += $img }
}
Step "Importing images into the cluster"
Exec { k3d image import -c $Cluster @images }

# ---- secret ----------------------------------------------------------------------
Step "Namespace and secret"
Exec { kubectl --context $ctx apply -f (Join-Path $root "deploy\k8s\namespace.yaml") }
$secretKeys = "MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "JWT_SECRET", "DEMO_USER_EMAIL", "DEMO_USER_PASSWORD",
              "RABBITMQ_USER", "RABBITMQ_PASSWORD", "RABBITMQ_URL", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"
$tmp = [IO.Path]::GetTempFileName()
try {
  $secretKeys | Where-Object { $cfg[$_] } | ForEach-Object { "$_=$($cfg[$_])" } |
    Set-Content -Path $tmp -Encoding ascii
  Exec {
    kubectl --context $ctx -n $ns create secret generic trackbay-secrets `
      --from-env-file=$tmp --dry-run=client -o yaml | kubectl --context $ctx apply -f -
  }
} finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

# ---- manifests -------------------------------------------------------------------
Step "Applying manifests"
Exec { kubectl --context $ctx apply -f (Join-Path $root "deploy\k3s\traefik-config.yaml") }
Exec { kubectl --context $ctx apply -k (Join-Path $root "deploy\k8s") }

# Same image tag every build, so restart to pick up the freshly imported images.
Exec { kubectl --context $ctx -n $ns rollout restart deployment }

Step "Waiting for rollouts"
foreach ($s in "mongodb", "mysql", "rabbitmq") {
  Exec { kubectl --context $ctx -n $ns rollout status "statefulset/$s" --timeout=300s }
}
foreach ($s in $services) {
  Exec { kubectl --context $ctx -n $ns rollout status "deployment/$s" --timeout=300s }
}

# ---- smoke check -----------------------------------------------------------------
Step "Checking http://localhost:$Port"
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:$Port/api/health"
    $ok = $r.StatusCode -eq 200
  } catch { Start-Sleep -Seconds 2 }
}
Exec { kubectl --context $ctx -n $ns get pods }
if (-not $ok) { throw "The app did not answer on http://localhost:$Port/api/health" }

Write-Host "`nTrackbay is running on Kubernetes: http://localhost:$Port" -ForegroundColor Green
Write-Host "Public link:  powershell -ExecutionPolicy Bypass -File deploy\local\tunnel.ps1"
