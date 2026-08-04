# 🔄 APK Rebuild Guide

## Prerequisites
- Android SDK installed and configured
- **Java JDK 17+** installed (Gradle 8.14.3 + AGP 8.x requires Java 17+)
  - Android Studio's bundled JBR (Java 17/21/25) works automatically via `gradle.properties`
- Node.js and npm installed
- Android Studio (recommended for APK building)

## Steps to Rebuild the APK

### Option 1: Using Gradle (Command Line)

```bash
# 1. Navigate to the project root
cd PalengkeHubFinal-main

# 2. Export the web build (Expo -> dist/)
npx expo export

# 3. Sync web assets with Capacitor
npx cap sync android

# 4. Navigate to Android directory
cd android

# 5. Build the debug APK
#    (gradle.properties automatically uses Android Studio's JBR for Java 17+)
./gradlew assembleDebug

# 6. The APK will be at:
# android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk
```

### Option 2: Using Android Studio (Recommended)

1. Open `android/` folder in Android Studio
2. Wait for Gradle sync to complete
3. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
4. Select **Debug** build
5. Click **Build**
6. When complete, click **Locate** to find the APK file

### Option 3: Using the Batch File

Run the `BUILD_APK.bat` file in the project root:
```cmd
BUILD_APK.bat
```

## After Building

1. Copy the new APK to the landing page:
   ```bash
   copy android\app\build\outputs\apk\debug\app-debug.apk landingpage-website\PalengkeHub.apk
   ```

2. Update the landing page download links (if needed)

3. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "chore: Updated app icon and rebuilt APK"
   git push origin jhay
   ```

## Troubleshooting

- **Gradle build fails**: Ensure Android SDK is properly installed and `ANDROID_HOME` is set
- **Bundle build fails**: Run `npm install` first to ensure all dependencies are installed
- **Capacitor sync fails**: Run `npx cap add android` if the Android platform doesn't exist
