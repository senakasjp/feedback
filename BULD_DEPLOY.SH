#!/usr/bin/env bash

echo "[1/5] Building Tauri app..."
npm run tauri:build -- --bundles app
echo "✅ Build successful"

echo "[2/5] Stopping running Feedback app (if any)..."
pkill -x Feedback || true
echo "✅ Stop step completed"

echo "[3/5] Removing old app from /Applications..."
rm -rf "/Applications/Feedback.app"
echo "✅ Old app removed"

echo "[4/5] Copying new app bundle to /Applications..."
cp -R "src-tauri/target/release/bundle/macos/Feedback.app" /Applications/
echo "✅ App copied successfully"

echo "[5/5] Launching app..."
open "/Applications/Feedback.app"
echo "✅ Deployment successful"
