@echo off
chcp 65001 >nul
echo ============================
echo Запуск музыкального плеера
echo ============================
echo.

echo 1. Запускаю бэкенд (Python)...
start "Бэкенд" cmd /k "cd /d backend && python app.py"
echo    Бэкенд: http://localhost:5000
echo.

echo 2. Жду 3 секунды...
timeout /t 3 >nul
echo.

echo 3. Запускаю фронтенд (React)...
start "Фронтенд" cmd /k "cd /d frontend && npm run dev"
echo    Фронтенд: http://localhost:5173
echo.

echo ============================
echo Готово! Откройте браузер:
echo http://localhost:5173
echo ============================
echo.
echo Нажмите Enter для выхода...
pause >nul