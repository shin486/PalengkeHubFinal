@echo off
title PalengkeHub APK Builder
color 0A

echo.
echo ========================================
echo   PalengkeHub APK Build Script
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "android\app\build.gradle" (
    echo ERROR: android/app/build.gradle not found!
    echo Please run this script from the project root directory.
    echo.
    pause
    exit /b 1
)

REM === Fix Java version for Gradle ===
REM Gradle 8.14.3 + AGP 8.x requires Java 17+, but system may have Java 8.
REM gradle.properties already sets org.gradle.java.home, but we set JAVA_HOME
REM here too as a fallback for the Gradle wrapper startup script.
set "ANDROID_JBR=C:\Program Files\Android\Android Studio\jbr"
if exist "%ANDROID_JBR%\bin\java.exe" (
    set "JAVA_HOME=%ANDROID_JBR%"
    set "PATH=%JAVA_HOME%\bin;%PATH%"
    echo Using Android Studio JBR: %JAVA_HOME%
    "%JAVA_HOME%\bin\java.exe" -version
    echo.
) else (
    echo WARNING: Android Studio JBR not found at %ANDROID_JBR%!
    echo Gradle 8.14.3 + AGP 8.x requires Java 17+.
    echo Please install Java 17+ or Android Studio.
    echo.
    java -version 2>nul
    if errorlevel 1 (
        echo ERROR: Java not found! Please install Java 17+.
        pause
        exit /b 1
    )
)

echo [1/4] Syncing web assets with Capacitor...
echo.
REM This project uses Capacitor (not raw React Native).
REM "npx cap sync" copies the web build from dist/ into the Android project.
npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Capacitor sync failed!
    echo Make sure you have run "npx expo export" to generate the dist/ folder.
    pause
    exit /b 1
)

echo.
echo [2/4] Building APK with Gradle...
echo.
cd android
call gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Gradle build failed!
    echo Please ensure Android SDK and Java are properly installed.
    pause
    exit /b 1
)

echo.
echo [3/4] Copying APK to landing page...
echo.
cd ..
if exist "android\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk" "landingpage-website\PalengkeHub.apk" >nul
    echo APK copied to landingpage-website\PalengkeHub.apk
) else if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "landingpage-website\PalengkeHub.apk" >nul
    echo APK copied to landingpage-website\PalengkeHub.apk
) else (
    echo WARNING: APK file not found at expected location
    echo Check: android\app\build\outputs\apk\debug\
)

