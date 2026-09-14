# 🔄 APK Rebuild Guide

## Prerequisites
- Android SDK installed and configured
- **Java JDK 17 or 21 — NOT 25.** Recent Android Studio installs bundle a
  Java 25 JBR, but this project's Gradle/Kotlin DSL version (8.14.3) crashes
  trying to parse that version string (`IllegalArgumentException: 25.0.2`
  in `enforce_order_update_rules`-unrelated Kotlin compiler code, thrown from
  `JavaVersion.parse`). Point `JAVA_HOME` at a real JDK 17 install instead
  (e.g. `C:\Program Files\Microsoft\jdk-17.x.x.x-hotspot`) before running
  gradle — do NOT rely on Android Studio's bundled JBR for this project
  until it upgrades past this Gradle version.
- Node.js and npm installed
- Android Studio (recommended for APK building)

## IMPORTANT: `android/` is gitignored

This folder is NOT tracked in git — every fix below lives only on the
machine that made it until someone manually re-applies it after a fresh
`expo prebuild` or a fresh clone that regenerates `android/`. If you hit
the errors described below, this is why: they were already fixed once,
just not somewhere git can carry forward.

**`android/gradle.properties`** — `reactNativeArchitectures` must be
`arm64-v8a` only, not the default `armeabi-v7a,arm64-v8a,x86,x86_64`.
Building all four ABIs produces a ~110-210MB "universal" APK, which
GitHub's push hard-rejects past 100MB, and armeabi-v7a's native build
fails outright on Windows checkouts with a CMake path-length error in a
node_modules staging path unrelated to this app.

**`android/app/proguard-rules.pro`** — needs `-dontwarn com.gemalto.jp2.JP2Decoder`.
Without it, `assembleRelease` with minification enabled fails R8 with
"Missing class com.gemalto.jp2.JP2Decoder" — an optional JPEG2000 decoder
class referenced by `react-native-html-to-pdf`'s PdfBox-Android dependency
that's never actually bundled (and never needed, since this app never
parses JPX-encoded images in a PDF).

**Before running `cap sync android`**, run a FULL `npx expo export` (not
`--platform android` — Capacitor's sync needs `dist/index.html`, which
only a full/web export produces), then after `cap sync android` completes,
delete the iOS and web JS bundles it copied into the Android build that
Android never uses:
```bash
rm -rf android/app/src/main/assets/public/_expo/static/js/ios
rm -rf android/app/src/main/assets/public/_expo/static/js/web
```
This alone saves ~9MB — the difference between an APK that fits under
GitHub's 100MB limit and one that doesn't, even after the ABI restriction
and release minification above.

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
