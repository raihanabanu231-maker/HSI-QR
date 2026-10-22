@echo off
title HSI MES - MySQL Database Console (hsi_qr_db)
color 0A

echo ========================================================
echo        HSI MES - LOCAL MYSQL 8.0 DATABASE CONSOLE
echo ========================================================
echo Database: hsi_qr_db  ^|  User: root  ^|  Port: 3306
echo ========================================================
echo.

"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pR@y@1234 -e "USE hsi_qr_db; SHOW TABLES; SELECT '--- TABLE ROW COUNTS ---' AS ''; SELECT 'master_parts' AS tbl, COUNT(*) AS count FROM master_parts UNION SELECT 'logs', COUNT(*) FROM logs UNION SELECT 'label_logs', COUNT(*) FROM label_logs UNION SELECT 'system_users', COUNT(*) FROM system_users;"

echo.
echo ========================================================
echo Interactive MySQL console ready! (Database: hsi_qr_db)
echo Example queries:
echo   SELECT * FROM master_parts LIMIT 10;
echo   SELECT * FROM system_users;
echo   SELECT * FROM label_logs;
echo Type 'exit' to quit.
echo ========================================================
echo.

"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pR@y@1234 hsi_qr_db
