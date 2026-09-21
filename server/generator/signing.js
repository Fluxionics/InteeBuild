'use strict';

function iosSignScriptSrc() {
  return "const fs = require('fs');\n"
    + "const os = require('os');\n"
    + "const path = require('path');\n"
    + "const cp = require('child_process');\n"
    + "function run(cmd) { console.log('> ' + cmd); cp.execSync(cmd, { stdio: 'inherit' }); }\n"
    + "function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }\n"
    + "const cfg = JSON.parse(fs.readFileSync('build-config.json', 'utf8'));\n"
    + "const sign = JSON.parse(fs.readFileSync('ios-sign.json', 'utf8'));\n"
    + "const bundleId = cfg.packageName;\n"
    + "const method = cfg.iosExportMethod || 'development';\n"
    + "run('security cms -D -i ios-profile.mobileprovision -o /tmp/ib-profile.plist');\n"
    + "const uuid = cp.execSync('/usr/libexec/PlistBuddy -c \"Print :UUID\" /tmp/ib-profile.plist').toString().trim();\n"
    + "const profName = cp.execSync('/usr/libexec/PlistBuddy -c \"Print :Name\" /tmp/ib-profile.plist').toString().trim();\n"
    + "console.log('Perfil: ' + profName + ' (' + uuid + ')');\n"
    + "run('security create-keychain -p actions ib-build.keychain');\n"
    + "run('security set-keychain-settings -lut 21600 ib-build.keychain');\n"
    + "run('security unlock-keychain -p actions ib-build.keychain');\n"
    + "run('security import ios-cert.p12 -k ib-build.keychain -P ' + JSON.stringify(sign.p12Password) + ' -T /usr/bin/codesign');\n"
    + "run('security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions ib-build.keychain');\n"
    + "run('security list-keychains -d user -s ib-build.keychain login.keychain');\n"
    + "const identLine = cp.execSync('security find-identity -v -p codesigning ib-build.keychain | head -1').toString().trim();\n"
    + "console.log('Identidad: ' + identLine);\n"
    + "const mm = identLine.match(/\"([^\"]+)\"/);\n"
    + "const identity = mm ? mm[1] : '';\n"
    + "if (!identity) { throw new Error('No se encontro identidad de firma en el .p12 (revisa la contrasena)'); }\n"
    + "const provDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');\n"
    + "fs.mkdirSync(provDir, { recursive: true });\n"
    + "fs.copyFileSync('ios-profile.mobileprovision', path.join(provDir, uuid + '.mobileprovision'));\n"
    + "const plist = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>' + '\\n'\n"
    + "  + '<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">' + '\\n'\n"
    + "  + '<plist version=\"1.0\"><dict>' + '\\n'\n"
    + "  + '<key>method</key><string>' + escXml(method) + '</string>' + '\\n'\n"
    + "  + '<key>signingStyle</key><string>manual</string>' + '\\n'\n"
    + "  + '<key>stripSwiftSymbols</key><true/>' + '\\n'\n"
    + "  + '<key>provisioningProfiles</key><dict><key>' + escXml(bundleId) + '</key><string>' + escXml(profName) + '</string></dict>' + '\\n'\n"
    + "  + '</dict></plist>';\n"
    + "fs.writeFileSync('/tmp/ib-export.plist', plist);\n"
    + "run('xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -archivePath /tmp/ib-app.xcarchive archive CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=' + JSON.stringify(identity) + ' PROVISIONING_PROFILE=' + uuid);\n"
    + "run('xcodebuild -exportArchive -archivePath /tmp/ib-app.xcarchive -exportPath /tmp/ib-export -exportOptionsPlist /tmp/ib-export.plist');\n"
    + "console.log('Exportado: ' + fs.readdirSync('/tmp/ib-export').join(', '));\n";
}


module.exports = {
  iosSignScriptSrc
};
