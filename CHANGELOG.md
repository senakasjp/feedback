# Changelog

## Version History

### v3.2.1 - Automatic Duplicate ID Detection & Fixing - January 2025

#### 🐛 **CRITICAL BUG FIX: Duplicate Paragraph IDs**
Fixed major issue where duplicate paragraph IDs were causing selection and printing problems:

**Problem Identified**:
- Paragraphs with identical IDs (e.g., `mfq7dqffo4h768js19` appearing twice)
- `selectedParagraphs` Set could only store unique IDs, causing selection tracking failures
- Print functions excluded paragraphs with duplicate IDs
- Debug panel clearly showed duplicate IDs in paragraph list

**Solution Implemented**:
- **Automatic Detection**: `checkForDuplicateIds()` function detects duplicate IDs during load
- **Auto-Fix System**: `regenerateParagraphIds()` automatically creates unique IDs for all paragraphs
- **Enhanced Debug Tools**: Added "Check Duplicate IDs" button to debug panel
- **Comprehensive Logging**: Enhanced console output for troubleshooting
- **Data Persistence**: Fixed IDs automatically saved to prevent future issues

**Technical Changes**:
- Added `checkForDuplicateIds()` function with detailed ID analysis
- Enhanced `regenerateParagraphIds()` with automatic saving
- Integrated duplicate checking into `loadAssessmentData()` (both Tauri and localStorage paths)
- Added `addCheckboxDebug()` function for consistent debug messaging
- Enhanced debug panel with new "Check Duplicate IDs" button

**Files Modified**:
- `src/App.svelte`: Added duplicate ID detection and fixing functions
- Enhanced debug system with comprehensive logging
- Fixed all linting errors that could affect functionality

**Impact**:
- ✅ Selections now work correctly for all paragraphs
- ✅ Print functions include all selected content
- ✅ Selection counter accurately reflects selected paragraphs
- ✅ Debug tools provide clear visibility into ID issues
- ✅ System automatically prevents future duplicate ID problems

---

### v3.2.0 - Student Selection Data Storage System - January 2025

#### 🎯 **NEW STUDENT-CENTRIC SELECTION STORAGE**
Revolutionary new approach to storing paragraph selections as student properties:

**Key Features**:
- **Student Properties Storage**: Selected paragraph data now stored as `student.selectedParagraphs[assessmentId]`
- **Assessment-Specific Selections**: Each student maintains separate selections for each assessment
- **Data Replacement Policy**: Old selection data automatically replaced on each save (no merging)
- **Backward Compatibility**: System maintains compatibility with existing evaluation files
- **Automatic Loading**: Selection data loads automatically when students are selected

**Technical Implementation**:
- Enhanced `studentsService.updateStudentSelectedParagraphs()` function
- New `studentsService.getStudentSelectedParagraphs()` function
- Modified `saveStudentEvaluation()` to save selections under student properties
- Updated `loadStudentEvaluation()` to prioritize student properties over evaluation files
- Print/save functions automatically use new student selection data

**Benefits**:
- More organized data structure with student-centric approach
- Eliminates data duplication across separate evaluation files
- Cleaner data management and easier maintenance
- Improved performance with centralized selection storage
- Seamless user experience with automatic data loading

#### 🔄 **DATA MIGRATION**
- Automatic migration ensures existing data remains accessible
- Legacy evaluation files still supported as fallback
- New students automatically get `selectedParagraphs` property
- Existing students upgraded with backward-compatible structure

#### 📊 **ENHANCED DATA STRUCTURE**
```javascript
// New Student Structure
{
  id: "student-123",
  displayName: "John Doe (12345)",
  selectedParagraphs: {
    "assessment-1": ["para-id-1", "para-id-2"],
    "assessment-2": ["para-id-3", "para-id-4"]
  }
}
```

### v3.1.0 - Major Bug Fixes Release - January 2025

#### 🚨 **CRITICAL BUG FIXES**
Fixed multiple critical issues that were affecting user experience:

**Multiple Checkbox Ticking Issue**:
- **Problem**: Clicking one checkbox caused multiple checkboxes to appear ticked
- **Root Cause**: Duplicate paragraph IDs causing multiple DOM elements with same ID
- **Solution**: Enhanced ID generation with timestamp and random components for true uniqueness
- **Impact**: Checkbox selection now works correctly with one-to-one mapping

**Data Contamination Prevention**:
- **Problem**: Paragraphs from other assessments were being loaded
- **Root Cause**: Legacy paragraphs without `subjectId`/`assessmentId` properties
- **Solution**: Strict filtering and automatic migration of legacy data
- **Impact**: Clean data separation between assessments

#### 🔧 **VISUAL DEBUG PANEL**
Introduced a comprehensive visual debugging system for Tauri applications:

