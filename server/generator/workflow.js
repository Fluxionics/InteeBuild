'use strict';

const WORKFLOW_YML = `name: build-app
on:
  workflow_dispatch:
    inputs:
      id:
        description: 'Build ID (InteeBuild)'
        required: true
        type: string
      outputType:
        description: 'Output type (apk/aab/both)'
        required: false
        type: string
        default: 'apk'
      platform:
        description: 'Platform (android/ios/both)'
        required: false
        type: string
        default: 'android'
      outputs:
        description: 'Outputs (CSV: apk,aab,ipa,xapk,apks,exe,dmg,appimage,msi)'
        required: false
        type: string
        default: 'apk'
      provider:
        description: 'Provider (capacitor/native/gecko/twa/cordova/flutter/tauri)'
        required: false
        type: string
        default: 'capacitor'

permissions:
  contents: read
  actions: write

concurrency:
  group: ib-build-\${{ github.repository }}
  cancel-in-progress: false

jobs:
  # Android and iOS jobs are independent: they run in parallel and each one only
  # touches its own project folder (android/ or ios/).
  compile:
    if: \${{ github.event.inputs.platform != 'ios' && github.event.inputs.provider != 'flutter' && github.event.inputs.provider != 'cordova' && github.event.inputs.provider != 'twa' && github.event.inputs.provider != 'gecko' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # --- Output formats ---
      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "$GITHUB_OUTPUT"
          echo "build_apk=\${{ contains(github.event.inputs.outputs, 'apk') || contains(github.event.inputs.outputs, 'xapk') || github.event.inputs.outputs == '' }}" >> "$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "$GITHUB_OUTPUT"
          echo "build_aab=\${{ contains(github.event.inputs.outputs, 'aab') || contains(github.event.inputs.outputs, 'apks') || contains(github.event.inputs.outputs, 'xapk') }}" >> "$GITHUB_OUTPUT"
          echo "release_apk=\${{ contains(github.event.inputs.outputs, 'release-apk') }}" >> "$GITHUB_OUTPUT"
          echo "release_aab=\${{ contains(github.event.inputs.outputs, 'release-aab') }}" >> "$GITHUB_OUTPUT"
          echo "xapk=\${{ contains(github.event.inputs.outputs, 'xapk') }}" >> "$GITHUB_OUTPUT"
          echo "apks=\${{ contains(github.event.inputs.outputs, 'apks') }}" >> "$GITHUB_OUTPUT"

      # --- Toolchain ---
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=$(node -p 'require("./build-config.json").compileSdk')" >> "$GITHUB_ENV"
          echo "TARGET_SDK=$(node -p 'require("./build-config.json").targetSdk')" >> "$GITHUB_ENV"
          echo "MIN_SDK=$(node -p 'require("./build-config.json").minSdk')" >> "$GITHUB_ENV"
          cat "$GITHUB_ENV"

      - name: Setup Android SDK
        run: |
          echo "ANDROID_HOME=$ANDROID_HOME"
          echo "SDK check"
          ls -la "$ANDROID_HOME/cmdline-tools" || true
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-35" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        run: |
          if [ -d android ]; then cp -r android /tmp/prebuilt-android && rm -rf android; fi
          npx cap add android
          if [ -d /tmp/prebuilt-android ]; then cp -r /tmp/prebuilt-android/. android/; fi

      - name: Sync Capacitor Android
        run: npx cap sync android

      # --- Android project ---
      - name: Suppress compileSdk warning
        run: echo 'android.suppressUnsupportedCompileSdk=36' >> android/gradle.properties

      - name: Apply SDK versions
        run: |
          sed -i "s/minSdkVersion = .*/minSdkVersion = \${MIN_SDK:-23}/" android/variables.gradle
          sed -i "s/compileSdkVersion = .*/compileSdkVersion = \${COMPILE_SDK:-35}/" android/variables.gradle
          sed -i "s/targetSdkVersion = .*/targetSdkVersion = \${TARGET_SDK:-35}/" android/variables.gradle
          echo '--- variables.gradle ---'
          sed -n '1,12p' android/variables.gradle

      - name: Apply manifest permissions
        run: |
          cp main-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- manifest permissions applied ---"
          grep -o 'android:name="[^"]*"' android/app/src/main/AndroidManifest.xml

      - name: Validate manifest XML
        run: python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse('android/app/src/main/AndroidManifest.xml');print('manifest XML OK')"

      # --- Native modules ---
      - name: Install native permissions runtime
        if: \${{ hashFiles('NativePermissions.java') != '' }}
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp NativePermissions.java "$DST/NativePermissions.java"
          node patch-permissions.js
          echo "--- native permissions installed ---"
          grep -c NativePermissions "$DST/MainActivity.java" || true

      - name: Install special access (Settings flows)
        if: \${{ hashFiles('SpecialAccess.java') != '' }}
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp SpecialAccess.java "$DST/SpecialAccess.java"
          node patch-special.js
          echo "--- special access installed ---"
          grep -c SpecialAccess "$DST/MainActivity.java" || true

      - name: Install NFC tech filter
        if: \${{ hashFiles('res/xml/nfc_tech_filter.xml') != '' }}
        run: |
          mkdir -p android/app/src/main/res/xml
          cp res/xml/nfc_tech_filter.xml android/app/src/main/res/xml/nfc_tech_filter.xml
          echo "--- NFC filter installed ---"

      - name: Install catalog native patches
        if: \${{ hashFiles('patch-catalog.js') != '' }}
        run: |
          node patch-catalog.js
          echo "--- catalog patches applied ---"
          PKG=$(node -p 'require("./build-config.json").packageName')
          grep -c "FLAG_SECURE\|DownloadListener" "android/app/src/main/java/$(echo $PKG | tr . /)/MainActivity.java" || true

      - name: Apply provider WebView (pro)
        run: |
          PROVIDER=$(node -p 'require("./build-config.json").provider')
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          echo "Provider: $PROVIDER"
          if [ "$PROVIDER" = "native" ] && [ -f "native-MainActivity.java" ]; then cp native-MainActivity.java "$DST/MainActivity.java"; echo "native webview applied"; fi
          if [ "$PROVIDER" = "gecko" ] && [ -f "gecko-MainActivity.java" ]; then cp gecko-MainActivity.java "$DST/MainActivity.java"; echo "geckoview applied"; fi
          if [ "$PROVIDER" = "cordova" ] && [ -f "config.xml" ]; then cp config.xml ./config.xml; echo "cordova config applied"; fi
          cat provider.json || true

      - name: Apply GeckoView dependencies
        if: \${{ hashFiles('patch-gecko-gradle.js') != '' }}
        run: |
          node patch-gecko-gradle.js
          grep -c geckoview android/app/build.gradle || true
          grep -c maven.mozilla.org android/build.gradle || true

      - name: Install background audio service
        if: \${{ hashFiles('RadioService.java') != '' }}
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp RadioService.java "$DST/RadioService.java"
          node patch-main-activity.js
          echo "--- audio service installed ---"
          grep -c RadioService "$DST/MainActivity.java"

      - name: Install native audio bridge (InteeAudio)
        if: \${{ hashFiles('AudioBridge.java') != '' }}
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp AudioBridge.java "$DST/AudioBridge.java"
          node patch-audio.js
          echo "--- native audio installed ---"
          grep -c InteeAudio "$DST/MainActivity.java" || true

      - name: Install Droncito Pack bridge
        if: \${{ hashFiles('DroncitoBridge.java') != '' }}
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp DroncitoBridge.java "$DST/DroncitoBridge.java"
          if [ -f "patch-droncito.js" ]; then node patch-droncito.js; echo "--- droncito capacitor patch ok ---"; fi
          if [ -f "patch-droncito-native.js" ] && [ -f "native-MainActivity.java" ]; then node patch-droncito-native.js; echo "--- droncito native patch ok ---"; fi
          grep -c DroncitoBridge "$DST/MainActivity.java" || true

      - name: Apply Droncito Gradle dependencies
        if: \${{ hashFiles('patch-droncito-gradle.js') != '' }}
        run: |
          node patch-droncito-gradle.js
          echo "--- droncito gradle deps applied (heavy APK expected) ---"
          grep -c "com.google.ar\|mlkit\|sceneview\|play-services-location" android/app/build.gradle || true

      # --- Assets ---
      - name: Apply app icon
        if: \${{ hashFiles('app-icon.png') != '' }}
        run: |
          for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher.png"
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher_round.png"
          done

      - name: Apply adaptive icon
        if: \${{ hashFiles('adaptive-foreground.png') != '' }}
        run: |
          mkdir -p android/app/src/main/res/mipmap-anydpi-v26
          cp adaptive-ic_launcher.xml android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
          cp adaptive-ic_launcher_round.xml android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
          cp adaptive-foreground.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
          cp adaptive-bg.xml android/app/src/main/res/values/ic_launcher_background.xml

      - name: Apply custom colors
        if: \${{ hashFiles('custom-colors.xml') != '' }}
        run: cp custom-colors.xml android/app/src/main/res/values/colors.xml

      - name: Inject JS bridge
        if: \${{ hashFiles('inteebridge-inject.js') != '' }}
        run: |
          mkdir -p android/app/src/main/assets/public
          cp inteebridge-inject.js android/app/src/main/assets/public/inteebridge.js

      - name: Apply catalog assets
        run: |
          if [ -f "assetlinks.json" ]; then mkdir -p android/app/src/main/assets/.well-known; cp assetlinks.json android/app/src/main/assets/.well-known/assetlinks.json; echo "assetlinks ok"; fi
          if [ -f "google-services.json" ]; then cp google-services.json android/app/google-services.json; echo "firebase ok"; fi
          if [ -f "www/catalog.js" ]; then mkdir -p android/app/src/main/assets/public; cp www/catalog.js android/app/src/main/assets/public/catalog.js; echo "catalog js ok"; fi

      # --- Signing ---
      - name: Configure custom signing
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        run: |
          cp user-keystore.jks android/app/release.jks
          cp signing.properties android/key.properties

      - name: Apply signing config
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        working-directory: android/app
        run: |
          cat >> build.gradle <<'GRADLE'
          def ksProps = new Properties()
          def ksFile = file("../key.properties")
          if (ksFile.exists()) ksProps.load(new FileInputStream(ksFile))
          android {
            signingConfigs {
              release {
                storeFile file("release.jks")
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
              }
            }
            buildTypes {
              release {
                signingConfig signingConfigs.release
                minifyEnabled true
                proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
              }
            }
          }
          GRADLE

      - name: Enable ProGuard obfuscation
        run: |
          cat > android/app/proguard-rules.pro <<'PRO'
          -keep class com.getcapacitor.** { *; }
          -keep class * extends android.app.Service { *; }
          -keep class android.webkit.** { *; }
          -keepattributes *Annotation*
          -dontwarn javax.annotation.**
          -dontwarn sun.misc.Unsafe
          # AdMob
          -keep class com.google.android.gms.** { *; }
          -keep interface com.google.android.gms.** { *; }
          -dontwarn com.google.android.gms.**
          PRO

      # --- Build ---
      - name: Compile APK
        if: \${{ steps.fmt.outputs.build_apk == 'true' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Compile Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        working-directory: android
        run: ./gradlew assembleRelease --no-daemon

      - name: Compile AAB
        if: \${{ steps.fmt.outputs.build_aab == 'true' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Compile Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        working-directory: android
        run: ./gradlew bundleRelease --no-daemon

      - name: Package XAPK
        if: \${{ steps.fmt.outputs.xapk == 'true' }}
        run: |
          mkdir -p xapk
          APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -n 1)
          cp "$APK" xapk/base.apk
          MANIFEST=android/app/src/main/AndroidManifest.xml
          PERMS=$(grep '<uses-permission' "$MANIFEST" | grep -o 'android:name="[^"]*"' | cut -d'"' -f2 | sed 's/^/"/;s/$/"/' | paste -sd, - || true)
          cat > xapk/AndroidManifest.json <<JSON
          {
            "package_name": "$(node -p 'require("./build-config.json").packageName')",
            "version_name": "$(node -p 'require("./build-config.json").versionName')",
            "version_code": "$(node -p 'require("./build-config.json").versionCode')",
            "min_sdk_version": "$(node -p 'require("./build-config.json").minSdk')",
            "permissions": [$PERMS]
          }
          JSON
          zip -j app.xapk xapk/base.apk xapk/AndroidManifest.json
          cat xapk/AndroidManifest.json

      - name: Build APKS
        if: \${{ steps.fmt.outputs.apks == 'true' }}
        run: |
          curl -fsSL -o bundletool.jar https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar
          AAB=$(ls android/app/build/outputs/bundle/debug/*.aab | head -n 1)
          java -jar bundletool.jar build-apks --bundle="$AAB" --output=universal.apks --mode=universal
          ls -lh universal.apks

      # --- Upload ---
      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

      - name: Upload XAPK
        if: \${{ steps.fmt.outputs.xapk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-xapk
          path: app.xapk
          if-no-files-found: error

      - name: Upload APKS
        if: \${{ steps.fmt.outputs.apks == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apks
          path: universal.apks
          if-no-files-found: error

  # Runs in parallel with compile; only touches ios/.
  ios-build:
    if: \${{ (github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both') && github.event.inputs.provider != 'flutter' && github.event.inputs.provider != 'tauri' }}
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor iOS platform
        run: npx cap add ios

      - name: Sync Capacitor iOS
        run: npx cap sync ios

      - name: Validate iOS build (simulator)
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: |
          cd ios/App
          pod install --silent || pod install
          xcodebuild -workspace App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO

      - name: Note App Store signing
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: echo 'iOS project validated. Upload your .p12 certificate and .mobileprovision profile in the signing step to export an installable IPA.'

      - name: Sign and export IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        run: node ios-sign.js

      - name: Upload IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-ipa
          path: /tmp/ib-export/*.ipa
          if-no-files-found: error

  # --- Desktop (Electron) ---
  desktop-win:
    if: \${{ contains(github.event.inputs.outputs, 'exe') || contains(github.event.inputs.outputs, 'msi') }}
    runs-on: windows-latest
    strategy:
      fail-fast: false
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check desktop project
        id: desktop
        if: \${{ hashFiles('desktop/package.json') != '' }}
        shell: bash
        run: echo "present=true" >> "$GITHUB_OUTPUT"

      - name: Stage web assets
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        run: |
          if [ -d www ]; then mkdir -p desktop/www && cp -r www/. desktop/www/; fi

      - name: Install desktop dependencies
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npm install

      - name: Build EXE and MSI installers
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npx electron-builder --win nsis msi

      - name: Upload EXE
        if: \${{ steps.desktop.outputs.present == 'true' && contains(github.event.inputs.outputs, 'exe') }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-exe
          path: desktop/dist/*.exe
          if-no-files-found: error

      - name: Upload MSI
        if: \${{ steps.desktop.outputs.present == 'true' && contains(github.event.inputs.outputs, 'msi') }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-msi
          path: desktop/dist/*.msi
          if-no-files-found: error

  desktop-mac:
    if: \${{ contains(github.event.inputs.outputs, 'dmg') }}
    runs-on: macos-latest
    env:
      CSC_IDENTITY_AUTO_DISCOVERY: false
    strategy:
      fail-fast: false
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check desktop project
        id: desktop
        if: \${{ hashFiles('desktop/package.json') != '' }}
        shell: bash
        run: echo "present=true" >> "$GITHUB_OUTPUT"

      - name: Stage web assets
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        run: |
          if [ -d www ]; then mkdir -p desktop/www && cp -r www/. desktop/www/; fi

      - name: Install desktop dependencies
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npm install

      - name: Build DMG
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npx electron-builder --mac dmg

      - name: Upload DMG
        if: \${{ steps.desktop.outputs.present == 'true' && contains(github.event.inputs.outputs, 'dmg') }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-dmg
          path: desktop/dist/*.dmg
          if-no-files-found: error

  desktop-linux:
    if: \${{ contains(github.event.inputs.outputs, 'appimage') }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check desktop project
        id: desktop
        if: \${{ hashFiles('desktop/package.json') != '' }}
        shell: bash
        run: echo "present=true" >> "$GITHUB_OUTPUT"

      - name: Stage web assets
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        run: |
          if [ -d www ]; then mkdir -p desktop/www && cp -r www/. desktop/www/; fi

      - name: Install desktop dependencies
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npm install

      - name: Build AppImage
        if: \${{ steps.desktop.outputs.present == 'true' }}
        shell: bash
        working-directory: desktop
        run: npx electron-builder --linux AppImage

      - name: Upload AppImage
        if: \${{ steps.desktop.outputs.present == 'true' && contains(github.event.inputs.outputs, 'appimage') }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-appimage
          path: desktop/dist/*.AppImage
          if-no-files-found: error

  # --- Cordova real (provider == cordova) ---
  cordova-build:
    if: \${{ github.event.inputs.provider == 'cordova' && github.event.inputs.platform != 'ios' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json

      - name: Setup Android SDK
        run: |
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-35" "build-tools;35.0.0" 2>&1 | tail -20 || true

      - name: Install Cordova CLI
        run: npm install -g cordova

      - name: Add Cordova Android platform
        run: |
          test -f config.xml || { echo "::error::config.xml no encontrado"; exit 1; }
          test -d www || { echo "::error::www/ no encontrado"; exit 1; }
          cordova telemetry off || true
          cordova platform add android
          cordova platform ls

      - name: Apply manifest permissions
        run: |
          MF=platforms/android/app/src/main/AndroidManifest.xml
          test -f "$MF" || { echo "::error::manifest de cordova no encontrado"; exit 1; }
          for TAG in uses-permission uses-feature; do
            grep -o "<$TAG[^>]*>" main-manifest.xml | while read -r LINE; do
              NAME=$(echo "$LINE" | sed -n 's/.*android:name="\\([^"]*\\)".*/\\1/p')
              if [ -n "$NAME" ] && grep -qF "$NAME" "$MF"; then continue; fi
              sed -i "s#</manifest>#$LINE</manifest>#" "$MF"
            done
          done
          if grep -o 'android:usesCleartextTraffic="true"' main-manifest.xml >/dev/null; then
            sed -i 's#<application #<application android:usesCleartextTraffic="true" #' "$MF"
          fi
          grep -q 'android.permission.INTERNET' "$MF" || sed -i 's#</manifest>#<uses-permission android:name="android.permission.INTERNET" /></manifest>#' "$MF"
          echo "--- cordova manifest permissions ---"
          grep -o 'android.permission.[A-Za-z_]*' "$MF" | sort -u
          python3 -c "import xml.dom.minidom;xml.dom.minidom.parse('$MF');print('manifest XML OK')"

      - name: Apply app icon
        if: \${{ hashFiles('app-icon.png') != '' }}
        run: |
          for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            if [ -d "platforms/android/app/src/main/res/$d" ]; then
              cp app-icon.png "platforms/android/app/src/main/res/$d/ic_launcher.png"
              cp app-icon.png "platforms/android/app/src/main/res/$d/ic_launcher_round.png"
            fi
          done

      - name: Compile Cordova APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        run: cordova build android

      - name: Compile Cordova AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        continue-on-error: true
        run: cordova build android -- --packageType=bundle

      - name: Compile Cordova Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        run: |
          node -e "const fs=require('fs');const p={};fs.readFileSync('signing.properties','utf8').split(String.fromCharCode(10)).forEach(function(l){l=l.trim().replace(String.fromCharCode(13),'');const i=l.indexOf('=');if(i>0)p[l.slice(0,i)]=l.slice(i+1);});fs.writeFileSync('build.json',JSON.stringify({android:{release:{keystore:'user-keystore.jks',storePassword:p.storePassword||'',keyAlias:p.keyAlias||'',keyPassword:p.keyPassword||'',keystoreType:''}}},null,2));console.log('build.json listo');"
          cordova build android --release

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: platforms/android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: platforms/android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: platforms/android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: warn

  # --- Flutter (provider == flutter) ---
  flutter-build:
    if: \${{ github.event.inputs.provider == 'flutter' && github.event.inputs.platform != 'ios' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Create Android host
        working-directory: flutter
        run: |
          cp android/app/src/main/AndroidManifest.xml /tmp/ib-manifest.xml
          flutter create --platforms=android --org com.inteebuild --project-name inteeapp /tmp/ib-flutter-host
          cp -r /tmp/ib-flutter-host/android/. android/
          cp /tmp/ib-manifest.xml android/app/src/main/AndroidManifest.xml
          PKG=$(node -p 'require("../build-config.json").packageName')
          for GF in android/app/build.gradle android/app/build.gradle.kts; do
            if [ -f "$GF" ]; then
              sed -E -i "s/^([[:space:]]*(applicationId|namespace))([[:space:]]*=?[[:space:]]+).*/\\1\\3\\\"$PKG\\\"/" "$GF"
            fi
          done
          MF=$(find android/app/src/main -name MainActivity.kt | head -n1)
          if [ -n "$MF" ]; then
            SRCROOT=$(dirname "$(dirname "$(dirname "$MF")")")
            DIR=$(echo "$PKG" | tr . /)
            mkdir -p "$SRCROOT/$DIR"
            mv "$MF" "$SRCROOT/$DIR/MainActivity.kt"
            sed -i "s/^package .*/package $PKG/" "$SRCROOT/$DIR/MainActivity.kt"
          fi
          ls assets/www/index.html
          echo "--- flutter host listo (applicationId $PKG) ---"

      - name: Flutter pub get
        working-directory: flutter
        run: |
          flutter pub get
          yes | flutter doctor --android-licenses || true

      - name: Build APK
        working-directory: flutter
        run: flutter build apk --release

      - name: Build App Bundle
        if: \${{ contains(github.event.inputs.outputs, 'aab') }}
        working-directory: flutter
        run: flutter build appbundle --release

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: flutter/build/app/outputs/flutter-apk/app-release.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ contains(github.event.inputs.outputs, 'aab') }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: flutter/build/app/outputs/bundle/release/app-release.aab
          if-no-files-found: error

  # --- TWA (provider == twa) ---
  twa-build:
    if: \${{ github.event.inputs.provider == 'twa' && github.event.inputs.platform != 'ios' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "$GITHUB_OUTPUT"
          echo "release_apk=\${{ contains(github.event.inputs.outputs, 'release-apk') }}" >> "$GITHUB_OUTPUT"
          echo "release_aab=\${{ contains(github.event.inputs.outputs, 'release-aab') }}" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json

      - name: Install Bubblewrap CLI
        run: npm install -g @bubblewrap/cli @bubblewrap/core

      - name: Configure Bubblewrap
        run: |
          mkdir -p ~/.bubblewrap
          printf '{"jdkPath":"%s","androidSdkPath":"%s"}' "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json
          cat ~/.bubblewrap/config.json

      - name: Generate TWA project
        if: \${{ hashFiles('twa-manifest.json') != '' }}
        run: |
          NODE_PATH=$(npm root -g) node generate-twa.js
          if [ ! -d "twa-project" ]; then
            echo "::error::TWA project not generated"
            exit 1
          fi
          ls -la twa-project/

      - name: Ensure Android SDK platform
        if: \${{ hashFiles('twa-manifest.json') != '' }}
        run: |
          SDK_VER=$(grep -oE 'compileSdkVersion [0-9]+' twa-project/app/build.gradle | grep -oE '[0-9]+' | head -1)
          echo "platform requerida: $SDK_VER"
          yes | sdkmanager --licenses || true
          sdkmanager --install "platforms;android-$SDK_VER" 2>&1 | tail -5 || true
          SKDMGR=$(command -v sdkmanager || echo "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager")
          mkdir -p "$ANDROID_HOME/bin"
          ln -sf "$SKDMGR" "$ANDROID_HOME/bin/sdkmanager"
          ls -la "$ANDROID_HOME/bin/sdkmanager"

      - name: Build TWA
        if: \${{ hashFiles('twa-manifest.json') != '' }}
        run: |
          cd twa-project
          bubblewrap build
          test -f app-release-signed.apk
          test -f app-release-bundle.aab
          ls -la app-release-signed.apk app-release-bundle.aab

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: twa-project/app-release-signed.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ steps.fmt.outputs.release_apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: twa-project/app-release-signed.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: twa-project/app-release-bundle.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ steps.fmt.outputs.release_aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: twa-project/app-release-bundle.aab
          if-no-files-found: error

  # --- GeckoView (provider == gecko) ---
  gecko-build:
    if: \${{ github.event.inputs.provider == 'gecko' && github.event.inputs.platform != 'ios' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "$GITHUB_OUTPUT"
          echo "release_apk=\${{ contains(github.event.inputs.outputs, 'release-apk') }}" >> "$GITHUB_OUTPUT"
          echo "release_aab=\${{ contains(github.event.inputs.outputs, 'release-aab') }}" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=$(node -p 'require("./build-config.json").compileSdk')" >> "$GITHUB_ENV"

      - name: Create GeckoView Android project
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          APP_NAME=$(node -p 'require("./build-config.json").appName')
          VER_NAME=$(node -p 'require("./build-config.json").versionName')
          VER_CODE=$(node -p 'require("./build-config.json").versionCode')
          COMPILE_SDK=$(node -p 'require("./build-config.json").compileSdk')
          TARGET_SDK=$(node -p 'require("./build-config.json").targetSdk')
          MIN_SDK=$(node -p 'require("./build-config.json").minSdk')
          THEME_COLOR=$(node -p 'require("./build-config.json").themeColor || "#4f46e5"')
          START_URL=$(node -p 'require("./build-config.json").url || "https://example.com"')

          # Create project structure
          mkdir -p gecko-project/app/src/main/java/$(echo $PKG | tr . /)
          mkdir -p gecko-project/app/src/main/res/values
          mkdir -p gecko-project/app/src/main/res/xml
          mkdir -p gecko-project/app/src/main/assets

          # build.gradle (app)
          cat > gecko-project/app/build.gradle <<EOF
          plugins {
            id 'com.android.application'
          }
          android {
            namespace '$PKG'
            compileSdk $COMPILE_SDK
            defaultConfig {
              applicationId "$PKG"
              minSdk $MIN_SDK
              targetSdk $TARGET_SDK
              versionCode $VER_CODE
              versionName "$VER_NAME"
            }
            buildTypes {
              release {
                minifyEnabled true
                proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
              }
            }
            compileOptions {
              sourceCompatibility JavaVersion.VERSION_11
              targetCompatibility JavaVersion.VERSION_11
            }
          }
          dependencies {
            implementation 'org.mozilla.geckoview:geckoview:120.0.20231208211905'
            implementation 'androidx.appcompat:appcompat:1.6.1'
          }
          EOF

          # settings.gradle
          cat > gecko-project/settings.gradle <<'EOF'
          pluginManagement {
            repositories {
              google()
              mavenCentral()
              gradlePluginPortal()
              maven { url 'https://maven.mozilla.org/maven2/' }
            }
            plugins {
              id 'com.android.application' version '8.7.2'
            }
          }
          dependencyResolutionManagement {
            repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
            repositories {
              google()
              mavenCentral()
              maven { url 'https://maven.mozilla.org/maven2/' }
            }
          }
          rootProject.name = "GeckoViewApp"
          include ':app'
          EOF

          # gradle.properties
          cat > gecko-project/gradle.properties <<'EOF'
          org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
          android.useAndroidX=true
          android.enableJetifier=true
          EOF

          # MainActivity.java
          cat > gecko-project/app/src/main/java/$(echo $PKG | tr . /)/MainActivity.java <<EOF
          package $PKG;

          import android.content.Intent;
          import android.os.Bundle;
          import androidx.appcompat.app.AppCompatActivity;
          import org.mozilla.geckoview.GeckoRuntime;
          import org.mozilla.geckoview.GeckoSession;
          import org.mozilla.geckoview.GeckoView;

          public class MainActivity extends AppCompatActivity {
            private GeckoView geckoView;
            private GeckoSession geckoSession;
            private GeckoRuntime geckoRuntime;
            private boolean canGoBack = false;

            @Override
            protected void onCreate(Bundle savedInstanceState) {
              super.onCreate(savedInstanceState);
              geckoView = new GeckoView(this);
              setContentView(geckoView);

              geckoRuntime = GeckoRuntime.create(this);
              geckoSession = new GeckoSession();
              geckoSession.open(geckoRuntime);
              geckoSession.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
                @Override
                public void onCanGoBack(GeckoSession session, boolean value) {
                  canGoBack = value;
                }
              });
              geckoView.setSession(geckoSession);

              Intent intent = getIntent();
              String launchUrl = intent != null && intent.getDataString() != null ? intent.getDataString() : "$START_URL";
              geckoSession.loadUri(launchUrl);

              geckoView.setBackgroundColor(android.graphics.Color.parseColor("$THEME_COLOR"));
            }

            @Override
            protected void onDestroy() {
              geckoSession.close();
              geckoRuntime.shutdown();
              super.onDestroy();
            }

            @Override
            public void onBackPressed() {
              if (canGoBack && geckoSession != null) {
                geckoSession.goBack();
              } else {
                super.onBackPressed();
              }
            }
          }
          EOF

          # AndroidManifest.xml
          cat > gecko-project/app/src/main/AndroidManifest.xml <<EOF
          <?xml version="1.0" encoding="utf-8"?>
          <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <uses-permission android:name="android.permission.INTERNET" />
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

            <application
              android:allowBackup="true"
              android:icon="@mipmap/ic_launcher"
              android:label="$APP_NAME"
              android:theme="@style/Theme.GeckoViewApp"
              android:usesCleartextTraffic="true">
              <activity
                android:name=".MainActivity"
                android:exported="true"
                android:configChanges="orientation|screenSize|keyboardHidden"
                android:windowSoftInputMode="adjustResize">
                <intent-filter>
                  <action android:name="android.intent.action.MAIN" />
                  <category android:name="android.intent.category.LAUNCHER" />
                </intent-filter>
              </activity>
            </application>
          </manifest>
          EOF

          # themes.xml
          cat > gecko-project/app/src/main/res/values/themes.xml <<EOF
          <resources>
            <style name="Theme.GeckoViewApp" parent="Theme.AppCompat.NoActionBar">
              <item name="android:statusBarColor">$THEME_COLOR</item>
              <item name="android:navigationBarColor">$THEME_COLOR</item>
            </style>
          </resources>
          EOF

          # proguard-rules.pro
          cat > gecko-project/app/proguard-rules.pro <<'EOF'
          -keep class org.mozilla.geckoview.** { *; }
          -keep class androidx.** { *; }
          -dontwarn org.mozilla.geckoview.**
          EOF

          echo "--- GeckoView project created ---"
          ls -la gecko-project/
          ls -la gecko-project/app/src/main/java/$(echo $PKG | tr . /)/

      - name: Launcher icons
        run: node make-icons.js gecko-project

      - name: Generate Gradle wrapper
        run: |
          cd gecko-project
          gradle wrapper --gradle-version 8.9 --distribution-type bin

      - name: Setup Android SDK
        run: |
          echo "ANDROID_HOME=\$ANDROID_HOME"
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-\${COMPILE_SDK:-35}" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Build Debug APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        run: |
          cd gecko-project
          ./gradlew assembleDebug --no-daemon

      - name: Build Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        run: |
          cd gecko-project
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew assembleRelease --no-daemon

      - name: Build Debug AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        run: |
          cd gecko-project
          ./gradlew bundleDebug --no-daemon

      - name: Build Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        run: |
          cd gecko-project
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: gecko-project/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: gecko-project/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: gecko-project/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: gecko-project/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

  # --- Android TV (platform == tv) ---
  tv-build:
    if: \${{ github.event.inputs.platform == 'tv' && github.event.inputs.provider != 'flutter' && github.event.inputs.provider != 'cordova' && github.event.inputs.provider != 'twa' && github.event.inputs.provider != 'gecko' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "\$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "\$GITHUB_OUTPUT"
          echo "release_apk=\${{ contains(github.event.inputs.outputs, 'release-apk') }}" >> "\$GITHUB_OUTPUT"
          echo "release_aab=\${{ contains(github.event.inputs.outputs, 'release-aab') }}" >> "\$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=\$(node -p 'require("./build-config.json").compileSdk')" >> "\$GITHUB_ENV"
          echo "TARGET_SDK=\$(node -p 'require("./build-config.json").targetSdk')" >> "\$GITHUB_ENV"
          echo "MIN_SDK=\$(node -p 'require("./build-config.json").minSdk')" >> "\$GITHUB_ENV"
          cat "\$GITHUB_ENV"

      - name: Setup Android SDK
        run: |
          echo "ANDROID_HOME=\$ANDROID_HOME"
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-\${COMPILE_SDK:-35}" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        run: |
          if [ -d android ]; then cp -r android /tmp/prebuilt-android && rm -rf android; fi
          npx cap add android
          if [ -d /tmp/prebuilt-android ]; then cp -r /tmp/prebuilt-android/. android/; fi

      - name: Sync Capacitor Android
        run: npx cap sync android

      - name: Apply TV manifest
        run: |
          cp tv-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- TV manifest applied ---"

      - name: Apply TV banner
        if: \${{ hashFiles('tv-banner.png') != '' }}
        run: |
          cp tv-banner.png android/app/src/main/res/drawable-xxhdpi/tv_banner.png
          echo "--- TV banner applied ---"

      - name: Apply provider WebView
        run: |
          PROVIDER=\$(node -p 'require("./build-config.json").provider')
          PKG=\$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/\$(echo \$PKG | tr . /)"
          echo "Provider: \$PROVIDER"
          if [ "\$PROVIDER" = "native" ] && [ -f "native-MainActivity.java" ]; then cp native-MainActivity.java "\$DST/MainActivity.java"; echo "native webview applied"; fi
          cat provider.json || true

      - name: Generate Gradle wrapper
        run: |
          gradle wrapper --gradle-version 8.5 --distribution-type all

      - name: Build Debug APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Build Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew assembleRelease --no-daemon

      - name: Build Debug AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Build Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

  # --- Wear OS (platform == wear) ---
  wear-build:
    if: \${{ github.event.inputs.platform == 'wear' && github.event.inputs.provider != 'flutter' && github.event.inputs.provider != 'cordova' && github.event.inputs.provider != 'twa' && github.event.inputs.provider != 'gecko' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "\$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "\$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=\$(node -p 'require("./build-config.json").compileSdk')" >> "\$GITHUB_ENV"
          echo "TARGET_SDK=\$(node -p 'require("./build-config.json").targetSdk')" >> "\$GITHUB_ENV"
          echo "MIN_SDK=\$(node -p 'require("./build-config.json").minSdk')" >> "\$GITHUB_ENV"
          cat "\$GITHUB_ENV"

      - name: Setup Android SDK
        run: |
          echo "ANDROID_HOME=\$ANDROID_HOME"
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-\${COMPILE_SDK:-35}" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        run: |
          if [ -d android ]; then cp -r android /tmp/prebuilt-android && rm -rf android; fi
          npx cap add android
          if [ -d /tmp/prebuilt-android ]; then cp -r /tmp/prebuilt-android/. android/; fi

      - name: Sync Capacitor Android
        run: npx cap sync android

      - name: Apply Wear manifest
        run: |
          cp wear-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- Wear manifest applied ---"

      - name: Apply provider WebView
        run: |
          PROVIDER=\$(node -p 'require("./build-config.json").provider')
          PKG=\$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/\$(echo \$PKG | tr . /)"
          echo "Provider: \$PROVIDER"
          if [ "\$PROVIDER" = "native" ] && [ -f "native-MainActivity.java" ]; then cp native-MainActivity.java "\$DST/MainActivity.java"; echo "native webview applied"; fi
          cat provider.json || true

      - name: Generate Gradle wrapper
        run: |
          gradle wrapper --gradle-version 8.5 --distribution-type all

      - name: Build Debug APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Build Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew assembleRelease --no-daemon

      - name: Build Debug AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Build Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

  # --- ChromeOS (platform == chromeos) ---
  chromeos-build:
    if: \${{ github.event.inputs.platform == 'chromeos' && github.event.inputs.provider != 'flutter' && github.event.inputs.provider != 'cordova' && github.event.inputs.provider != 'twa' && github.event.inputs.provider != 'gecko' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve requested outputs
        id: fmt
        run: |
          echo "apk=\${{ contains(github.event.inputs.outputs, 'apk') || github.event.inputs.outputs == '' }}" >> "\$GITHUB_OUTPUT"
          echo "aab=\${{ contains(github.event.inputs.outputs, 'aab') }}" >> "\$GITHUB_OUTPUT"
          echo "release_apk=\${{ contains(github.event.inputs.outputs, 'release-apk') }}" >> "\$GITHUB_OUTPUT"
          echo "release_aab=\${{ contains(github.event.inputs.outputs, 'release-aab') }}" >> "\$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=\$(node -p 'require("./build-config.json").compileSdk')" >> "\$GITHUB_ENV"
          echo "TARGET_SDK=\$(node -p 'require("./build-config.json").targetSdk')" >> "\$GITHUB_ENV"
          echo "MIN_SDK=\$(node -p 'require("./build-config.json").minSdk')" >> "\$GITHUB_ENV"
          cat "\$GITHUB_ENV"

      - name: Setup Android SDK
        run: |
          echo "ANDROID_HOME=\$ANDROID_HOME"
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-\${COMPILE_SDK:-35}" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        run: |
          if [ -d android ]; then cp -r android /tmp/prebuilt-android && rm -rf android; fi
          npx cap add android
          if [ -d /tmp/prebuilt-android ]; then cp -r /tmp/prebuilt-android/. android/; fi

      - name: Sync Capacitor Android
        run: npx cap sync android

      - name: Apply ChromeOS manifest
        run: |
          cp chromeos-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- ChromeOS manifest applied ---"

      - name: Apply provider WebView
        run: |
          PROVIDER=\$(node -p 'require("./build-config.json").provider')
          PKG=\$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/\$(echo \$PKG | tr . /)"
          echo "Provider: \$PROVIDER"
          if [ "\$PROVIDER" = "native" ] && [ -f "native-MainActivity.java" ]; then cp native-MainActivity.java "\$DST/MainActivity.java"; echo "native webview applied"; fi
          cat provider.json || true

      - name: Generate Gradle wrapper
        run: |
          gradle wrapper --gradle-version 8.5 --distribution-type all

      - name: Build Debug APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Build Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew assembleRelease --no-daemon

      - name: Build Debug AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Build Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        working-directory: android
        run: |
          cp ../user-keystore.jks app/release.jks
          cp ../signing.properties .
          ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        if: \${{ steps.fmt.outputs.apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_apk == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ steps.fmt.outputs.aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && steps.fmt.outputs.release_aab == 'true' }}
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

  # --- Tauri (provider == tauri) ---
  tauri-build:
    if: \${{ github.event.inputs.provider == 'tauri' && github.event.inputs.platform != 'ios' }}
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Build release binary
        shell: bash
        run: cargo build --release --manifest-path tauri/src-tauri/Cargo.toml

      - name: Locate binary
        id: bin
        shell: bash
        run: |
          EXE=$(find tauri/src-tauri/target/release -maxdepth 1 -name '*.exe' ! -name '*.pdb' | head -n 1)
          if [ -z "$EXE" ]; then echo "::error::No se genero el .exe de Tauri"; exit 1; fi
          echo "path=$EXE" >> "$GITHUB_OUTPUT"
          ls -lh "$EXE"

      - name: Upload EXE
        uses: actions/upload-artifact@v4
        with:
          retention-days: 3
          name: inteebuild-\${{ github.event.inputs.id }}-exe
          path: \${{ steps.bin.outputs.path }}
          if-no-files-found: error
`;





