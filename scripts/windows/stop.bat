@echo off
:: Hytale Server Manager - Stop Script
:: This script stops the running application

setlocal EnableDelayedExpansion

set "SERVICE_NAME=HytaleServerManager"

echo.
echo ======================================
echo   Hytale Server Manager - Stop
echo ======================================
echo.

:: Try to stop the Windows service first
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping Windows service: %SERVICE_NAME%
    net stop "%SERVICE_NAME%" 2>nul
    if %errorlevel% equ 0 (
        echo Service stopped successfully.
    ) else (
        echo Service may already be stopped.
    )
) else (
    echo Windows service not found, attempting to stop process...

    :: Find and kill node process running our app
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| find "PID:"') do (
        wmic process where "ProcessId=%%a" get CommandLine 2>nul | find "index.js" >nul
        if !errorlevel! equ 0 (
            echo Stopping process %%a...
            taskkill /f /pid %%a >nul 2>&1
        )
    )
)

echo.
echo Done.
timeout /t 3 >nul