**Features**:
- **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements
- **Duplicate Detection**: Automatic warnings when multiple paragraphs share same ID
- **ID Regeneration Tool**: One-click fix for duplicate ID issues
- **Tauri-Friendly**: Designed specifically for debugging where console access is limited
- **Toggle Button**: Checkbox icon (☑️) in navbar to open/close debug panel

**Debug Panel Components**:
1. **State Variables**: `showCheckboxDebug` and `checkboxDebugInfo`
2. **Debug Message Function**: `addCheckboxDebug()` with timestamp and message limit
3. **Toggle Button**: Navbar button to show/hide debug panel
4. **Debug Panel UI**: Comprehensive panel with real-time monitoring
5. **ID Regeneration Function**: `regenerateParagraphIds()` to fix duplicate IDs
6. **Debug Calls**: Integrated into checkbox click handlers

**Usage Instructions**:
1. Click checkbox icon (☑️) in top navigation bar
2. Navigate to assessment and click checkboxes
3. Watch real-time debug messages for issues
4. Use "Fix Duplicate IDs" button if duplicates detected
5. Use "Clear Debug Log" to reset messages

#### 📋 **TECHNICAL IMPROVEMENTS**
- **Enhanced ID Generation**: `generateId()` function now includes timestamp and random components
- **Legacy Data Migration**: Automatic migration of old paragraphs without context properties
- **Strict Data Filtering**: Prevents cross-contamination between assessments
- **Visual Feedback**: Real-time monitoring of paragraph states and selections

#### 🎯 **USER EXPERIENCE ENHANCEMENTS**
- **Reliable Checkbox Selection**: One-click selection works correctly
- **Visual Debugging**: Easy-to-use debug panel for troubleshooting
- **Data Integrity**: Clean separation of data between assessments
- **Error Prevention**: Automatic detection and fixing of duplicate IDs

### v3.0.8 - Critical Data Contamination Fix - January 2025

#### 🚨 **CRITICAL DATA CONTAMINATION FIX**
Fixed a serious data contamination issue where student paragraphs from other assessments were being loaded:

**Problem Identified**:
- `loadStudentParagraphs()` was loading ALL student paragraphs from ALL assessments
- `addParagraph()` was not adding `subjectId` and `assessmentId` to new paragraphs
- This violated Requirement 7: "Under an assessment, strictly load only the data related to that assessment"

**Fixes Applied**:
1. **Strict Data Filtering**: Updated `loadStudentParagraphs()` to filter paragraphs by `currentSubjectId` and `currentAssessmentId`
2. **Context Addition**: Updated `addParagraph()` to include `subjectId` and `assessmentId` in new paragraphs
3. **Data Isolation**: Ensured strict data separation between assessments

**Code Changes**:
```javascript
// Before (CONTAMINATED):
const studentParagraphs = studentData.paragraphs || []
paragraphs = ensureParagraphsHaveIds(studentParagraphs)

// After (ISOLATED):
const filteredParagraphs = allStudentParagraphs.filter(para => 
  para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
)
paragraphs = ensureParagraphsHaveIds(filteredParagraphs)
```

#### ✅ **REQUIREMENTS IMPLEMENTATION STATUS**
All system requirements have been fully implemented and verified:

1. **Assessment Properties** ✅ **FULLY IMPLEMENTED**
   - Header photo: Upload and display assessment header images
   - Total marks: Automatic calculation and manual override support
   - Categories: Full CRUD operations for assessment categories
   - Knowledge areas: Manage knowledge areas within assessments
   - Paragraphs: Complete paragraph management with editing and reordering
   - Section marks: Individual marks for each category/section

2. **Student Properties** ✅ **FULLY IMPLEMENTED**
   - Selected paragraph data: Track which paragraphs are selected for each student
   - Student-specific data: All entered data properly associated with selected students

3. **Data Isolation** ✅ **FULLY IMPLEMENTED**
   - Assessment-specific loading: Only loads data related to current assessment
   - Student-specific loading: Only loads data related to selected student
   - Strict data separation: Prevents cross-contamination between assessments and students

4. **Student Data Merging** ✅ **FULLY IMPLEMENTED**
   - Smart merging: Merges identical paragraphs to avoid duplicates
   - Separate display: Shows different versions separately when they differ
   - Source tracking: Tracks whether paragraphs come from assignment or student data

5. **PDF Generation** ✅ **FULLY IMPLEMENTED**
   - Selected paragraphs only: Only prints paragraphs selected for the student
   - Student-specific: Requires student selection before PDF generation
   - Professional formatting: Includes student name, subject, assessment, and marks

#### 📚 **DOCUMENTATION UPDATES**
- Updated README.md with requirements implementation status
- Updated FEATURE_SUMMARY.md with detailed implementation details
- Verified all requirements are met in current codebase

### v3.0.7 - Strict Saving Criteria and Student Photo Removal - January 2025

