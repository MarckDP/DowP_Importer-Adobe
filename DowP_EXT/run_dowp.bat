@echo off
REM Cambia al directorio donde se encuentra este script .bat
cd /d "%~dp0"

REM Lanza el script de Python sin consola, pasándole cualquier argumento que reciba este .bat
echo Lanzando DowP...
pythonw "main.py" %1
