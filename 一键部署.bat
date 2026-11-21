@echo off
chcp 65001 >nul
cd /d "C:\Users\李嘉悦\Desktop\医学学习平台"

echo ============================================
echo   Deploy Medical Study Platform to GitHub
echo ============================================
echo.
echo Step 0 (do once): go to https://github.com/new
echo   Create a PUBLIC repo, e.g. medical-study
echo   Do NOT check README / .gitignore / License
echo.
echo If you already created it, continue below.
echo.

set "GHUSER="
set "GHREPO="
set /p GHUSER="GitHub username: "
if "%GHUSER%"=="" goto :emptyuser
set /p GHREPO="Repo name (press Enter for medical-study): "
if "%GHREPO%"=="" set "GHREPO=medical-study"

echo.
echo Linking remote: https://github.com/%GHUSER%/%GHREPO%.git
git remote remove origin 2>nul
git remote add origin https://github.com/%GHUSER%/%GHREPO%.git

echo.
echo Pushing to GitHub (a login window may pop up)...
git push -u origin main
if errorlevel 1 goto :failed

echo.
echo ============================================
echo   SUCCESS - code pushed!
echo ============================================
echo.
echo Now open this URL in your browser:
echo   https://github.com/%GHUSER%/%GHREPO%/settings/pages
echo.
echo Then set:
echo   Source : Deploy from a branch
echo   Branch: main / (root)
echo   Click Save
echo.
echo After 1-3 minutes your site is live at:
echo   https://%GHUSER%.github.io/%GHREPO%/
echo.
echo Open that URL on your phone and
echo "Add to Home Screen" to install the app.
echo.
pause
exit /b 0

:emptyuser
echo.
echo [ERROR] Username cannot be empty.
pause
exit /b 1

:failed
echo.
echo [FAILED] Push failed. Possible reasons:
echo   1. Wrong username or repo name
echo   2. Repo does not exist or is not Public
echo   3. GitHub login not completed
echo   4. Network problem
echo.
pause
exit /b 1
