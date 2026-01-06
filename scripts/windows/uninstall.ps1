#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Hytale Server Manager - Windows Uninstall Script

.DESCRIPTION
    This script removes the Hytale Server Manager from Windows.
    It will:
    - Stop and remove the Windows service
    - Remove firewall rules
    - Optionally remove all data

.PARAMETER InstallPath
    The installation directory. Default: C:\HytaleServerManager

.PARAMETER KeepData
    Keep the data directory (database, backups, logs)

.PARAMETER ServiceName
    The Windows service name. Default: HytaleServerManager

.EXAMPLE
    .\uninstall.ps1
    .\uninstall.ps1 -KeepData
#>

param(
    [string]$InstallPath = "C:\HytaleServerManager",
    [string]$ServiceName = "HytaleServerManager",
    [switch]$KeepData
)

$ErrorActionPreference = "Stop"

function Write-Status { param($Message) Write-Host "[*] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[+] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[!] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[-] $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "======================================" -ForegroundColor Red
Write-Host "  Hytale Server Manager Uninstaller" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Confirm
Write-Warning "This will remove Hytale Server Manager from:"
Write-Host "  $InstallPath" -ForegroundColor White
Write-Host ""

if (-not $KeepData) {
    Write-Warning "ALL DATA WILL BE DELETED including:"
    Write-Host "  - Database" -ForegroundColor White
    Write-Host "  - Server files" -ForegroundColor White
    Write-Host "  - Backups" -ForegroundColor White
    Write-Host "  - Logs" -ForegroundColor White
    Write-Host ""
    Write-Host "Use -KeepData to preserve data directory" -ForegroundColor Yellow
    Write-Host ""
}

$confirm = Read-Host "Are you sure you want to continue? (type 'yes' to confirm)"
if ($confirm -ne 'yes') {
    Write-Host "Uninstall cancelled."
    exit 0
}

# Stop and remove service
Write-Status "Checking for Windows service..."
$nssmPath = "$InstallPath\nssm.exe"

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Status "Stopping service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    if (Test-Path $nssmPath) {
        Write-Status "Removing service using NSSM..."
        & $nssmPath remove $ServiceName confirm 2>$null
    } else {
        Write-Status "Removing service using SC..."
        & sc.exe delete $ServiceName 2>$null
    }

    Write-Success "Service removed"
} else {
    Write-Host "No service found"
}

# Remove firewall rule
Write-Status "Removing firewall rule..."
$ruleName = "Hytale Server Manager"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($rule) {
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Success "Firewall rule removed"
} else {
    Write-Host "No firewall rule found"
}

# Remove installation directory
Write-Status "Removing installation files..."

if (Test-Path $InstallPath) {
    if ($KeepData) {
        # Remove everything except data directory
        Get-ChildItem $InstallPath -Exclude "data" | Remove-Item -Recurse -Force
        Write-Success "Installation files removed (data preserved)"
        Write-Host "Data directory preserved at: $InstallPath\data" -ForegroundColor Yellow
    } else {
        Remove-Item $InstallPath -Recurse -Force
        Write-Success "All files removed"
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Uninstall Complete" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
