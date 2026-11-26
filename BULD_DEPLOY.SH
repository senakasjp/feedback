#!/usr/bin/env bash
set -euo pipefail

echo "[1/6] Running E2E tests..."
npm run test:e2e -- tests/e2e/subject-navigation.spec.js
echo "✅ Tests passed"

echo "[2/6] Building Tauri app..."
npm run tauri:build -- --bundles app
echo "✅ Build successful"

echo "[3/6] Stopping running Feedback app (if any)..."
# The bundle executable is named "app", so quit by bundle id first and then by path.
osascript -e 'tell application id "com.senaka.feedback" to quit' 2>/dev/null || true
sleep 1
pkill -f "/Applications/Feedback.app/Contents/MacOS/app" 2>/dev/null || true
echo "✅ Stop step completed"

echo "[4/6] Removing old app from /Applications..."
rm -rf "/Applications/Feedback.app"
echo "✅ Old app removed"

echo "[5/6] Copying new app bundle to /Applications..."
cp -R "src-tauri/target/release/bundle/macos/Feedback.app" /Applications/
echo "✅ App copied successfully"

echo "[6/6] Launching app..."
open "/Applications/Feedback.app"
echo "✅ Deployment successful"
