#!/bin/bash
# Baut ER-Editor.app (arm64 + x86_64) und ein DMG: macos/build.sh
# Ergebnis: build/ER-Editor.app und build/ER-Editor-<Version>.dmg
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION="$(cat VERSION)"

# Versionsverlauf muss zur Version passen; CHANGELOG.md wird daraus erzeugt
python3 tools/changelog.py --check "$VERSION"
BUILD=build
APP="$BUILD/ER-Editor.app"

rm -rf "$BUILD"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web" "$BUILD/obj"

# Programm
for arch in arm64 x86_64; do
  xcrun swiftc -O -module-name EREditor -target "$arch-apple-macos12.0" macos/main.swift -o "$BUILD/obj/ER-Editor-$arch"
done
lipo -create "$BUILD"/obj/ER-Editor-* -output "$APP/Contents/MacOS/ER-Editor"

# Web-App und Info.plist
# Versionskennung der Web-Dateien (gegen gemischte Browser-Caches) an VERSION angleichen
sed -i '' -E "s/\?v=[0-9A-Za-z.-]+/?v=$VERSION/g" index.html
cp index.html style.css app.js changelog.js relational.js "$APP/Contents/Resources/web/"
sed "s/__VERSION__/$VERSION/g" macos/Info.plist > "$APP/Contents/Info.plist"

# Icon
ICONSET="$BUILD/obj/AppIcon.iconset"
mkdir -p "$ICONSET"
xcrun swiftc -O macos/make-icon.swift -o "$BUILD/obj/make-icon"
for size in 16 32 128 256 512; do
  "$BUILD/obj/make-icon" "$ICONSET/icon_${size}x${size}.png" "$size"
  "$BUILD/obj/make-icon" "$ICONSET/icon_${size}x${size}@2x.png" "$((size * 2))"
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

# Ad-hoc-Signatur (nicht notarisiert)
codesign --force --deep --sign - "$APP"

# DMG mit Verknüpfung zum Programme-Ordner
STAGE="$BUILD/obj/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Programme"
hdiutil create -quiet -volname "ER-Editor $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$BUILD/ER-Editor-$VERSION.dmg"

rm -rf "$BUILD/obj"
echo "Fertig: $APP und $BUILD/ER-Editor-$VERSION.dmg"
shasum -a 256 "$BUILD/ER-Editor-$VERSION.dmg"
