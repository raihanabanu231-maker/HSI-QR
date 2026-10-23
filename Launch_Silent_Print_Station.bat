@echo off
title HSI Automated MES - Silent Auto-Print Station
echo ========================================================
echo   HSI AUTOMATED MES - SILENT AUTO-PRINT STATION
echo ========================================================
echo Launching Google Chrome with Silent Auto-Print enabled...
echo All OK 100x30 labels will print directly to HPRT HT330 without asking!
echo Dedicated Printer: HPRT HT330 - ZPL
echo ========================================================
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://localhost:3000
exit