#### 🔒 **CRITICAL FIXES: Data Contamination Prevention**
- **Fixed Dataset Contamination**: Implemented strict saving criteria to prevent student data from contaminating assessment files
- **Enhanced Save Validation**: Added multiple layers of validation to ensure data is saved to correct location
- **Removed Student Photo System**: Completely removed student photo functionality - only header photos for assessments
- **Strict Routing Logic**: Autosave system now strictly routes data based on student selection state

#### 📋 **STRICT SAVING CRITERIA IMPLEMENTED**
The application now enforces two strict saving rules:

1. **Assessment Saving Rule**: Strictly save anything to Assessment if only a student is NOT selected
   - Enhanced `saveAssessmentData()` with strict validation
   - Returns early if student is selected
   - Assignment files remain completely clean
   - Console logging for verification

2. **Student Saving Rule**: Strictly save anything to Student if only a student IS selected
   - Enhanced `saveStudentEvaluation()` with strict validation
   - Returns early if no student is selected
   - Student files contain only student-specific data
   - Console logging for verification

#### 🖼️ **Student Photo System Removal**
- **Complete Removal**: All `studentImage` references removed from codebase
- **Header Photo Only**: Only assessment header photos are supported
- **Clean Data Structure**: No photo data in student files
- **Simplified UI**: Removed student photo upload functionality

#### 🐛 Critical Bug Fixes
- **Fixed Identical Paragraph Merging**: Resolved issue where identical assignment and student paragraphs were being displayed as separate versions
- **Enhanced Text Normalization**: Improved paragraph comparison to handle whitespace and line ending differences
- **Optimized Merging Logic**: Identical paragraphs now show only one version instead of duplicates

### v3.0.6 - Strict Data Separation Policy Implementation - January 2025

#### 📋 **STRICT DATA SEPARATION RULES**
The application now follows three strict rules to prevent data confusion:

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

#### 🔧 Technical Implementation
- **Enhanced Autosave Logic**: Dual autosave system - assignment data when no student, student data when student selected
- **Strict Save Validation**: `saveAssessmentData()` only saves when no student is selected
- **Assignment Data Purity**: Assignment files never contain student-specific information
- **Student Data Persistence**: Student evaluations saved automatically and independently
- **Data Contamination Prevention**: Multiple validation layers prevent cross-contamination

#### 🎯 User Experience Enhancements
- **Clear Data Boundaries**: No confusion between assignment and student data
- **Reliable Data Persistence**: Student work is always saved, regardless of selection state
- **Clean Assignment Views**: Assignment data remains pure and reusable
- **Consistent Behavior**: Predictable data flow across all application states

### v3.0.5 - Complete Data Separation and Contamination Prevention - January 2025

#### 🐛 Critical Bug Fixes
- **Fixed Merged Paragraph Display**: Resolved issue where both assignment and student versions of paragraphs were being displayed when no student was selected
- **Prevented Assessment Data Contamination**: Fixed autosave system that was saving merged paragraphs to assessment files
- **Added Paragraph Filtering**: Implemented strict filtering to remove student paragraphs from assignment-only views
- **Enhanced Data Separation**: Complete separation between assignment and student data in all storage operations

#### 🔧 Technical Improvements
- **Enhanced Autosave Logic**: Modified autosave to only save assessment data when no student is selected
- **Strict Save Validation**: Added validation in `saveAssessmentData()` to prevent saving when student is selected
- **Paragraph Source Filtering**: Added filtering logic to remove paragraphs with `_source: 'student'` or IDs ending with `_student`
- **Data Contamination Prevention**: Implemented multiple layers of protection against cross-contamination

#### 🎯 User Experience Enhancements
- **Clean Assignment View**: Selecting an assessment without a student now shows only assignment paragraphs
- **Proper Data Isolation**: No more mixed assignment/student paragraphs when viewing assignment-only data
- **Reliable State Management**: Consistent behavior across all data loading and saving operations
- **Backward Compatibility**: Existing contaminated data is automatically cleaned when loaded

### v3.0.4 - Assessment Data Contamination Fix - January 2025

#### 🐛 Critical Bug Fixes
- **Fixed Assessment Data Contamination**: Resolved issue where student data was being loaded when selecting an assessment without selecting a student
- **Strict Data Separation**: Assessment data files now properly separate assignment-level data from student-specific data
- **Clean Assessment Loading**: When no student is selected, assessment data loading now ensures student-specific fields are cleared

#### 🔧 Technical Improvements
- **Enhanced `loadAssessmentData()` Function**: Added strict filtering to only load student data when a student is currently selected
- **Improved `saveAssessmentData()` Function**: Modified to prevent saving student data when no student is selected
- **Data Integrity Protection**: Prevents cross-contamination between assignment and student data in storage files
- **Consistent Behavior**: Both Tauri and localStorage implementations now follow the same strict filtering rules

