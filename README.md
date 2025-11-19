# Feedback Manager v3.2.4

A comprehensive desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization, professional PDF generation, advanced assessment management capabilities, comprehensive grade distribution analysis, automatic data saving, intelligent paragraph merging, strict data separation policy, contamination prevention, visual debugging tools, real-time total marks display, and enhanced text formatting capabilities.

## 🎉 Version 3.2.4 - Category Marking Modes & Percentage Display

This incremental release focuses on making assessment categories smarter and ensuring percentage-based color feedback stays visible:

### 🔢 **Per-Category Marking Modes**
- **Type on Creation**: Set each category to `None`, `Percentage`, or `Fixed` when you add it—no more global toggle
- **At-a-Glance Context**: The category list shows a badge for the selected type, and the paragraph form reminds you which mode is active
- **Data Integrity**: Marking mode now lives with the category object, so imports/exports keep the correct behavior

### 📊 **Percentage Value Improvements**
- **Always Shows a Range**: Color badges now display the percentage span even if you haven’t entered total marks yet
- **Calculator Integration**: The sidebar calculator remains the single source of truth for percentage ranges; ranges automatically apply to every category using the `Percentage` type
- **Clear Messaging**: Documentation and UI copy guide users to update category types instead of relying on a hidden toggle

## 🎉 Version 3.2.4 - Total Marks Display & Enhanced Text Formatting

This release introduces real-time total marks display and enhanced text formatting capabilities:

### 🎯 **NEW FEATURE: Total Marks Display**
- **Dual Location Display**: Total marks shown in both paragraphs section and Current Session sidebar
- **Real-time Updates**: Total automatically updates when category marks are changed
- **Red Color Display**: Total marks displayed in red for emphasis
- **Conditional Display**: Only appears when marks are entered (total > 0)

### 🎨 **ENHANCED FEATURE: Font Color Support**
- **Color Picker**: HTML5 color input for selecting text colors
- **Real-time Preview**: Color picker reflects current selection's color
- **Display Only**: Colors appear in app; PDF export remains plain text
- **Bootstrap Integration**: Consistent styling with existing toolbar

## 🎉 Version 3.1.0 - Major Bug Fixes Release

This release includes critical bug fixes and introduces a powerful visual debugging system:

### 🚨 **CRITICAL BUG FIXES**
- **Fixed Multiple Checkbox Ticking**: Resolved issue where clicking one checkbox caused multiple checkboxes to appear ticked
- **Duplicate ID Resolution**: Enhanced ID generation with timestamp and random components for true uniqueness
- **Data Contamination Prevention**: Strict filtering prevents paragraphs from other assessments being loaded
- **Legacy Data Migration**: Automatic migration of old paragraphs without `subjectId`/`assessmentId` properties

### 🔧 **VISUAL DEBUG PANEL**
- **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements
- **Duplicate Detection**: Automatic warnings when multiple paragraphs share same ID
- **ID Regeneration Tool**: One-click fix for duplicate ID issues
- **Tauri-Friendly**: Designed specifically for debugging in Tauri desktop app where console access is limited
- **Toggle Button**: Checkbox icon (☑️) in navbar to open/close debug panel

### 🎯 **DEBUG PANEL FEATURES**
- **Paragraph Selection Events**: Click tracking with timestamps
- **Duplicate ID Detection**: Automatic warnings for duplicate paragraph IDs
- **DOM Element Monitoring**: Detection of multiple DOM elements with same ID
- **Selection State Tracking**: Live count of selected vs total paragraphs
- **ID Regeneration**: One-click fix for existing duplicate ID issues
- **Visual Paragraph List**: Real-time display of all paragraph IDs with selection status

### 📋 **HOW TO USE DEBUG PANEL**
1. Click the checkbox icon (☑️) in the top navigation bar
2. Navigate to an assessment and try clicking checkboxes
3. Watch real-time debug messages for any issues
4. Use "Fix Duplicate IDs" button if duplicate IDs are detected
5. Use "Clear Debug Log" to reset the debug messages

## 🎉 Version 3.0.8 - Critical Data Contamination Fix

This release fixes a **critical data contamination issue** where student paragraphs from other assessments were being loaded:

