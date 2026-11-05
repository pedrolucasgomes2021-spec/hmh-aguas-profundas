@echo off
cd /d "%~dp0"
echo Abrindo http://localhost:8765  (feche esta janela para parar)
start "" http://localhost:8765
python tools\servir.py 8765
