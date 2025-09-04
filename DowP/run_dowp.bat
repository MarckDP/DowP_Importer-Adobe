@echo off
:: DowP Launcher (prioriza main.pyw, pero cae en main.py si falla)

:: 1. Ir a la carpeta del script
cd /d "%~dp0"

:: === INTENTOS CON .PYW (sin consola) ===

:: 1a. Primer intento: start + pythonw main.pyw
if exist "%~dp0main.pyw" (
    start "" /b pythonw "%~dp0main.pyw" %1
    if %errorlevel% equ 0 exit /b 0
)

:: 1b. Segundo intento: py.exe -3w main.pyw
if exist "%~dp0main.pyw" (
    py.exe -3w "%~dp0main.pyw" %1 >nul 2>&1
    if %errorlevel% equ 0 exit /b 0
)

:: 1c. Tercer intento: pythonw.exe main.pyw
if exist "%~dp0main.pyw" (
    pythonw.exe "%~dp0main.pyw" %1 >nul 2>&1
    if %errorlevel% equ 0 exit /b 0
)

:: === INTENTOS CON .PY (fallback con consola si hace falta) ===

:: 2a. py.exe -3 main.py
if exist "%~dp0main.py" (
    py.exe -3 "%~dp0main.py" %1
    if %errorlevel% equ 0 exit /b 0
)

:: 2b. python.exe main.py
if exist "%~dp0main.py" (
    python.exe "%~dp0main.py" %1
    if %errorlevel% equ 0 exit /b 0
)

:: === ERROR FINAL ===
mshta "javascript:alert('ERROR CRÍTICO: No se pudo iniciar DowP.\n\nPor favor, asegúrese de que Python 3 está instalado desde python.org y que la opción \"Add Python to PATH\" fue marcada durante la instalación.');close();"
exit /b 1
