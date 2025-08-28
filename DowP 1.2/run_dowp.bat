@echo off
:: 1. Se mueve a la carpeta donde esta el script. CRUCIAL para que main.py encuentre sus archivos.
cd /d "%~dp0"

:: 2. Intenta lanzar la app con py.exe, el metodo mas fiable y universal en Windows.
::    Se lanza directamente, sin 'start', para mayor simplicidad y compatibilidad.
py.exe -3 main.py %1 >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
)

:: 3. Si py.exe falla, intenta con pythonw.exe como Plan B.
pythonw.exe main.py %1 >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
)

:: 4. Si ambos metodos fallan, muestra un error grafico claro al usuario.
mshta "javascript:alert('ERROR CRITICO: No se pudo iniciar DowP.\n\nPor favor, asegúrese de que Python está instalado desde python.org y que la casilla \"Add Python to PATH\" fue marcada durante la instalación.');close();"
exit /b 1