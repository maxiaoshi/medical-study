@echo off
chcp 65001 >nul
cd /d "C:\Users\李嘉悦\Desktop\医学学习平台"

echo ============================================
echo   医学学习平台 - 一键部署到 GitHub Pages
echo ============================================
echo.
echo 使用前请先做一件事（只需一次）：
echo   1. 打开 https://github.com/new
echo   2. 新建一个 Public 仓库，名字建议：medical-study
echo   3. 不要勾选 README / .gitignore / License
echo.
set /p USERNAME="请输入你的 GitHub 用户名: "
set /p REPONAME="请输入仓库名（默认 medical-study）: "
if "%REPONAME%"=="" set REPONAME=medical-study

echo.
echo 正在关联远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/%USERNAME%/%REPONAME%.git

echo 正在推送到 GitHub（如弹出登录窗口请登录）...
git push -u origin main

if errorlevel 1 (
  echo.
  echo [失败] 推送失败。常见原因：
  echo   1. 用户名或仓库名写错
  echo   2. 仓库不存在或不是 Public
  echo   3. GitHub 登录/授权未完成
  echo   4. 网络问题
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   [成功] 代码已推送！
echo ============================================
echo.
echo 接下来在网页上操作：
echo   1. 打开 https://github.com/%USERNAME%/%REPONAME%/settings/pages
echo   2. Source 选: Deploy from a branch
echo   3. Branch 选: main  /  目录选: /(root)
echo   4. 点 Save
echo.
echo 等待 1~3 分钟后，访问：
echo   https://%USERNAME%.github.io/%REPONAME%/
echo.
echo 手机用浏览器打开该地址，即可添加到主屏幕安装为 App。
echo.
pause
