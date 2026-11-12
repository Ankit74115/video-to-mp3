<#
.SYNOPSIS
  Stops the local Trackbay cluster. Data (users, uploads, mp3s) is kept unless -Delete.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\local\down.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\local\down.ps1 -Delete
#>
param(
  [string]$Cluster = "trackbay",
  [switch]$Delete
)

$ErrorActionPreference = "Stop"
$env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
            [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + $env:Path

if ($Delete) {
  k3d cluster delete $Cluster
  Write-Host "Cluster $Cluster deleted, including its data."
} else {
  k3d cluster stop $Cluster
  Write-Host "Cluster $Cluster stopped. Start it again with deploy\local\up.ps1 -SkipBuild."
}