#### 🎯 User Experience Enhancements
- **Clean Assignment View**: Selecting an assessment without a student now shows only assignment paragraphs and data
- **Proper Data Isolation**: Student-specific information no longer appears when viewing assignment-only data
- **Reliable State Management**: Assessment selection now properly resets to clean state without student data interference

### v3.0.3 - Index-Based Paragraph Merging and Knowledge Area Improvements - January 2025

#### 🚀 Major New Features
- **Index-Based Paragraph Merging**: Advanced paragraph comparison system that detects differences between assignment and student paragraphs at the same index position
- **Dual Version Display**: When paragraphs differ between assignment and student, both versions are displayed with clear visual indicators
- **Assignment-Specific Knowledge Areas**: Knowledge areas are now stored as assignment properties instead of global entities
- **Enhanced Save Functionality**: Added dedicated "Save Assignment" button in the right panel for manual assignment data saving

#### 🎨 User Interface Improvements
- **Source Indicators**: Clear visual badges distinguish between "Assignment" (blue) and "Student" (green) paragraph versions
- **Knowledge Area Persistence**: Knowledge area selection now remains intact when adding paragraphs (consistent with category behavior)
- **Enhanced Right Panel**: Save Assignment button positioned logically under the print button in the sidebar
- **Improved Visual Feedback**: Professional badge system with icons for easy identification of paragraph sources

#### 🔧 Technical Improvements
- **Advanced Merge Algorithm**: New `mergeParagraphs()` function handles index-based comparison with intelligent duplicate detection
- **Assignment Property Architecture**: Knowledge areas moved from global storage to assignment-specific properties for better data organization
- **Enhanced Data Loading**: Fixed `loadStudentEvaluation()` to properly load and merge student paragraphs with assignment paragraphs
- **Selection Mapping**: Improved `mapSelectionsToMergedParagraphs()` for reliable selection tracking across merged paragraph arrays
- **ID Conflict Prevention**: Student paragraph versions get modified IDs to prevent conflicts with assignment versions

#### 🎯 User Experience Enhancements
- **Clear Version Distinction**: Users can easily identify which version of a paragraph they're viewing
- **Consistent Selection Behavior**: Both assignment and student versions can be selected independently
- **Proper Categorization**: Both versions are correctly categorized under their respective categories and knowledge areas
- **Assignment-Specific Organization**: Each assignment can have its own set of knowledge areas, improving data organization

#### 🛡️ Data Integrity Improvements
- **Assignment-Only Display**: System ensures only paragraphs from the current assignment are displayed (no cross-contamination)
- **Strict Validation**: Multiple validation checks prevent loading data from incorrect assessments
- **Backward Compatibility**: Existing data automatically migrates to new knowledge area storage system
- **Enhanced Error Handling**: Better error handling and logging for debugging paragraph loading issues

### v3.0.2 - Autosave and UI Improvements - January 2025

#### 🚀 Major New Features
- **Automatic Data Saving**: Comprehensive autosave system that automatically saves data every 2 seconds after changes
- **Visual Save Status**: Real-time save status indicator in the navbar showing "Saving...", "Saved", or "Ready"
- **Smart Debouncing**: Prevents excessive save operations by waiting 2 seconds after the last change before saving

#### 🎨 User Interface Improvements
- **Cleaner Paragraph Display**: Removed paragraph numbers (e.g., "#0") from checkboxes for cleaner, less cluttered interface
- **Enhanced Visual Feedback**: Spinning animation during save operations with professional status indicators
- **Improved User Experience**: Users no longer need to manually save data - everything is preserved automatically

#### 🔧 Technical Improvements
- **Reactive Autosave System**: Uses Svelte's `$effect()` to watch for data changes and trigger automatic saves
- **Debounced Save Operations**: Intelligent debouncing prevents excessive file I/O operations
- **Multiple Data Types**: Autosave works for assessment data, subject/student data, and all user interactions
- **Error Handling**: Graceful handling of save failures with console logging
- **Status Tracking**: Real-time tracking of save state with visual feedback

#### 🎯 User Experience Enhancements
- **Seamless Workflow**: Users can focus on content creation without worrying about saving
- **Real-time Feedback**: Always know when your work is being saved with visual status indicators
- **Reduced Cognitive Load**: No need to remember to save manually - the system handles it automatically
- **Professional Interface**: Clean, uncluttered paragraph display without distracting numbers

#### 🛡️ Data Integrity Improvements
- **Continuous Backup**: Data is continuously saved, reducing risk of data loss
- **Automatic Persistence**: All changes are automatically persisted without user intervention
- **Reliable State Management**: Enhanced state management ensures data consistency
- **Cross-Platform Compatibility**: Works reliably in both Tauri desktop and browser environments

### v3.0.1 - Bug Fix Release - January 2025

