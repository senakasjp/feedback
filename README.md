# Feedback Manager v3.0.5

A comprehensive desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization, professional PDF generation, advanced assessment management capabilities, comprehensive grade distribution analysis, automatic data saving, and intelligent paragraph merging.

## 🎉 Version 3.0.5 - Complete Data Separation and Contamination Prevention

This release completely fixes the issue where both assignment and student versions of paragraphs were being displayed when no student was selected:

### 🐛 Critical Bug Fixes
- **Fixed Merged Paragraph Display**: Resolved issue where both assignment and student versions of paragraphs were being displayed when no student was selected
- **Prevented Assessment Data Contamination**: Fixed autosave system that was saving merged paragraphs to assessment files
- **Added Paragraph Filtering**: Implemented strict filtering to remove student paragraphs from assignment-only views
- **Enhanced Data Separation**: Complete separation between assignment and student data in all storage operations

## 🎉 Version 3.0.4 - Assessment Data Contamination Fix

This release fixes a critical bug where student data was being loaded when selecting an assessment without selecting a student:

### 🐛 Critical Bug Fixes
- **Fixed Assessment Data Contamination**: Resolved issue where student data was being loaded when selecting an assessment without selecting a student
- **Strict Data Separation**: Assessment data files now properly separate assignment-level data from student-specific data
- **Clean Assessment Loading**: When no student is selected, assessment data loading now ensures student-specific fields are cleared

## 🎉 Version 3.0.3 - Index-Based Paragraph Merging and Knowledge Area Improvements

This release introduces advanced paragraph comparison, assignment-specific knowledge areas, and enhanced save functionality:

### 🚀 Major New Features
- **Index-Based Paragraph Merging**: Advanced system that detects differences between assignment and student paragraphs at the same index position
- **Dual Version Display**: When paragraphs differ, both assignment and student versions are displayed with clear visual indicators
- **Assignment-Specific Knowledge Areas**: Knowledge areas are now stored as assignment properties instead of global entities
- **Enhanced Save Functionality**: Added dedicated "Save Assignment" button in the right panel for manual assignment data saving

### 🎨 User Interface Improvements
- **Source Indicators**: Clear visual badges distinguish between "Assignment" (blue) and "Student" (green) paragraph versions
- **Knowledge Area Persistence**: Knowledge area selection now remains intact when adding paragraphs (consistent with category behavior)
- **Enhanced Right Panel**: Save Assignment button positioned logically under the print button in the sidebar
- **Improved Visual Feedback**: Professional badge system with icons for easy identification of paragraph sources

## 🎉 Version 3.0.2 - Autosave and UI Improvements

This release introduces comprehensive autosave functionality and user interface improvements for enhanced user experience:

### 🚀 Major New Features
- **Automatic Data Saving**: Comprehensive autosave system that automatically saves data every 2 seconds after changes
- **Visual Save Status**: Real-time save status indicator in the navbar showing "Saving...", "Saved", or "Ready"
- **Smart Debouncing**: Prevents excessive save operations by waiting 2 seconds after the last change before saving

### 🎨 User Interface Improvements
- **Cleaner Paragraph Display**: Removed paragraph numbers (e.g., "#0") from checkboxes for cleaner, less cluttered interface
- **Enhanced Visual Feedback**: Spinning animation during save operations with professional status indicators
- **Improved User Experience**: Users no longer need to manually save data - everything is preserved automatically

### 🔧 Technical Improvements
- **Reactive Autosave System**: Uses Svelte's `$effect()` to watch for data changes and trigger automatic saves
- **Debounced Save Operations**: Intelligent debouncing prevents excessive file I/O operations
- **Multiple Data Types**: Autosave works for assessment data, subject/student data, and all user interactions
- **Error Handling**: Graceful handling of save failures with console logging
- **Status Tracking**: Real-time tracking of save state with visual feedback

## 🎉 Version 3.0.1 - Bug Fix Release

This release fixes a critical bug in paragraph selection functionality and introduces enhanced data integrity features:

