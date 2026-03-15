@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 🚀 ЗАПУСК МУЗЫКАЛЬНОГО ПЛЕЕРА
echo ========================================
echo.

REM Проверяем текущую директорию
echo 📂 Текущая папка: %cd%
echo.

REM Проверяем Python
echo 🔍 Проверяю Python...
python --version 2>nul
if errorlevel 1 (
    echo ❌ ОШИБКА: Python не найден!
    echo    Установите Python 3.8+ с сайта python.org
    pause
    exit /b 1
)
python --version
echo.

REM Проверяем Node.js
echo 🔍 Проверяю Node.js...
node --version 2>nul
if errorlevel 1 (
    echo ❌ ОШИБКА: Node.js не найден!
    echo    Установите Node.js с сайта nodejs.org
    pause
    exit /b 1
)
node --version
echo.

REM Проверяем npm
echo 🔍 Проверяю npm...
npm --version 2>nul
if errorlevel 1 (
    echo ❌ ОШИБКА: npm не найден!
    pause
    exit /b 1
)
npm --version
echo.

REM Создаем папку для музыки если её нет
if not exist "backend\music_files" (
    echo 📁 Создаю папку для музыки...
    mkdir backend\music_files
)

REM Проверяем есть ли аудиофайлы
echo 🔍 Проверяю аудиофайлы...
if not exist "backend\music_files\track1.mp3" (
    echo ⚠️  ВНИМАНИЕ: Нет аудиофайлов!
    echo    Создаю тестовые файлы...
    
    REM Создаем простой текстовый файл как заглушку
    echo Это тестовый трек 1 > backend\music_files\track1.txt
    echo Это тестовый трек 2 > backend\music_files\track2.txt
    
    echo.
    echo 📝 ИНСТРУКЦИЯ:
    echo    1. Добавьте MP3 файлы в папку backend\music_files\
    echo    2. Переименуйте их в track1.mp3, track2.mp3 и т.д.
    echo    3. Или отредактируйте файл backend\app.py
    echo.
    pause
)

REM Проверяем зависимости Python
echo 📦 Проверяю зависимости Python...
cd backend

if not exist "requirements.txt" (
    echo Создаю requirements.txt...
    echo flask==2.3.3 > requirements.txt
    echo flask-cors==4.0.0 >> requirements.txt
)

REM Проверяем установлен ли Flask
python -c "import flask" 2>nul
if errorlevel 1 (
    echo ⬇️  Устанавливаю Flask и зависимости...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ ОШИБКА: Не удалось установить зависимости Python
        pause
        exit /b 1
    )
) else (
    echo ✅ Flask уже установлен
)

cd ..
echo.

REM Проверяем зависимости Node.js
echo 📦 Проверяю зависимости Node.js...
cd frontend

if not exist "package.json" (
    echo ❌ ОШИБКА: package.json не найден!
    echo    Убедитесь что папка frontend содержит проект Vite
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo ⬇️  Устанавливаю зависимости Node.js...
    call npm install
    if errorlevel 1 (
        echo ❌ ОШИБКА: Не удалось установить зависимости Node.js
        pause
        exit /b 1
    )
) else (
    echo ✅ Зависимости Node.js уже установлены
)

cd ..
echo.

echo ========================================
echo ✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ
echo ========================================
echo.
echo 🎵 МУЗЫКАЛЬНЫЙ ПЛЕЕР
echo 📌 Бэкенд:  http://localhost:5000
echo 📌 Фронтенд: http://localhost:5173
echo 📌 Плеер:    http://localhost:5173
echo.
echo ========================================
echo 🔥 ЗАПУСКАЮ СЕРВЕРА...
echo ========================================
echo.

REM Запускаем бэкенд в новом окне
echo 🐍 ЗАПУСК БЭКЕНДА (Python Flask)...
start "🎵 Music Player - Backend" cmd /k "cd /d %cd%\backend && title Music Player Backend && echo ======================================== && echo 🐍 PYTHON BACKEND && echo 📌 http://localhost:5000 && echo 📂 Папка: %cd%\backend && echo ======================================== && echo. && echo Команды: && echo • Ctrl+C - остановить сервер && echo • Закройте окно - выйти && echo. && python app.py"

echo ⏳ Жду 3 секунды чтобы бэкенд запустился...
timeout /t 3 /nobreak >nul

REM Запускаем фронтенд в новом окне
echo ⚛️  ЗАПУСК ФРОНТЕНДА (React Vite)...
start "🎵 Music Player - Frontend" cmd /k "cd /d %cd%\frontend && title Music Player Frontend && echo ======================================== && echo ⚛️  REACT FRONTEND && echo 📌 http://localhost:5173 && echo 📂 Папка: %cd%\frontend && echo ======================================== && echo. && echo Команды: && echo • Ctrl+C - остановить сервер && echo • Закройте окно - выйти && echo. && npm run dev"

echo.
echo ========================================
echo 🎉 СЕРВЕРА ЗАПУЩЕНЫ!
echo ========================================
echo.
echo 📍 ОТКРОЙТЕ БРАУЗЕР: http://localhost:5173
echo.
echo ⚠️  СЕРВЕРА ЗАПУЩЕНЫ В ОТДЕЛЬНЫХ ОКНАХ
echo    • Бэкенд: синее окно
echo    • Фронтенд: черное окно
echo.
echo ✋ ДЛЯ ОСТАНОВКИ:
echo    1. Закройте окна с серверами
echo    2. Или нажмите Ctrl+C в каждом окне
echo.
echo ========================================
echo.

REM Оставляем основное окно открытым
echo Нажмите любую клавишу чтобы выйти...
pause >nul

REM Попытка закрыть дочерние окна (не всегда работает)
echo 🛑 Закрываю сервера...
taskkill /FI "WINDOWTITLE eq *Music Player - Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *Music Player - Frontend*" /F >nul 2>&1

echo ✅ Готово!
timeout /t 2 /nobreak >nul