#### 🐛 Critical Bug Fixes
- **Fixed Paragraph Selection Issue**: Resolved critical bug where paragraph checkboxes stopped working when students with saved data were selected
- **Deterministic ID Generation**: Implemented deterministic paragraph ID generation based on content and position to ensure consistent IDs across sessions
- **Saved Selection Validation**: Added validation system to filter out invalid saved selections that don't match current paragraph IDs
- **Enhanced Data Integrity**: Improved paragraph selection system to handle ID mismatches gracefully

#### 🔧 Technical Improvements
- **ID-Based Selection System**: Enhanced paragraph selection to use deterministic IDs instead of random generation
- **Selection Validation Logic**: Added validation in `loadStudentEvaluation()` to ensure saved selections match current paragraph IDs
- **Backward Compatibility**: Maintained compatibility with existing saved data while fixing ID mismatches
- **Error Prevention**: Implemented safeguards to prevent selection system failures

#### 🎯 User Experience Fixes
- **Consistent Checkbox Behavior**: Paragraph checkboxes now work reliably for all students regardless of saved data status
- **Selection Count Updates**: Fixed issue where selection count wouldn't update when students with saved data were selected
- **Selected Paragraphs Panel**: Restored functionality of the "Selected Paragraphs" panel for all student types
- **Reliable Selection State**: Ensured selection state remains consistent across student selection changes

### v3.0.0 - Major Release - January 2025

#### 🎉 Major New Features
- **Comprehensive Grade Distribution Analysis**: Complete grade tracking system with professional UI table and PDF synchronization
- **Enhanced Performance Analysis**: Improved categorization logic with proper lowest performer detection and side-by-side card layout
- **Professional PDF Reports**: Synchronized PDF grade distribution with Range column matching UI table exactly
- **Advanced Student Management**: Bootstrap 5 confirmation modals with comprehensive file cleanup and loading states

#### 📊 Grade Distribution System
- **Complete Grade Overview**: Shows all letter grades (A+ through E) even with zero students
- **Professional UI Table**: Bootstrap 5 table with Grade, Count, Percentage, and Range columns
- **Real-time Updates**: Automatic updates when student marks change
- **PDF Synchronization**: Perfect consistency between UI and PDF grade distribution tables
- **Grade Range Mapping**: Comprehensive percentage range display for each grade level

#### 🎯 Performance Analysis Enhancements
- **Fixed Categorization Logic**: Properly identifies lowest performers (students with same lowest marks grouped together)
- **Same Marks Grouping**: Students with identical performance are grouped in appropriate categories
- **Responsive Card Layout**: Side-by-side display using Bootstrap grid system (3/2/1 cards per row based on screen size)
- **Complete Performance View**: All three categories (Highest, Medium, Needs Support) now properly displayed
- **Enhanced Performance Cards**: Individual assessment performance cards with improved categorization

#### 📄 PDF Report Improvements
- **Range Column Addition**: PDF grade distribution now includes Range column matching UI table
- **Perfect UI-PDF Consistency**: Identical data structure and formatting between UI and PDF reports
- **Enhanced Table Layout**: Improved column spacing and professional academic formatting
- **Grade Range Display**: Shows percentage ranges (e.g., "90-100%", "85-89%") for each grade

#### 🔧 Technical Improvements
- **Grade Distribution Engine**: Complete grade tracking system with range mapping and percentage calculations
- **Performance Categorization Algorithm**: Improved logic for identifying highest, medium, and lowest performers
- **Responsive Design System**: Bootstrap grid implementation for optimal card layout across screen sizes
- **PDF-UI Synchronization**: Ensured perfect consistency between PDF reports and UI tables
- **Enhanced Error Handling**: Better handling of edge cases in performance categorization

#### 🎨 User Experience Enhancements
- **Professional Academic Layout**: Clean, academic-style grade distribution table suitable for reporting
- **Visual Analytics**: Side-by-side performance cards with professional design and proper spacing
- **Comprehensive Data View**: Complete grade overview with all performance levels visible
- **Easy Analysis**: Quick identification of grade distribution patterns and performance trends
- **Responsive Design**: Optimal viewing experience across all device sizes

#### 🛡️ Student Management Improvements
- **Bootstrap 5 Confirmation Modal**: Professional confirmation dialog with detailed information and warning icons
- **Enhanced Loading States**: Visual feedback during deletion process with spinner animations
- **Comprehensive File Cleanup**: Complete removal of all student-related files and data
- **Safety Features**: Multiple confirmation steps prevent accidental deletions
- **Cross-Platform Support**: Works in both Tauri desktop and browser environments

### v2.6.0 - Previous Version