### 🐛 Critical Bug Fixes
- **Fixed Paragraph Selection Issue**: Resolved critical bug where paragraph checkboxes stopped working when students with saved data were selected
- **Deterministic ID Generation**: Implemented deterministic paragraph ID generation based on content and position to ensure consistent IDs across sessions
- **Saved Selection Validation**: Added validation system to filter out invalid saved selections that don't match current paragraph IDs
- **Enhanced Data Integrity**: Improved paragraph selection system to handle ID mismatches gracefully

## 🎉 Version 3.0.0 - Major Release

This major release introduces significant enhancements to the Feedback Manager application:

### 🆕 Major New Features
- **Comprehensive Grade Distribution Analysis**: Complete grade tracking system with professional UI table and PDF synchronization
- **Enhanced Performance Analysis**: Improved categorization logic with proper lowest performer detection
- **Professional PDF Reports**: Synchronized PDF grade distribution with Range column matching UI table exactly
- **Advanced Student Management**: Bootstrap 5 confirmation modals with comprehensive file cleanup

### 📊 Key Improvements
- **Grade Distribution Table**: Shows all letter grades (A+ through E) with counts, percentages, and ranges
- **Performance Highlights**: Side-by-side cards with responsive layout and improved categorization
- **PDF-UI Synchronization**: Perfect consistency between PDF reports and UI tables
- **Responsive Design**: Optimal viewing experience across all device sizes

### 🚀 Ready for Production
Version 3.0.0 represents a mature, feature-complete academic assessment and reporting solution suitable for professional educational environments.

## Quick Start

### Prerequisites
- Node.js (v16+)
- Rust (latest stable)
- npm or yarn

### Installation
```bash
# Clone or extract the project
cd feedback-app

# Install dependencies
npm install

# Start development server
npm run dev -- --host

# Build for production
npm run tauri build
```

### First Run
1. Launch the application
2. Create your first subject (e.g., "Studio 6")
3. Add an assessment (e.g., "Mid-PDR")
4. Create categories for the assessment
5. Add students and begin creating feedback

## Key Features

- **Dual Storage System**: Sophisticated paragraph management with assignment-level and student-level storage
- **Hierarchical Organization**: Subjects → Assessments → Categories → Paragraphs
- **Student Management**: Comprehensive student database with photo upload
- **PDF Generation**: Professional report generation with images
- **Assessment Weighting**: Percentage-based assessment weights
- **CSV Export**: Student marks table export functionality
- **Cross-Platform**: Windows, macOS, and Linux support

## Architecture Overview

The application uses a modern tech stack with clear separation of concerns:

- **Frontend**: Svelte 5 with Bootstrap 5 UI
- **Backend**: Tauri (Rust) for desktop functionality
- **Storage**: JSON-based file system for portability
- **Build**: Vite for frontend bundling

## Documentation

- **[User Guide](USER_GUIDE.md)** - How to use the application
- **[Architecture](ARCHITECTURE.md)** - Technical architecture and design
- **[Development Guide](DEVELOPMENT.md)** - Setup and development workflow
- **[API Reference](API_REFERENCE.md)** - Technical API documentation
- **[Changelog](CHANGELOG.md)** - Version history and changes

## Data Storage

The application implements a sophisticated dual storage system:

- **Assignment-Level**: Paragraphs stored per assessment
- **Student-Level**: Complete paragraph history across all assignments
- **Evaluation Data**: Marks, selections, and metadata per student-assessment

## Build & Distribution

### Development
```bash
npm run tauri dev
```

### Production
```bash
npm run tauri build
```

### Outputs
- **Windows**: `.exe` installer and portable executable
- **macOS**: `.app` bundle and `.dmg` installer
- **Linux**: `.deb`, `.rpm`, and `.AppImage` packages

## Portable Installation

The application is designed to be portable:
- All data stored in `FeedbackData/` folder next to executable
- No registry entries or system dependencies
- Copy entire folder to any computer
- Data persists across installations

## License

This project is proprietary software.

## Support

For technical issues, refer to the [Development Guide](DEVELOPMENT.md) troubleshooting section.