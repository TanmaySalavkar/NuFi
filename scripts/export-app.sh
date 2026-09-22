#!/usr/bin/env bash
set -e

# Project directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
BUILDS_DIR="$PROJECT_ROOT/builds"

mkdir -p "$BUILDS_DIR"

MODE="${1:-debug}"

echo "==========================================="
echo " 📱 NuFi / SMC Android App Exporter        "
echo "==========================================="
echo " Mode: $MODE"
echo " Target dir: $BUILDS_DIR"
echo ""

cd "$ANDROID_DIR"

if [ "$MODE" = "release" ]; then
    echo "🔨 Building Release APK..."
    ./gradlew assembleRelease
    
    SOURCE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    DEST_APK="$BUILDS_DIR/NuFi-Release.apk"
    
    if [ -f "$SOURCE_APK" ]; then
        cp "$SOURCE_APK" "$DEST_APK"
        echo ""
        echo "✅ Release APK exported successfully!"
        echo "📦 Location: $DEST_APK"
        ls -lh "$DEST_APK"
    fi

elif [ "$MODE" = "bundle" ] || [ "$MODE" = "aab" ]; then
    echo "🔨 Building Android App Bundle (AAB for Google Play)..."
    ./gradlew bundleRelease
    
    SOURCE_AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
    DEST_AAB="$BUILDS_DIR/NuFi-AppBundle.aab"
    
    if [ -f "$SOURCE_AAB" ]; then
        cp "$SOURCE_AAB" "$DEST_AAB"
        echo ""
        echo "✅ App Bundle exported successfully!"
        echo "📦 Location: $DEST_AAB"
        ls -lh "$DEST_AAB"
    fi

else
    echo "🔨 Building Debug APK (Installable test APK)..."
    ./gradlew assembleDebug
    
    SOURCE_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    DEST_APK="$BUILDS_DIR/NuFi-Debug.apk"
    
    if [ -f "$SOURCE_APK" ]; then
        cp "$SOURCE_APK" "$DEST_APK"
        echo ""
        echo "==========================================="
        echo "✅ APK exported successfully!"
        echo "==========================================="
        echo "📦 Output file: $DEST_APK"
        ls -lh "$DEST_APK"
        echo ""
        echo "💡 To install directly on your connected phone/emulator:"
        echo "   adb install -r $DEST_APK"
        echo "==========================================="
    fi
fi