const DECOMPILE_WORKFLOW_YML = `name: decompile-app
on:
  workflow_dispatch:
    inputs:
      id:
        description: 'Decompile ID (InteeBuild)'
        required: true
        type: string

permissions:
  contents: write
  actions: write

concurrency:
  group: ib-decompile-\${{ github.repository }}
  cancel-in-progress: false

jobs:
  decompile:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Find input APK
        run: |
          APK=$(find input -maxdepth 2 -name '*.apk' -o -name '*.APK' 2>/dev/null | head -n 1)
          if [ -z "$APK" ]; then APK=$(find . -maxdepth 3 -name '*.apk' | head -n 1); fi
          if [ -z "$APK" ]; then echo "::error::No se encontro APK en input/"; exit 1; fi
          echo "APK=$APK" >> "$GITHUB_ENV"
          echo "APK encontrado: $APK"
          ls -lh "$APK"

      - name: Install apktool
        run: |
          V=2.9.3
          for U in "https://github.com/iBotPeaches/Apktool/releases/download/v$V/apktool_$V.jar" "https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_$V.jar"; do
            if curl -fsSL "$U" -o apktool.jar && [ -s apktool.jar ]; then echo "apktool $V desde $U"; break; fi
          done
          test -s apktool.jar || { echo "::error::apktool no se pudo descargar"; exit 1; }
          java -jar apktool.jar --version || true

      - name: Install jadx
        run: |
          V=1.5.1
          curl -fsSL "https://github.com/skylot/jadx/releases/download/v$V/jadx-$V.zip" -o jadx.zip
          unzip -q jadx.zip -d jadx
          chmod +x jadx/bin/jadx
          jadx/bin/jadx --version

      - name: apktool decode (manifest + recursos + smali)
        run: java -jar apktool.jar d "$APK" -o apktool-out -f

      - name: jadx decode (fuentes Java)
        run: |
          jadx/bin/jadx -d jadx-out --no-res "$APK" || jadx/bin/jadx -d jadx-out "$APK"

      - name: Build reimportable report
        run: |
          ID="\${{ github.event.inputs.id }}"
          mkdir -p output/sources output/resources
          cp -r jadx-out/sources/* output/sources/ 2>/dev/null || true
          cp -r apktool-out/* output/resources/ 2>/dev/null || true
          cp apktool-out/AndroidManifest.xml output/AndroidManifest-decoded.xml 2>/dev/null || true
          {
            echo "=== InteeBuild Cloud Decompiler ==="
            echo "id: $ID"
            echo "apk: $APK"
            echo "herramientas: jadx 1.5.1 + apktool 2.9.3"
            echo ""
            echo "--- paquetes detectados (sources) ---"
            find output/sources -name '*.java' | head -n 200 | sed 's#output/sources/##'
            echo ""
            echo "--- permisos del manifest decodificado ---"
            grep -o 'android:name="[^"]*permission[^"]*"' output/AndroidManifest-decoded.xml 2>/dev/null | head -n 60 || true
          } > output/REPORT.txt
          echo "--- REPORT.txt ---"
          head -n 40 output/REPORT.txt
          echo ""
          echo "fuentes: $(find output/sources -name '*.java' 2>/dev/null | wc -l) .java"

      - name: Package zip
        run: |
          zip -qr decompiled.zip output || tar -czf decompiled.tar.gz output
          ls -lh decompiled.zip decompiled.tar.gz 2>/dev/null || true

      - name: Upload decompiled sources
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-decompile-\${{ github.event.inputs.id }}
          path: decompiled.*
          if-no-files-found: error
          retention-days: 7
`;


module.exports = {
  WORKFLOW_YML,
  DECOMPILE_WORKFLOW_YML
};
