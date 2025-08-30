@echo off
:: DowP Launcher (intenta rápido con start + pythonw, y si falla usa fallback)

:: 1. Ir a la carpeta del script
cd /d "%~dp0"

:: 2. Primer intento: lanzar con start + pythonw (no abre consola, rápido y limpio)
start "" /b pythonw "%~dp0main.pyw" %1
if %errorlevel% equ 0 (
    exit /b 0
)

:: 3. Segundo intento: usar py.exe con -3w (Python 3 en modo sin consola)
py.exe -3w "%~dp0main.pyw" %1 >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
)

:: 4. Tercer intento: llamar a pythonw.exe directamente
pythonw.exe "%~dp0main.pyw" %1 >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
)

:: 5. Si todo falla, mostrar error gráfico
mshta "javascript:alert('ERROR CRÍTICO: No se pudo iniciar DowP.\n\nPor favor, asegúrese de que Python 3 está instalado desde python.org y que la opción \"Add Python to PATH\" fue marcada durante la instalación.');close();"

exit /b 1
