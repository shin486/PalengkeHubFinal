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
REM Gradle 8.14.3 + AGP 8.x requires Java 17+, but Android Studio's bundled
REM JBR is now Java 25 on recent installs -- this project's Gradle/Kotlin
REM DSL version crashes trying to parse that version string. A real JDK 17
REM install is required; the Android Studio JBR fallback below is WRONG on
REM a machine with a newer Android Studio and will fail the build (see
REM REBUILD_APK.md for the exact error).
set "JDK17=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
set "ANDROID_JBR=C:\Program Files\Android\Android Studio\jbr"
if exist "%JDK17%\bin\java.exe" (
    set "JAVA_HOME=%JDK17%"
    set "PATH=%JAVA_HOME%\bin;%PATH%"
    echo Using JDK 17: %JAVA_HOME%
    "%JAVA_HOME%\bin\java.exe" -version
    echo.
) else if exist "%ANDROID_JBR%\bin\java.exe" (
    set "JAVA_HOME=%ANDROID_JBR%"
    set "PATH=%JAVA_HOME%\bin;%PATH%"
    echo WARNING: Falling back to Android Studio's bundled JBR.
    echo If this is Java 25, the build WILL fail -- install a JDK 17 instead
    echo (see REBUILD_APK.md).
    "%JAVA_HOME%\bin\java.exe" -version
    echo.
) else (
    echo WARNING: Neither a JDK 17 install nor Android Studio JBR found!
    echo Gradle 8.14.3 + AGP 8.x requires Java 17+ (not 25 -- see REBUILD_APK.md).
    echo.
    java -version 2>nul
    if errorlevel 1 (
        echo ERROR: Java not found! Please install Java 17+.
        pause
        exit /b 1
    )
)

echo [1/5] Exporting web bundle (full, not --platform android --
echo       Capacitor's sync needs dist/index.html from a full export)...
echo.
call npx expo export
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: expo export failed!
    pause
    exit /b 1
)

echo.
echo [2/5] Syncing web assets with Capacitor...
echo.
REM This project uses Capacitor (not raw React Native).
REM "npx cap sync" copies the web build from dist/ into the Android project.
npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

REM Android never loads the iOS/web JS bundles cap sync also copies in --
REM only the android one. Leaving them in costs ~9MB, which is the
REM difference between fitting under GitHub's 100MB push limit and not.
if exist "android\app\src\main\assets\public\_expo\static\js\ios" (
    rmdir /s /q "android\app\src\main\assets\public\_expo\static\js\ios"
)
if exist "android\app\src\main\assets\public\_expo\static\js\web" (
    rmdir /s /q "android\app\src\main\assets\public\_expo\static\js\web"
)

echo.
echo [3/5] Building release APK with Gradle (minified + shrunk)...
echo.
cd android
call gradlew assembleRelease -Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Gradle build failed!
    echo Check REBUILD_APK.md for known fixes (reactNativeArchitectures,
    echo the R8 -dontwarn rule for com.gemalto.jp2.JP2Decoder).
    pause
    exit /b 1
)

echo.
echo [4/5] Copying APK to landing page...
echo.
cd ..
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy /Y "android\app\build\outputs\apk\release\app-release.apk" "landingpage-website\PalengkeHub.apk" >nul
    copy /Y "android\app\build\outputs\apk\release\app-release.apk" "www\PalengkeHub.apk" >nul
    echo APK copied to landingpage-website\PalengkeHub.apk and www\PalengkeHub.apk
) else (
    echo WARNING: APK file not found at expected location
    echo Check: android\app\build\outputs\apk\release\
)

echo.
echo [5/5] Done. Review the size below -- must stay under 100MB to push to GitHub:
echo.
dir "landingpage-website\PalengkeHub.apk" | find "PalengkeHub.apk"
