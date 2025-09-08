#!/bin/bash

# Feedback App Installation Script
# This script installs both the app and data to Applications

echo "Installing Feedback App..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BUNDLE_DIR="$SCRIPT_DIR/src-tauri/target/release/bundle/macos"

# Check if the bundle directory exists
if [ ! -d "$BUNDLE_DIR" ]; then
    echo "Error: Bundle directory not found at $BUNDLE_DIR"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Copy the app to Applications
echo "Copying Feedback.app to Applications..."
cp -r "$BUNDLE_DIR/Feedback.app" /Applications/

# Copy the FeedbackData folder to Applications
echo "Copying FeedbackData folder to Applications..."
cp -r "$BUNDLE_DIR/FeedbackData" /Applications/

echo "Installation complete!"
echo "You can now find Feedback.app in your Applications folder"
echo "The FeedbackData folder is also in Applications/ for the app to access"
