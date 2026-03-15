@echo off
chcp 65001 >nul
title 🎵 Music Player Launcher
color 0B

echo ============================================
echo        🚀 ЗАПУСК МУЗЫКАЛЬНОГО ПЛЕЕРА
echo ============================================
echo.

echo 📍 Текущая папка: %cd%
echo.

echo 1. 🔍 Проверяю Python...
python --version 2>nul && (
    echo    ✅ Python найден
) || (
    echo    ❌ Python не найден!
    echo    Установите с: https://python.org
    pause
    exit /b 1
)

echo.
echo 2. 🔍 Проверяю Node.js...
node --version 2>nul && (
    echo    ✅ Node.js найден
) || (
    echo    ❌ Node.js не найден!
    echo    Установите с: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo 3. 🎵 Создаю папку для музыки...
if not exist "backend\music_files" mkdir backend\music_files

echo.
echo 4. 🐍 ЗАПУСК БЭКЕНДА...
echo    📍 http://localhost:5000
start "🎵 Backend - Python Flask" cmd /c "cd /d backend && title Backend ^(5000^) && echo ============================ && echo     🐍 PYTHON BACKEND && echo      http://localhost:5000 && echo ============================ && echo. && python app.py"

echo    ⏳ Жду запуска бэкенда (3 сек)...
timeout /t 3 /nobreak >nul

echo.
echo 5. ⚛️  ЗАПУСК ФРОНТЕНДА...
echo    📍 http://localhost:5173
start "🎵 Frontend - React Vite" cmd /c "cd /d frontend && title Frontend ^(5173^) && echo ============================ && echo     ⚛️  REACT FRONTEND && echo      http://localhost:5173 && echo ============================ && echo. && npm run dev"

echo    ⏳ Жду запуска фронтенда (5 сек)...
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo        🌐 ОТКРЫВАЮ БРАУЗЕР...
echo ============================================

REM Пробуем разные браузеры по очереди
echo 🔍 Ищу браузер...

REM 1. Chrome
where chrome >nul 2>&1
if not errorlevel 1 (
    echo    ✅ Найден Google Chrome
    start chrome --new-window "http://localhost:5173"
    goto :browser_opened
)

REM 2. Edge
where msedge >nul 2>&1
if not errorlevel 1 (
    echo    ✅ Найден Microsoft Edge
    start msedge --new-window "http://localhost:5173"
    goto :browser_opened
)

REM 3. Firefox
where firefox >nul 2>&1
if not errorlevel 1 (
    echo    ✅ Найден Firefox
    start firefox --new-window "http://localhost:5173"
    goto :browser_opened
)

REM 4. Opera
where opera >nul 2>&1
if not errorlevel 1 (
    echo    ✅ Найден Opera
    start opera --new-window "http://localhost:5173"
    goto :browser_opened
)

REM 5. Brave
where brave >nul 2>&1
if not errorlevel 1 (
    echo    ✅ Найден Brave
    start brave --new-window "http://localhost:5173"
    goto :browser_opened
)

REM 6. Стандартный браузер по умолчанию
echo    ⚠️  Не найден известный браузер
echo    📍 Пробую открыть через стандартный...
start "" "http://localhost:5173"

:browser_opened
echo.
echo ============================================
echo        🎉 ВСЁ ГОТОВО!
echo ============================================
echo.
echo 📍 Ссылки:
echo    🎵 Плеер:    http://localhost:5173
echo    🐍 Бэкенд:   http://localhost:5000
echo    ⚛️  Фронтенд: http://localhost:5173
echo.
echo 📂 Папки:
echo    Бэкенд:   %cd%\backend
echo    Фронтенд: %cd%\frontend
echo.
echo 🛑 Как остановить:
echo    1. Закройте окна "Backend" и "Frontend"
echo    2. Или нажмите Ctrl+C в каждом окне
echo.
echo ============================================
echo Нажмите любую клавишу чтобы закрыть это окно...
pause >nul

REM Пытаемся закрыть сервера при выходе
taskkill /FI "WINDOWTITLE eq *Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *Frontend*" /F >nul 2>&1

exit /b 0