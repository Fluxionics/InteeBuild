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

permissions:
  contents: read
  actions: write

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

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
          echo "COMPILE_SDK=$(node -p 'require(\\"./build-config.json\\").compileSdk')" >> "$GITHUB_ENV"
          echo "TARGET_SDK=$(node -p 'require(\\"./build-config.json\\").targetSdk')" >> "$GITHUB_ENV"
          echo "MIN_SDK=$(node -p 'require(\\"./build-config.json\\").minSdk')" >> "$GITHUB_ENV"
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
        if: \${{ github.event.inputs.platform != 'ios' }}
        run: npx cap add android

      - name: Add Capacitor iOS platform
        if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
        run: npx cap add ios

      - name: Sync Capacitor
        run: npx cap sync

      - name: Suppress compileSdk warning
        run: echo 'android.suppressUnsupportedCompileSdk=36' >> android/gradle.properties

      - name: Apply SDK versions
        run: |
          sed -i "s/minSdkVersion = .*/minSdkVersion = \${MIN_SDK:-23}/" android/variables.gradle
          sed -i "s/compileSdkVersion = .*/compileSdkVersion = \${COMPILE_SDK:-35}/" android/variables.gradle
          sed -i "s/targetSdkVersion = .*/targetSdkVersion = \${TARGET_SDK:-35}/" android/variables.gradle
          echo '--- variables.gradle ---'
          sed -n '1,12p' android/variables.gradle

      - name: Apply permissions manifest
        run: |
          cp main-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- permisos aplicados ---"
          grep -o 'android:name="[^"]*"' android/app/src/main/AndroidManifest.xml

      - name: Validate manifest XML
        run: python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse('android/app/src/main/AndroidManifest.xml');print('manifest XML OK')"

      - name: Install native permissions runtime
        if: "hashFiles('NativePermissions.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp NativePermissions.java "$DST/NativePermissions.java"
          node patch-permissions.js
          echo "--- permisos nativos instalados ---"
          grep -c NativePermissions "$DST/MainActivity.java" || true

      - name: Install special access (Settings flows)
        if: "hashFiles('SpecialAccess.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp SpecialAccess.java "$DST/SpecialAccess.java"
          node patch-special.js
          echo "--- accesos especiales instalados ---"
          grep -c SpecialAccess "$DST/MainActivity.java" || true

      - name: Install NFC tech filter
        if: "hashFiles('res/xml/nfc_tech_filter.xml') != ''"
        run: |
          mkdir -p android/app/src/main/res/xml
          cp res/xml/nfc_tech_filter.xml android/app/src/main/res/xml/nfc_tech_filter.xml
          echo "--- filtro NFC instalado ---"

      - name: Install catalog native patches
        if: "hashFiles('patch-catalog.js') != ''"
        run: |
          node patch-catalog.js
          echo "--- catalog patches aplicados ---"
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

      - name: Install background audio service
        if: "hashFiles('RadioService.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp RadioService.java "$DST/RadioService.java"
          node patch-main-activity.js
          echo "--- servicio instalado ---"
          grep -c RadioService "$DST/MainActivity.java"

      - name: Install native audio bridge (InteeAudio)
        if: "hashFiles('AudioBridge.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp AudioBridge.java "$DST/AudioBridge.java"
          node patch-audio.js
          echo "--- audio nativo instalado ---"
          grep -c InteeAudio "$DST/MainActivity.java" || true

      - name: Apply app icon
        if: "hashFiles('app-icon.png') != ''"
        run: |
          for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher.png"
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher_round.png"
          done

      - name: Note iOS
        if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
        run: echo 'iOS project generated in ios/ - compile requires macOS with Xcode'

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
        if: "hashFiles('inteebridge-inject.js') != ''"
        run: |
          mkdir -p android/app/src/main/assets/public
          cp inteebridge-inject.js android/app/src/main/assets/public/inteebridge.js

      - name: Apply catalog assets
        run: |
          if [ -f "assetlinks.json" ]; then mkdir -p android/app/src/main/assets/.well-known; cp assetlinks.json android/app/src/main/assets/.well-known/assetlinks.json; echo "assetlinks ok"; fi
          if [ -f "google-services.json" ]; then cp google-services.json android/app/google-services.json; echo "firebase ok"; fi
          if [ -f "www/catalog.js" ]; then mkdir -p android/app/src/main/assets/public; cp www/catalog.js android/app/src/main/assets/public/catalog.js; echo "catalog js ok"; fi

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

      - name: Compile APK
        if: \${{ github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Compile Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both') }}
        working-directory: android
        run: ./gradlew assembleRelease --no-daemon

      - name: Compile AAB
        if: \${{ github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Compile Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both') }}
        working-directory: android
        run: ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        if: \${{ github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both') }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both') }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error

  ios-check:
    if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
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

      - name: Add iOS platform
        run: npx cap add ios

      - name: Sync iOS
        run: npx cap sync ios

      - name: Validate iOS build (simulador)
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: |
          cd ios/App
          xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO

      - name: Note App Store
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: echo 'Proyecto iOS validado. Para IPA instalable sube tu certificado .p12 + perfil .mobileprovision en el paso Firma.'

      - name: Sign and export IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        run: node ios-sign.js

      - name: Upload IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-ipa
          path: /tmp/ib-export/*.ipa
          if-no-files-found: error
`;


module.exports = {
  WORKFLOW_YML
};
