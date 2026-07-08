@echo off
set "ROOT=%~dp0"
cd /d "%ROOT%"
echo ========================================
echo  HostelConnect - Quick Setup Script
echo ========================================
echo.

:menu
echo Please select an option:
echo.
echo 1. Install Backend Dependencies
echo 2. Setup MySQL Database (Manual Instructions)
echo 3. Create Demo Users
echo 4. Start Backend Server
echo 5. Start Frontend (React)
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto install_backend
if "%choice%"=="2" goto setup_db
if "%choice%"=="3" goto create_users
if "%choice%"=="4" goto start_backend
if "%choice%"=="5" goto start_frontend
if "%choice%"=="6" goto end

:install_backend
echo.
echo Installing Python dependencies...
cd /d "%ROOT%backend"
pip install -r requirements.txt
echo.
echo ✓ Backend dependencies installed!
pause
goto menu

:setup_db
echo.
echo ========================================
echo  MySQL Database Setup Instructions
echo ========================================
echo.
echo OPTION 1 - Using XAMPP:
echo   1. Start XAMPP Control Panel
echo   2. Start MySQL service
echo   3. Open phpMyAdmin: http://localhost/phpmyadmin
echo   4. Create database: hostelconnect
echo   5. Go to SQL tab
echo   6. Copy and paste contents from: backend\database_schema.sql
echo   7. Click "Go" to execute
echo.
echo OPTION 2 - Using MySQL Command Line:
echo   mysql -u root -p ^< backend\database_schema.sql
echo.
pause
goto menu

:create_users
echo.
echo Creating demo users...
echo.
echo Make sure:
echo  - MySQL is running
echo  - Database 'hostelconnect' exists
echo  - Backend server is running (Option 4)
echo.
echo If backend is running, visit:
echo http://localhost:5000/api/create-demo-users
echo.
echo Or use PowerShell:
powershell -Command "Invoke-WebRequest -Uri 'http://localhost:5000/api/create-demo-users' -Method POST | Select-Object -Expand Content"
echo.
pause
goto menu

:start_backend
echo.
echo Starting Flask Backend Server...
echo Server will run on: http://localhost:5000
echo.
cd /d "%ROOT%backend"
python app.py
pause
goto menu

:start_frontend
echo.
echo Starting React Frontend...
echo Server will run on: http://localhost:5173
echo.
cd /d "%ROOT%frontend"
npm run dev
pause
goto menu

:end
echo.
echo Goodbye!
exit
