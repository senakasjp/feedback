# Architecture Documentation

## Overview

The Feedback Manager implements a sophisticated dual storage system that separates assignment-level paragraph storage from student-specific paragraph collections, enabling comprehensive feedback management across multiple assignments while maintaining data integrity.

## Application Structure

```
Subject (1 or more)
├── Assessment (0 or more)
    ├── Category (0 or more)
        └── Paragraph (0 or more)
```

## Core Components

- **App.svelte**: Main application orchestrator
- **Sidebar.svelte**: Navigation and percentage calculator
- **SubjectManager.svelte**: Subject management interface
- **AssessmentManager.svelte**: Assessment and grading interface
- **FeedbackEditor.svelte**: Paragraph creation and editing
- **SelectedTextSection.svelte**: PDF generation and text export

## Dual Storage System for Paragraphs and Student Data

### Storage Architecture

#### 1. Assignment-Level Storage
**Purpose**: Stores paragraphs specific to each assessment within a subject.

**File Structure**:
```
FeedbackData/
├── subject-{subjectId}-{assessmentId}.json  # Assignment-specific paragraphs
```

**Data Structure**:
```json
{
  "paragraphs": [
    {
      "text": "Student demonstrates excellent understanding of design principles.",
      "color": "green"
    }
  ],
  "selectedParagraphs": [],
  "studentName": "",
  "studentImage": "",
  "categoryMarks": {},
  "manualTotalMarks": ""
}
```

#### 2. Student-Level Storage
**Purpose**: Maintains a comprehensive collection of all paragraphs associated with a student across all assignments.

**File Structure**:
```
FeedbackData/
├── student-paragraphs-{studentId}.json  # Student's complete paragraph collection
```

