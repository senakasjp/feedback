# Multi-Subject Feedback Manager

## Overview

The Feedback Manager has been enhanced to support multiple subjects, each containing multiple assessments. This allows for better organization of feedback data and separate PDF generation for different contexts.

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