#### New Features
- **Unique ID-Based Paragraph Management**: Robust paragraph selection system using unique IDs instead of array indices
- **Data Migration System**: Automatic migration of existing paragraphs to include unique IDs for backward compatibility
- **Enhanced Paragraph Tracking**: Reliable paragraph selection and editing using unique identifiers
- **Improved Data Integrity**: Better handling of paragraph operations with ID-based tracking
- **Subject-Specific Student Management**: Ability to remove students from specific subjects while preserving global student records
- **Professional Delete Confirmations**: Bootstrap modal-based warning system for destructive actions
- **Enhanced PDF Marks Display**: PDF reports now show marks in `[actual/allocated Marks]` format for better clarity
- **Allocated Marks Integration**: Categories can now have allocated marks that appear in PDF output alongside actual marks
- **Advanced PDF Report Generation**: Professional PDF reports with multi-page support, dynamic headers, and comprehensive formatting
- **Performance Highlights Cards**: Individual assessment performance cards showing highest, medium, and needs support students
- **Smart Performance Analysis**: Intelligent grouping of students with same marks and median-based performance categorization
- **Notification System**: Bootstrap toast notifications for user feedback on PDF generation and CSV export operations
- **Enhanced Student Deletion System**: Complete data cleanup with comprehensive file removal and user feedback
- **Bootstrap 5 Confirmation Modal**: Professional confirmation dialog for student deletion with detailed information and loading states
- **Enhanced Performance Highlights**: Fixed categorization logic to properly show lowest performers and improved side-by-side card layout
- **Comprehensive Grade Distribution Table**: UI table showing all grades (A+ through E) with counts, percentages, and ranges
- **Synchronized PDF Reports**: PDF grade distribution now matches UI table exactly with Range column included

#### Technical Improvements
- **ID Generation**: New `generateId()` function for creating unique string identifiers
- **Data Migration**: New `ensureParagraphsHaveIds()` function to migrate existing data
- **ID-Based Selection**: Updated `toggleParagraph()` to use unique IDs instead of array indices
- **Enhanced Merging**: Improved `mergeParagraphs()` with ID-based duplicate detection
- **Smart Mapping**: Updated `mapSelectionsToMergedParagraphs()` for ID-based selection mapping
- **UI Updates**: Modified paragraph rendering to use ID-based selection state
- **Student Deletion Functions**: New `deleteStudentFromSubject()`, `confirmStudentDelete()`, and `cancelStudentDelete()` functions
- **Modal State Management**: Added `showStudentDeleteConfirm` and `studentToDelete` state variables
- **Enhanced Warning System**: Professional Bootstrap modal confirmations with comprehensive information
- **PDF Generation Enhancement**: Updated `generateRestOfPDF()` function to display allocated marks alongside actual marks
- **Category Marks Display**: Enhanced PDF output to show `[15/30 Marks]` format for better academic reporting
- **Advanced PDF Engine**: Complete PDF generation system using jsPDF with dynamic layouts, word wrapping, and multi-page support
- **Performance Analysis Engine**: New `getAssessmentPerformanceHighlights()` function for individual assessment performance analysis
- **Smart Categorization**: Median-based performance grouping with same-marks handling for accurate student categorization
- **Notification Infrastructure**: Bootstrap toast system with success/error feedback for user operations
- **Modular CSV Export**: Extracted CSV generation into reusable utility functions with proper error handling
- **Tauri Backend Commands**: New commands for comprehensive student file cleanup
  - `delete_student_evaluation`: Delete specific student evaluation files
  - `delete_student_paragraphs`: Delete student paragraph collections  
  - `delete_all_student_files`: Comprehensive cleanup of all student-related files
- **Professional UI Components**: Bootstrap 5 confirmation modals with detailed information display
- **Enhanced User Experience**: Loading states, visual feedback, and comprehensive warning systems
- **Dynamic Layout System**: Column-based PDF layout with precise width calculations and responsive text wrapping
- **Multi-page PDF Support**: Automatic page breaks with header repetition and content flow management
- **Performance Categorization Logic**: Improved algorithm for identifying highest, medium, and lowest performers
- **Responsive Card Layout**: Bootstrap grid system for optimal performance card display across screen sizes
- **Grade Distribution Engine**: Complete grade tracking system with range mapping and percentage calculations
- **PDF-UI Synchronization**: Ensured perfect consistency between PDF reports and UI tables

#### Data Architecture Changes
- **Paragraph Objects**: All paragraphs now include a unique `id` field
- **Selection Tracking**: `selectedParagraphs` now stores unique IDs instead of indices
- **Backward Compatibility**: Automatic migration ensures existing data works with new system
- **Data Integrity**: More reliable paragraph operations across editing and merging