### 🚨 **CRITICAL DATA CONTAMINATION FIX**
- **Fixed Cross-Assessment Data Loading**: `loadStudentParagraphs()` now filters paragraphs by current subject and assessment
- **Added Context to New Paragraphs**: `addParagraph()` now includes `subjectId` and `assessmentId` in new paragraphs
- **Strict Data Isolation**: Ensures data from other assessments cannot contaminate current assessment view
- **Requirement Compliance**: Now fully complies with Requirement 7: "Under an assessment, strictly load only the data related to that assessment"

## 🎉 Version 3.0.7 - Strict Saving Criteria and Student Photo Removal

This release implements critical fixes to prevent data contamination and removes the student photo system:

### 🔒 **CRITICAL FIXES: Data Contamination Prevention**
- **Fixed Dataset Contamination**: Implemented strict saving criteria to prevent student data from contaminating assessment files
- **Enhanced Save Validation**: Added multiple layers of validation to ensure data is saved to correct location
- **Removed Student Photo System**: Completely removed student photo functionality - only header photos for assessments
- **Strict Routing Logic**: Autosave system now strictly routes data based on student selection state

### 📋 **STRICT SAVING CRITERIA**
The application now enforces two strict saving rules:

1. **Assessment Saving Rule**: Strictly save anything to Assessment if only a student is NOT selected
2. **Student Saving Rule**: Strictly save anything to Student if only a student IS selected

### 🖼️ **Student Photo System Removal**
- **Complete Removal**: All student photo references removed from codebase
- **Header Photo Only**: Only assessment header photos are supported
- **Clean Data Structure**: No photo data in student files

## 🎉 Version 3.0.6 - Strict Data Separation Policy Implementation

This release implements three strict rules to prevent data confusion and ensure clean data management:

### 📋 **STRICT DATA SEPARATION RULES**

1. **Assignment Data Rule**: Paragraphs when no student selected are assignment data
   - Only assignment-level paragraphs are saved to assessment files
   - Student-specific information is never stored in assignment data
   - Assignment data remains clean and reusable across all students

2. **Student Data Rule**: Anything saved when student is selected are student data
   - All paragraphs, selections, and marks are saved to student-specific files
   - Student data includes merged assignment + student-specific paragraphs
   - Complete student evaluation data is preserved independently

3. **Persistent Student Data Rule**: Student data should be saved even if not selected
   - Autosave system automatically saves student data when student is selected
   - Student evaluations persist regardless of current selection state
   - Data integrity maintained across all application states

### 🔧 Technical Implementation
- **Enhanced Autosave Logic**: Dual autosave system - assignment data when no student, student data when student selected
- **Strict Save Validation**: `saveAssessmentData()` only saves when no student is selected
- **Assignment Data Purity**: Assignment files never contain student-specific information
- **Student Data Persistence**: Student evaluations saved automatically and independently

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

## Requirements Implementation Status

### ✅ **Assessment Properties** (FULLY IMPLEMENTED)
- **Header Photo**: Upload and display assessment header images
- **Total Marks**: Automatic calculation and manual override support
- **Categories**: Full CRUD operations for assessment categories
- **Knowledge Areas**: Manage knowledge areas within assessments
- **Paragraphs**: Complete paragraph management with editing and reordering
- **Section Marks**: Individual marks for each category/section

### ✅ **Student Properties** (FULLY IMPLEMENTED)
- **Selected Paragraph Data**: Track which paragraphs are selected for each student
- **Student-Specific Data**: All entered data is properly associated with selected students

### ✅ **Data Isolation** (FULLY IMPLEMENTED)
- **Assessment-Specific Loading**: Only loads data related to current assessment
- **Student-Specific Loading**: Only loads data related to selected student
- **Strict Data Separation**: Prevents cross-contamination between assessments and students

### ✅ **Student Data Merging** (FULLY IMPLEMENTED)
- **Smart Merging**: Merges identical paragraphs to avoid duplicates
- **Separate Display**: Shows different versions separately when they differ
- **Source Tracking**: Tracks whether paragraphs come from assignment or student data

### ✅ **PDF Generation** (FULLY IMPLEMENTED)
- **Selected Paragraphs Only**: Only prints paragraphs selected for the student
- **Student-Specific**: Requires student selection before PDF generation
- **Professional Formatting**: Includes student name, subject, assessment, and marks

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