**Data Structure**:
```json
{
  "studentId": "student-123",
  "paragraphs": [
    {
      "text": "Student demonstrates excellent understanding of design principles.",
      "color": "green"
    },
    {
      "text": "Areas for improvement include technical implementation.",
      "color": "orange"
    }
  ],
  "savedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 3. Student Evaluation Storage
**Purpose**: Stores student-specific evaluation data including marks, selections, and metadata for specific assignments.

**File Structure**:
```
FeedbackData/
├── student-evaluation-{studentId}-{assessmentId}.json  # Student evaluation data
```

**Data Structure**:
```json
{
  "studentId": "student-123",
  "assessmentId": "assessment-456",
  "paragraphs": [],
  "selectedParagraphs": [0, 1],
  "studentName": "John Doe (12345)",
  "studentImage": "data:image/jpeg;base64...",
  "categoryMarks": {
    "Strengths": "10",
    "Areas for Improvement": "15"
  },
  "manualTotalMarks": "25",
  "savedAt": "2024-01-01T00:00:00.000Z"
}
```

### Data Flow Logic

#### 1. Adding Paragraphs
When a new paragraph is added:

```javascript
function addParagraph() {
  if (newParagraph.trim()) {
    // Process paragraph text with prefixes
    let paragraphText = newParagraph.trim()
    
    if (needsCategorySelection() && selectedCategory) {
      paragraphText = `${selectedCategory}: ${paragraphText}`
    }
    
    if (selectedKnowledgeArea) {
      paragraphText = `${paragraphText} - ${selectedKnowledgeArea}`
    }
    
    // Add to current paragraphs array
    paragraphs.push({
      text: paragraphText,
      color: selectedColor || undefined
    })
    
    // Save to BOTH assignment and student storage
    saveAssessmentData()  // Saves to assignment-level storage
    if (currentStudentId) {
      saveStudentParagraphs()  // Saves to student-level storage
    }
  }
}
```

**Key Behavior**:
- Paragraph is added to the current `paragraphs` array
- Saved to assignment-specific file (`subject-{subjectId}-{assessmentId}.json`)
- If a student is selected, also saved to student's paragraph collection
- Avoids duplicates in student storage through comparison logic

#### 2. Deleting Paragraphs
When a paragraph is deleted:

```javascript
function deleteParagraph(index) {
  // Remove from current paragraphs array (assignment level only)
  paragraphs.splice(index, 1)
  
  // Update selected paragraphs indices
  const newSelectedParagraphs = new Set()
  selectedParagraphs.forEach(selectedIndex => {
    if (selectedIndex < index) {
      newSelectedParagraphs.add(selectedIndex)
    } else if (selectedIndex > index) {
      newSelectedParagraphs.add(selectedIndex - 1)
    }
  })
  selectedParagraphs = newSelectedParagraphs
  
  // Save assignment data (without the deleted paragraph)
  saveAssessmentData()
  
  // Note: Student paragraphs are kept separate and are not affected by deletion
  // The deleted paragraph remains in the student's paragraph collection
}
```

**Key Behavior**:
- Paragraph is removed from assignment-level storage
- Paragraph remains in student's paragraph collection
- Selected paragraph indices are updated accordingly
- Only assignment data is saved (student data unchanged)

#### 3. Loading Assignment Data
When selecting an assignment:

```javascript
async function loadAssessmentData(subjectId, assessmentId) {
  try {
    const data = await invoke('read_subject_data', { 
      subjectId: `${subjectId}-${assessmentId}` 
    })
    if (data) {
      const parsed = JSON.parse(data)
      paragraphs = parsed.paragraphs || []
      // Load all paragraphs but don't select any by default
      selectedParagraphs = new Set()
      studentName = parsed.studentName || ''
      studentImage = parsed.studentImage || ''
      // Reset all marks to zero
      categoryMarks = {}
      manualTotalMarks = ''
    }
  } catch (error) {
    // Fallback to localStorage
  }
}
```

**Key Behavior**:
- All paragraphs from the assignment are loaded
- No paragraphs are selected by default
- All marks are reset to zero
- Provides a clean slate for new evaluations

#### 4. Loading Student Data
When selecting a student:

```javascript
async function loadStudentEvaluation() {
  if (!currentStudentId || !currentAssessmentId) return

  // First, load ALL student paragraphs
  await loadStudentParagraphs()

  try {
    const data = await invoke('read_student_evaluation', { 
      studentId: currentStudentId,
      assessmentId: currentAssessmentId
    })
    if (data) {
      const evaluationData = JSON.parse(data)
      // Don't overwrite paragraphs - keep the student paragraphs loaded above
      // Only load marks and selections from the evaluation data
      selectedParagraphs = new Set(evaluationData.selectedParagraphs || [])
      studentName = evaluationData.studentName || ''
      studentImage = evaluationData.studentImage || ''
      categoryMarks = evaluationData.categoryMarks || {}
      manualTotalMarks = evaluationData.manualTotalMarks || ''
    }
  } catch (error) {
    // Fallback to localStorage
  }
}

