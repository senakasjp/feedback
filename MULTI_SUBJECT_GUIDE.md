# Multi-Subject Feedback Manager

> **New:** Saving a student evaluation now automatically deselects the student and resets the dropdown to 'Select a student...' to prevent accidental edits.


## Overview

The Feedback Manager has been enhanced to support multiple subjects, each containing multiple assessments. This allows for better organization of feedback data, separate PDF generation for different contexts, and comprehensive debugging tools for troubleshooting issues.

## Latest Features (v3.2.9)

### Total Marks Display System
- **Multi-Subject Support**: Total marks display works across all subjects and assessments
- **Real-time Calculation**: Total marks update instantly when category marks change
- **Dual Location Display**: Total marks shown in both sidebar and paragraphs section
- **Assessment Tracking**: Enhanced monitoring of total marks across all categories
- **Visual Emphasis**: Red color display for immediate feedback on assessment totals

### Enhanced Text Formatting
- **Rich Text Editor**: Professional text formatting with bold and color support
- **Font Color Picker**: HTML5 color input for selecting text colors
- **Export Compatibility**: HTML content converted to plain text for clipboard/PDF
- **Bootstrap Integration**: Consistent styling with existing UI components

## Previous Features (v3.1.0)

### Visual Debug Panel
- **Multi-Subject Debugging**: Debug panel works across all subjects and assessments
- **Cross-Assessment Monitoring**: Track paragraph IDs and selections across different assessments
- **Data Contamination Detection**: Automatic warnings when data from other assessments is detected
- **ID Management**: Regenerate unique IDs for paragraphs across all subjects

### Critical Bug Fixes
- **Multiple Checkbox Ticking**: Fixed issue where clicking one checkbox caused multiple checkboxes to appear ticked
- **Data Contamination Prevention**: Strict filtering prevents paragraphs from other assessments being loaded
- **Enhanced ID Generation**: Improved ID generation with timestamp and random components for true uniqueness
- **Legacy Data Migration**: Automatic migration of old paragraphs without context properties

### Debug Panel Features for Multi-Subject Use
- **Subject-Specific Debugging**: Debug panel shows current subject and assessment context
- **Cross-Contamination Detection**: Automatic warnings if paragraphs from other subjects are detected
- **ID Regeneration**: One-click fix for duplicate IDs across all subjects
- **Visual Feedback**: Real-time display of paragraph states and selections

## Previous Data Separation Features (v3.0.7)

### Critical Data Contamination Prevention
- **Fixed Dataset Contamination**: Implemented strict saving criteria to prevent student data from contaminating assessment files
- **Enhanced Save Validation**: Added multiple layers of validation to ensure data is saved to correct location
- **Strict Routing Logic**: Autosave system now strictly routes data based on student selection state

### Strict Saving Criteria Implementation
The application now enforces two strict saving rules:

1. **Assessment Saving Rule**: Strictly save anything to Assessment if only a student is NOT selected
2. **Student Saving Rule**: Strictly save anything to Student if only a student IS selected

### Student Photo System Removal
- **Complete Removal**: All student photo references removed from codebase
- **Header Photo Only**: Only assessment header photos are supported
- **Clean Data Structure**: No photo data in student files

## Previous Data Separation Features (v3.0.6)

### Strict Data Separation Policy
The application now follows three strict rules to ensure clean data management:

1. **Assignment Data Rule**: When no student is selected, all data is saved to assignment files
2. **Student Data Rule**: When a student is selected, all data is saved to student-specific files
3. **Persistent Student Data Rule**: Student data is automatically saved and persists regardless of selection state

### Enhanced Data Organization
- **Assignment-Level Storage**: Clean, reusable assignment data across all students
- **Student-Specific Storage**: Individual student modifications preserved independently
- **Automatic Data Separation**: System prevents cross-contamination between assignment and student data
- **Smart Paragraph Merging**: Identical paragraphs show only one version, different paragraphs show both with source indicators

## New Features

### 1. Hierarchical Structure
```
Subjects (Math, Science, English, etc.)
├── Assessments (Quiz 1, Midterm, Project, etc.)
    ├── Student Information
    ├── Feedback Paragraphs
    ├── Selected Paragraphs
    └── Generated PDFs
```

### 2. Navigation System
- **Subject Level**: View all subjects, create new subjects
- **Assessment Level**: View assessments within a subject, create new assessments
- **Feedback Level**: Add paragraphs, select feedback, generate PDFs

### 3. Data Storage
- **Main Data**: Subjects and assessments stored in `feedback-data.json`
- **Assessment Data**: Individual feedback data stored as `subject-{subjectId}-{assessmentId}.json`
- Each assessment maintains its own set of paragraphs and student information

### 4. PDF Generation
PDFs now include:
- Subject name
- Assessment name  
- Student name
- Header photo (full-width header)
- Selected feedback paragraphs

## How to Use

### Creating Subjects
1. Start the application
2. Click "+ Add" next to "Subjects" in the sidebar
3. Enter a subject name (e.g., "Mathematics", "Science")
4. Click "Add"

### Creating Assessments
1. Click on a subject to open it
2. Click "+ Add" next to "Assessments" in the sidebar
3. Enter an assessment name (e.g., "Quiz 1", "Midterm Exam")
4. Click "Add"

### Adding Feedback
1. Select a subject, then select an assessment
2. Add student information (name and photo)
3. Add feedback paragraphs using the text area
4. Select paragraphs to include in the report
5. Generate PDF with subject, assessment, and student context

### Navigation
- **Back to Subjects**: Returns to the main subject list
- **Back to Assessments**: Returns to the assessment list within current subject
- **Breadcrumbs**: The header shows your current location (Subject → Assessment)

## Data Migration

If you have existing feedback data from the previous version:
- The old data structure is preserved
- You'll need to create new subjects and assessments
- Copy and paste existing paragraphs into the new structure

## File Structure

```
FeedbackData/
├── feedback-data.json              # Main subjects/assessments structure
├── subject-{id1}-{id2}.json       # Individual assessment feedback data
├── subject-{id3}-{id4}.json       # Individual assessment feedback data
└── ...
```

## Benefits

1. **Organization**: Keep feedback for different subjects separate
2. **Context**: PDFs include subject and assessment information
3. **Scalability**: Add unlimited subjects and assessments
4. **Flexibility**: Each assessment can have different feedback paragraphs
5. **Data Integrity**: Assessment data is stored separately to prevent conflicts

## Technical Details

### Backend Changes
- Added `write_subject_data` and `read_subject_data` Tauri commands
- Separate file storage for each assessment
- Backward compatibility with localStorage for web development

### Frontend Changes  
- Complete UI overhaul with hierarchical navigation
- State management for current subject/assessment context
- Enhanced PDF generation with metadata
- Responsive design with improved sidebar navigation

## Example Workflow

1. **Create Subject**: "Mathematics"
2. **Create Assessments**: "Quiz 1", "Midterm", "Final Project"
3. **For Quiz 1**:
   - Add student: "John Doe" with photo
   - Add paragraphs: "Good understanding of concepts", "Needs work on problem-solving"
   - Select appropriate feedback
   - Generate PDF: "feedback-report-Mathematics-Quiz-1-John-Doe.pdf"
4. **For Midterm**:
   - Same student gets different feedback based on midterm performance
   - Generate separate PDF with midterm context

This structure allows teachers to maintain separate feedback for different assessments while keeping everything organized by subject.
