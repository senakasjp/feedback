# Changelog

## Version History

### v2.6.0 - Current Version

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
- **Dynamic Layout System**: Column-based PDF layout with precise width calculations and responsive text wrapping
- **Multi-page PDF Support**: Automatic page breaks with header repetition and content flow management

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
- **Professional PDFs**: Enhanced PDF generation with student photos and proper formatting
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
2. **Image Size**: Very large student photos may cause memory issues
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