#### PDF Report System Enhancements
- **Professional Layout**: Clean, academic-style PDF reports with proper typography and spacing
- **Dynamic Header System**: Word-wrapping headers with calculated heights and proper background shading
- **Multi-page Support**: Automatic page breaks with header repetition for long student lists
- **Column-based Layout**: Precise column width calculations with responsive text wrapping
- **Grade Distribution Summary**: Comprehensive grade analysis table with percentage breakdowns
- **Font Consistency**: Matching typography with feedback reports using Helvetica fonts
- **Compact Design**: Optimized spacing and font sizes for maximum information density
- **Student Name Truncation**: Smart truncation of long names to maintain layout integrity
- **Header Shading**: Light gray backgrounds for headers and table sections
- **Responsive Tables**: Dynamic table sizing with proper content alignment

#### Performance Analysis System
- **Individual Assessment Cards**: Dedicated performance cards for each assessment
- **Smart Categorization**: Three-tier performance system (Highest, Medium, Needs Support)
- **Same Marks Grouping**: Multiple students with identical marks displayed together
- **Median-based Analysis**: Middle marks calculation using median percentage for balanced categorization
- **Visual Performance Indicators**: Color-coded badges and icons for quick performance recognition
- **Horizontal Card Layout**: Responsive grid layout with consistent card sizing
- **Assessment-specific Data**: Performance analysis calculated per assessment, not overall
- **Dynamic Labels**: Automatic pluralization of category names based on student count
- **Comprehensive Coverage**: All students with marks are categorized appropriately

### v2.5.0 - Previous Version

#### New Features
- **Dual Storage System**: Sophisticated paragraph management with assignment-level and student-level storage
- **Assignment-Level Storage**: Paragraphs stored per assessment with clean slate loading (no selections, zero marks)
- **Student-Level Storage**: Comprehensive paragraph collection across all assignments for complete student history
- **Smart Paragraph Management**: Add to both assignment and student storage; delete from assignment only (preserve student history)
- **Student Data Loading**: Load all student paragraphs plus assignment-specific marks and selections
- **Paragraph Editing**: Inline editing of paragraph text with preservation of category and knowledge area prefixes
- **Smart Text Extraction**: Automatic extraction of main text content for editing while preserving structural information
- **Selection Index Mapping**: Intelligent mapping of saved selections to merged paragraph arrays using text-based matching
- **Subject-Level Paragraph Database**: Centralized paragraph storage per subject (not assessment-level)
- **Dual Paragraph Display**: Subject paragraphs + student-specific selections and deleted paragraphs
- **Deleted Paragraph Persistence**: Visual indicators for removed content, stored in student data
- **Navigation Sidebar Toggle**: Calculator/navigation view switching with color-coded percentage ranges
- **Sticky Sidebar**: Full sidebar card sticky to viewport top with proper content scrolling
- **Bootstrap 5 "sm" Theme**: Complete UI framework integration with fs-6 font sizes
- **Assessment Weighting**: Percentage-based assessment weights
- **Student Management**: Comprehensive student database system with photo upload
- **PDF Generation**: Professional report generation with images + automatic student data save
- **CSV Export**: Student marks table export functionality
- **Auto-Save on PDF**: Student data automatically saved when generating PDF reports
- **Font Consistency**: Non-bold fonts for subject/assessment names in navigation
- **Color-Restricted Calculator**: Only green, light green, yellow, orange, red colors allowed

#### Technical Improvements
- **Tauri Backend Commands**: New commands for student paragraph storage
  - `write_student_paragraphs`: Save student-specific paragraph collections
  - `read_student_paragraphs`: Load student-specific paragraph collections
- **Enhanced Data Flow**: Improved paragraph management with dual storage
- **Paragraph Editing Functions**: New helper functions for text extraction and reconstruction
  - `extractMainTextFromParagraph`: Extracts main text while preserving prefixes/suffixes
  - `reconstructParagraphText`: Rebuilds full paragraph text with original structure
  - `mapSelectionsToMergedParagraphs`: Maps saved selections to merged paragraph indices
- **Smart Merging Logic**: Intelligent paragraph merging with duplicate prevention
- **Memory Optimization**: Better handling of large datasets
- **Error Handling**: Improved fallback mechanisms for data loading
- **Performance**: Optimized state updates and data persistence

#### Data Architecture Changes
- **File Structure**: New storage pattern for student paragraphs
  ```
  FeedbackData/
  ├── feedback-data.json                    # Main configuration
  ├── subject-{subjectId}-{assessmentId}.json   # Assignment-specific data
  ├── student-paragraphs-{studentId}.json   # Student paragraph collections
  └── student-evaluation-{studentId}-{assessmentId}.json  # Student evaluation data
  ```
- **Data Consistency**: Clear rules for paragraph addition, deletion, and loading
- **Backup and Recovery**: Improved data persistence and portability