async function loadStudentParagraphs() {
  if (!currentStudentId) return

  try {
    const data = await invoke('read_student_paragraphs', { 
      studentId: currentStudentId
    })
    if (data) {
      const studentData = JSON.parse(data)
      // Load ALL student paragraphs (replace current paragraphs)
      const studentParagraphs = studentData.paragraphs || []
      paragraphs = [...studentParagraphs]
    }
  } catch (error) {
    // Fallback to localStorage
  }
}
```

**Key Behavior**:
- ALL student paragraphs are loaded first (from all assignments)
- Student evaluation data is loaded for marks and selections
- Student paragraphs are not overwritten by evaluation data
- Provides complete paragraph history for the student

### Benefits of Dual Storage System

1. **Comprehensive Student History**: Students can see all their feedback paragraphs from all assignments
2. **Assignment Isolation**: Each assignment maintains its own paragraph collection
3. **Data Integrity**: Deletion from assignments doesn't affect student history
4. **Flexible Evaluation**: Marks and selections are specific to each assignment
5. **Backup and Recovery**: Student data is preserved even if assignment data is modified
6. **Cross-Assignment Learning**: Students can reference feedback from previous assignments

### Data Consistency Rules

1. **Paragraph Addition**: Always saved to both assignment and student storage when student is selected
2. **Paragraph Deletion**: Only removed from assignment storage, preserved in student storage
3. **Student Selection**: Loads complete student paragraph history plus assignment-specific marks
4. **Assignment Selection**: Loads assignment paragraphs with reset selections and marks
5. **Duplicate Prevention**: Student storage avoids duplicate paragraphs through content comparison

## Component Architecture

### 📱 Main Application (`App.svelte`)

**Purpose**: Central orchestrator managing global state and component coordination.

**Key Responsibilities**:
- Global state management (`$state` variables)
- Data persistence and loading (subject-level and student-specific)
- Component event handling
- PDF generation orchestration with auto-save
- Student management coordination
- Paragraph database management

**Core State Variables**:
```javascript
let subjects = $state([])                    // All subjects
let currentSubjectId = $state(null)         // Currently selected subject
let currentAssessmentId = $state(null)      // Currently selected assessment
let currentStudentId = $state(null)         // Currently selected student
let paragraphs = $state([])                 // Subject-level paragraph database
let selectedParagraphs = $state(new Set())  // Student-specific selected paragraphs
let deletedParagraphs = $state(new Set())   // Student-specific deleted paragraphs
let students = $state([])                   // Student database
let percentageRanges = $state([])           // Universal percentage ranges
let showCalculator = $state(false)          // Calculator/navigation toggle
let categoryMarks = $state({})              // Student-specific category marks
let manualTotalMarks = $state('')           // Student-specific total marks
let studentImage = $state('')               // Student photo (base64)
let studentName = $state('')                // Current student display name
```

### 🧭 Sidebar Navigation (`Sidebar.svelte`)

**Purpose**: Primary navigation interface with integrated percentage calculator and toggle functionality.

**Features**:
- Subject and assessment navigation (non-bold fonts)
- Student selection dropdown
- Percentage calculator toggle (green, light green, yellow, orange, red colors only)
- Session information display
- Full sticky positioning (entire sidebar card)
- Action buttons (Save/Load student data, Copy to clipboard, Print to download)

### 📚 Subject Management (`SubjectManager.svelte`)

**Purpose**: Interface for creating and managing subjects.

**Features**:
- Subject creation and deletion
- Subject overview cards
- Assessment count display
- Confirmation dialogs for deletions

### 📝 Assessment Management (`AssessmentManager.svelte`)

**Purpose**: Comprehensive assessment interface with grading system.

**Features**:
- Assessment creation and management
- Category and topic management
- Student marks table with weighting
- CSV export functionality
- Grade calculation system

### ✏️ Feedback Editor (`FeedbackEditor.svelte`)

**Purpose**: Interface for creating and managing feedback paragraphs.

**Features**:
- Paragraph creation with category/topic selection
- Checkbox selection system
- Category grouping with marks input
- Student information management

### 📄 PDF Generation (`SelectedTextSection.svelte`)

**Purpose**: Export selected feedback to PDF format.

**Features**:
- PDF generation with jsPDF
- Student photo integration
- Professional formatting
- Copy to clipboard functionality

## Technology Stack

### Frontend Technologies
- **Svelte 5**: Modern reactive framework with `$state` and `$derived`
- **Bootstrap 5**: UI framework with utility classes
- **Bootstrap Icons**: Icon library for consistent UI elements
- **Vite**: Build tool and development server

### Backend Technologies
- **Tauri**: Rust-based desktop application framework
- **Rust**: System programming language for file operations
- **Tauri Filesystem API**: Cross-platform file system access

### Additional Libraries
- **jsPDF**: Client-side PDF generation
- **html2canvas**: HTML to canvas conversion (for PDF)

### Build Tools
- **Vite**: Frontend bundling and development
- **Tauri CLI**: Desktop application building
- **Rust Toolchain**: Backend compilation