#### User Experience Improvements
- **Clean Slate Loading**: Assignment selection loads all paragraphs with no selections and zero marks
- **Complete Student History**: Student selection shows all paragraphs from all assignments
- **Inline Paragraph Editing**: Direct editing of paragraph text with intuitive save/cancel controls
- **Preserved Structure**: Category and knowledge area prefixes automatically maintained during editing
- **Smart Selection Mapping**: Previously selected paragraphs remain selected after merging assignment and student data
- **Intuitive Navigation**: Clear separation between assignment and student data
- **Professional PDFs**: Enhanced PDF generation with header photos and proper formatting
- **Responsive Design**: Better mobile and desktop experience

### Key Architectural Decisions

1. **File-based Storage**: JSON files for portability and simplicity
2. **Component-based Architecture**: Modular Svelte components
3. **Reactive State Management**: Svelte 5 `$state` and `$derived`
4. **Cross-platform Desktop**: Tauri for native performance
5. **Bootstrap 5 UI**: Consistent, responsive interface design
6. **Dual Storage System**: Separation of assignment and student data for better management

## Critical Data Flow Patterns

### Paragraph Management Flow
1. **Paragraph Creation**: Added to subject-level database (`subject-paragraphs-{subjectId}.json`)
2. **Student Selection**: Loads subject paragraphs + student-specific data (selections, deleted, marks)
3. **Paragraph Deletion**: Removed from subject database + moved to student's deleted list
4. **PDF Generation**: Automatically saves all current student data

### Auto-Save Behavior
- **Manual Save**: "Save Student Data" button saves current state
- **Auto-Save on PDF**: PDF generation automatically saves complete student data
- **No Auto-Save**: Regular paragraph operations don't auto-save (manual or PDF trigger required)

### Data Loading Priority
1. **Subject Selection**: Loads subject paragraphs from `subject-paragraphs-{subjectId}.json`
2. **Assessment Selection**: Loads subject paragraphs + assessment context
3. **Student Selection**: Loads subject paragraphs + student-specific data
4. **Fallback Logic**: If subject paragraphs don't exist, tries legacy `subject-{subjectId}-{assessmentId}.json`

### Bootstrap 5 "sm" Theme Compliance
- **Font Sizes**: `fs-6` (16px) for paragraphs, consistent with Bootstrap 5 "sm" theme
- **Non-Bold Navigation**: Subject and assessment names use `fw-normal` class
- **Color Restrictions**: Percentage calculator limited to 5 specific colors
- **Sticky Positioning**: Full sidebar card sticky with proper content scrolling

## Breaking Changes

### Data Storage Migration
- **Legacy Support**: Old data format still supported with fallback logic
- **New File Structure**: Student paragraphs now stored separately
- **Migration Path**: Automatic detection and loading of legacy data

### API Changes
- **New Tauri Commands**: Added student paragraph storage commands
- **Enhanced Data Structures**: Improved data models for better organization
- **Backward Compatibility**: Maintained compatibility with existing data

## Known Issues

### Current Limitations
1. **Large Datasets**: Performance may degrade with very large student lists (>1000 students)
2. **Image Size**: Very large header photos may cause memory issues
3. **Cross-Platform**: Some platform-specific features may vary

### Planned Improvements
1. **Pagination**: Implement pagination for large student lists
2. **Image Optimization**: Automatic image compression and resizing
3. **Data Migration**: Improved migration tools for legacy data
4. **Performance**: Further optimization for large datasets

## Migration Guide

### From Previous Versions
1. **Backup Data**: Always backup your `FeedbackData` folder before upgrading
2. **Automatic Migration**: The application will automatically detect and migrate legacy data
3. **Verification**: Check that all data is loaded correctly after migration
4. **New Features**: Take advantage of the new dual storage system

### Data Verification
1. **Check Subjects**: Verify all subjects are loaded
2. **Check Assessments**: Ensure all assessments are present
3. **Check Students**: Verify student data is intact
4. **Test PDF Generation**: Ensure PDF generation works correctly

## Development Notes

### Code Quality
- **TypeScript**: Improved type safety with better type definitions
- **Error Handling**: Enhanced error handling throughout the application
- **Code Organization**: Better separation of concerns and modular design
- **Documentation**: Comprehensive documentation for all new features

### Testing
- **Unit Tests**: Improved test coverage for new functionality
- **Integration Tests**: Better testing of data flow and storage
- **Manual Testing**: Comprehensive manual testing across platforms
- **Performance Testing**: Testing with large datasets

### Future Roadmap
1. **v2.6.0**: Performance improvements and pagination
2. **v2.7.0**: Enhanced PDF customization options
3. **v2.8.0**: Advanced reporting and analytics
4. **v3.0.0**: Major UI/UX overhaul with modern design patterns

## Support and Maintenance

### Bug Reports
- Report issues through the development team
- Include detailed steps to reproduce
- Provide system information and error logs

### Feature Requests
- Submit feature requests through the development team
- Include use cases and expected behavior
- Consider impact on existing functionality

### Documentation
- Keep documentation updated with code changes
- Include examples for new features
- Maintain backward compatibility information
