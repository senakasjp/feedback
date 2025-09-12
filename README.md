# Feedback Manager - Complete Development Guide

A comprehensive desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization, PDF generation, and advanced assessment management capabilities.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Component Structure](#component-structure)
4. [Data Management](#data-management)
5. [Technology Stack](#technology-stack)
6. [Development Setup](#development-setup)
7. [API Reference](#api-reference)
8. [Build & Distribution](#build--distribution)
9. [Troubleshooting](#troubleshooting)
10. [Version History](#version-history)

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

## Architecture Overview

### Application Structure
```
Subject (1 or more)
├── Assessment (0 or more)
    ├── Category (0 or more)
        └── Paragraph (0 or more)
```

### Core Components
- **App.svelte**: Main application orchestrator
- **Sidebar.svelte**: Navigation and percentage calculator
- **SubjectManager.svelte**: Subject management interface
- **AssessmentManager.svelte**: Assessment and grading interface
- **FeedbackEditor.svelte**: Paragraph creation and editing
- **SelectedTextSection.svelte**: PDF generation and text export

## Component Structure

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

**Key Functions**:
- `saveSubjects()`: Persist main configuration data
- `loadSubjects()`: Load main configuration from storage
- `saveSubjectParagraphs(subjectId)`: Save subject-level paragraph database
- `loadSubjectParagraphs(subjectId)`: Load subject-level paragraphs with fallback
- `saveStudentData(subjectId, assessmentId, studentId)`: Save student-specific data
- `loadStudentData(subjectId, assessmentId, studentId)`: Load student-specific data
- `generatePDF()`: Create PDF with selected content + auto-save student data
- `addStudent()`: Add new student to database
- `selectStudent(studentId)`: Set current student context and load data
- `addParagraph()`: Add paragraph to subject database + update student selection
- `deleteParagraph(index)`: Remove from subject + move to student deleted list

### 🧭 Sidebar Navigation (`Sidebar.svelte`)

**Purpose**: Primary navigation interface with integrated percentage calculator and toggle functionality.

**Features**:
- Subject and assessment navigation (non-bold fonts)
- Student selection dropdown
- Percentage calculator toggle (green, light green, yellow, orange, red colors only)
- Session information display
- Full sticky positioning (entire sidebar card)
- Action buttons (Save/Load student data, Copy to clipboard, Print to download)

**Toggle System**:
```svelte
{#if !showCalculator}
  <!-- Navigation View -->
  <!-- Subject/Assessment navigation -->
  <!-- Student selection -->
  <!-- Action buttons -->
{:else}
  <!-- Calculator View -->
  <!-- Percentage ranges management -->
  <!-- Color-coded ranges -->
{/if}
```

**Toggle Button Implementation**:
```svelte
<button 
  class="btn btn-outline-light btn-sm" 
  onclick={toggleView}
  title={showCalculator ? 'Show Navigator' : 'Show Calculator'}
  aria-label={showCalculator ? 'Show Navigator' : 'Show Calculator'}
>
  <i class="bi bi-{showCalculator ? 'list' : 'calculator'}"></i>
</button>
```

**Sticky Implementation**:
```css
.card {
  position: sticky;
  top: 0;
  z-index: 1020;
  max-height: 100vh;
}
.card-body {
  overflow-y: auto;
  padding-top: 1rem;
}
```

**Percentage Calculator Colors**:
```javascript
const colorOptions = [
  { name: 'green', style: 'background-color: #198754; color: white;' },
  { name: 'light-green', style: 'background-color: #20c997; color: white;' },
  { name: 'yellow', style: 'background-color: #ffc107; color: black;' },
  { name: 'orange', style: 'background-color: #fd7e14; color: white;' },
  { name: 'red', style: 'background-color: #dc3545; color: white;' }
]
```

### 📚 Subject Management (`SubjectManager.svelte`)

**Purpose**: Interface for creating and managing subjects.

**Features**:
- Subject creation and deletion
- Subject overview cards
- Assessment count display
- Confirmation dialogs for deletions

**Subject Card Structure**:
```svelte
<div class="subject-card">
  <div class="subject-header">
    <h5 class="subject-title">{subject.name}</h5>
    <button class="delete-btn" onclick={deleteSubject}>
      <i class="bi bi-trash"></i>
    </button>
  </div>
  <div class="subject-meta">
    <span class="assessment-count">{subject.assessments.length} assessments</span>
  </div>
</div>
```

### 📝 Assessment Management (`AssessmentManager.svelte`)

**Purpose**: Comprehensive assessment interface with grading system.

**Features**:
- Assessment creation and management
- Category and topic management
- Student marks table with weighting
- CSV export functionality
- Grade calculation system

**Assessment Card Layout**:
```svelte
<div class="assessment-card">
  <div class="assessment-header">
    <h5 class="assessment-title fw-normal">{assessment.name}</h5>
    <button class="delete-btn" onclick={removeAssessment}>
      <i class="bi bi-x"></i>
    </button>
  </div>
  <div class="assessment-meta">
    <span class="badge bg-info">{topics.length} topics</span>
    <span class="badge bg-success">{categories.length} categories</span>
  </div>
  <button class="btn btn-success" onclick={openFeedback}>
    Open Feedback
  </button>
</div>
```

**Student Marks Table**:
```svelte
<table class="table table-striped">
  <thead>
    <tr>
      <th>Student</th>
      {#each assessments as assessment}
        <th>
          {assessment.name}
          <input type="number" value={assessment.weight} 
                 onchange={updateWeight} class="form-control form-control-sm">
        </th>
      {/each}
      <th>Final Grade</th>
    </tr>
  </thead>
  <tbody>
    {#each students as student}
      <tr>
        <td>{student.name}</td>
        <!-- Assessment marks -->
        <td class="final-grade">
          <span class="badge bg-{getGradeColor(finalGrade)}">{finalGrade}</span>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
```

### ✏️ Feedback Editor (`FeedbackEditor.svelte`)

**Purpose**: Interface for creating and managing feedback paragraphs.

**Features**:
- Paragraph creation with category/topic selection
- Checkbox selection system
- Category grouping with marks input
- Student information management

**Paragraph Creation Form**:
```svelte
<form onsubmit={addParagraph}>
  <div class="mb-3">
    <select class="form-select" bind:value={selectedCategory}>
      {#each currentAssessment.categories as category}
        <option value={category.name}>{category.name}</option>
      {/each}
    </select>
  </div>
  <div class="mb-3">
    <textarea class="form-control" bind:value={newParagraph} 
              placeholder="Enter feedback paragraph..."></textarea>
  </div>
  <button type="submit" class="btn btn-primary">Add Paragraph</button>
</form>
```

**Category Grouping Display**:
```svelte
{#each getGroupedParagraphs() as group}
  <div class="card mb-3">
    <div class="card-header bg-info text-white">
      <div class="d-flex justify-content-between">
        <h6 class="mb-0">{group.category}</h6>
        <input type="number" value={categoryMarks[group.category]} 
               onchange={updateCategoryMarks} class="form-control form-control-sm">
      </div>
    </div>
    <div class="card-body">
      {#each group.paragraphs as paragraph, index}
        <div class="form-check">
          <input type="checkbox" class="form-check-input" 
                 checked={selectedParagraphs.has(index)} 
                 onchange={toggleParagraph}>
          <label class="form-check-label">{paragraph}</label>
        </div>
      {/each}
    </div>
  </div>
{/each}
```

### 📄 PDF Generation (`SelectedTextSection.svelte`)

**Purpose**: Export selected feedback to PDF format.

**Features**:
- PDF generation with jsPDF
- Student photo integration
- Professional formatting
- Copy to clipboard functionality

**PDF Generation Logic**:
```javascript
async function generatePDF() {
  const doc = new jsPDF();
  
  // Add student photo (full width)
  if (studentImage) {
    const img = new Image();
    img.onload = () => {
      const imgWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (img.height * imgWidth) / img.width;
      doc.addImage(img, 'JPEG', 0, 0, imgWidth, imgHeight);
      
      // Add content below image
      doc.setFontSize(10);
      doc.text('Feedback Report', 20, imgHeight + 20);
      doc.text(`Student: ${studentName}`, 20, imgHeight + 35);
      
      // Add selected paragraphs
      let yPosition = imgHeight + 50;
      getSelectedText().split('\n').forEach(line => {
        doc.text(line, 20, yPosition);
        yPosition += 6;
      });
      
      // Save PDF
      doc.save(`Feedback Report - ${currentSubject.name} - ${currentAssessment.name} - ${studentName}.pdf`);
    };
    img.src = studentImage;
  }
}
```

## Data Management

### Data Flow Architecture

#### 1. Global State Management
```javascript
// App.svelte - Central state
let subjects = $state([])
let students = $state([])
let paragraphs = $state([])
let selectedParagraphs = $state(new Set())

// Reactive derivations
let currentSubject = $derived(subjects.find(s => s.id === currentSubjectId))
let currentAssessment = $derived(currentSubject?.assessments.find(a => a.id === currentAssessmentId))
```

#### 2. Data Persistence Strategy
```javascript
// Subject-level paragraph database
async function saveSubjectParagraphs(subjectId) {
  const data = {
    paragraphs: paragraphs,
    lastUpdated: new Date().toISOString()
  };
  await invoke('write_file', {
    path: `FeedbackData/subject-paragraphs-${subjectId}.json`,
    content: JSON.stringify(data, null, 2)
  });
}

// Student-specific data (selections, marks, image, deleted paragraphs)
async function saveStudentData(subjectId, assessmentId, studentId) {
  const data = {
    selectedParagraphs: Array.from(selectedParagraphs),
    deletedParagraphs: Array.from(deletedParagraphs),
    categoryMarks: categoryMarks,
    manualTotalMarks: manualTotalMarks,
    studentImage: studentImage,
    studentName: studentName,
    savedAt: new Date().toISOString()
  };
  await invoke('write_file', {
    path: `FeedbackData/student-${studentId}-${subjectId}-${assessmentId}.json`,
    content: JSON.stringify(data, null, 2)
  });
}

// Auto-save on PDF generation
async function generatePDF() {
  // ... PDF generation logic ...
  
  // Auto-save student evaluation data when generating PDF
  if (currentStudentId) {
    await saveStudentEvaluation(); // Saves complete student data
  }
}
```

#### 3. File Storage Structure
```
FeedbackData/
├── feedback-data.json                    # Main configuration
├── subject-paragraphs-{subjectId}.json   # Subject paragraph database
├── student-{studentId}-{subjectId}-{assessmentId}.json  # Student data
└── percentage-ranges.json               # Universal percentage ranges
```

### Data Relationships

#### Entity Relationship Model
```
Students (1 or more)
├── Can be enrolled in multiple Subjects
└── Can have evaluations across different Assessments

Subjects (1 or more per student)
├── Contains multiple Assessments (1 or more)
└── Each Assessment belongs to exactly one Subject

Assessments (1 or more per subject)
├── Belongs to exactly one Subject
├── Contains multiple Topics and Categories
└── Can have multiple Student evaluations
```

#### Data Structure Examples

**Main Configuration (`feedback-data.json`)**:
```json
{
  "subjects": [
    {
      "id": "subject-1",
      "name": "Studio 6",
      "assessments": [
        {
          "id": "assessment-1",
          "name": "Mid-PDR",
          "topics": [{"id": "topic-1", "name": "Design Process"}],
          "categories": [
            {"id": "cat-1", "name": "Strengths"},
            {"id": "cat-2", "name": "Areas for Improvement"}
          ],
          "weight": 50
        }
      ]
    }
  ],
  "students": [
    {
      "id": "student-1",
      "name": "John Doe",
      "studentId": "12345",
      "displayName": "John Doe (12345)",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "percentageRanges": [
    {
      "id": "range-1",
      "value": 100,
      "color": "red",
      "lowerPercentage": 0,
      "upperPercentage": 50,
      "calculatedLower": 0,
      "calculatedUpper": 50
    }
  ]
}
```

**Subject Paragraph Database**:
```json
{
  "paragraphs": [
    "Student shows excellent understanding of design principles.",
    "Areas for improvement include technical implementation."
  ],
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

**Student Evaluation Data**:
```json
{
  "selectedParagraphs": [0, 1],
  "deletedParagraphs": [2, 3],
  "categoryMarks": {
    "Strengths": "10",
    "Areas for Improvement": "15"
  },
  "manualTotalMarks": "25",
  "studentImage": "data:image/jpeg;base64...",
  "studentName": "John Doe (12345)",
  "savedAt": "2024-01-01T00:00:00.000Z"
}
```

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

## Development Setup

### Environment Requirements
```bash
# Node.js (v16 or higher)
node --version

# Rust (latest stable)
rustc --version

# Tauri CLI
cargo install tauri-cli
```

### Project Structure
```
feedback-app/
├── src/                          # Frontend source code
│   ├── App.svelte               # Main application component
│   ├── main.js                  # Application entry point
│   ├── app.css                  # Global styles
│   ├── types.ts                 # TypeScript type definitions
│   └── lib/                     # Component library
│       ├── Sidebar.svelte       # Navigation component
│       ├── SubjectManager.svelte # Subject management
│       ├── AssessmentManager.svelte # Assessment interface
│       ├── FeedbackEditor.svelte # Feedback creation
│       ├── SelectedTextSection.svelte # PDF generation
│       ├── Breadcrumb.svelte    # Navigation breadcrumbs
│       ├── CategoryEditor.svelte # Category management
│       └── WelcomeScreen.svelte # Landing page
├── src-tauri/                   # Backend Rust code
│   ├── src/
│   │   ├── main.rs             # Rust entry point
│   │   └── lib.rs              # File system operations
│   ├── tauri.conf.json         # Tauri configuration
│   └── capabilities/           # Permission definitions
├── FeedbackData/               # Runtime data storage
├── dist/                       # Production build output
├── package.json               # Node.js dependencies
├── vite.config.js             # Vite configuration
├── svelte.config.js           # Svelte configuration
└── Cargo.toml                 # Rust dependencies
```

### Development Commands
```bash
# Install dependencies
npm install

# Start web development server
npm run dev

# Start desktop development (with hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Build web version only
npm run build
```

### Configuration Files

**`package.json`**:
```json
{
  "name": "feedback-app",
  "version": "2.5.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "svelte": "^5.0.0",
    "bootstrap": "^5.3.0",
    "bootstrap-icons": "^1.11.0",
    "jspdf": "^2.5.1",
    "html2canvas": "^1.4.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-svelte": "^5.0.0"
  }
}
```

**`tauri.conf.json`**:
```json
{
  "package": {
    "productName": "Feedback Manager",
    "version": "2.5.0"
  },
  "build": {
    "distDir": "../dist",
    "devPath": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "tauri": {
    "allowlist": {
      "fs": {
        "all": true,
        "readFile": true,
        "writeFile": true,
        "createDir": true,
        "removeDir": true,
        "removeFile": true,
        "exists": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.feedback.manager"
    }
  }
}
```

## API Reference

### Tauri Backend Commands

#### File System Operations
```rust
// Read file content
#[tauri::command]
async fn read_file(path: String) -> Result<String, String>

// Write file content
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>

// Check if file exists
#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String>

// Create directory
#[tauri::command]
async fn create_dir(path: String) -> Result<(), String>
```

#### Usage in Frontend
```javascript
import { invoke } from '@tauri-apps/api/tauri';

// Read data file
const data = await invoke('read_file', {
  path: 'FeedbackData/feedback-data.json'
});

// Save data file
await invoke('write_file', {
  path: 'FeedbackData/feedback-data.json',
  content: JSON.stringify(data, null, 2)
});
```

### Frontend API Functions

#### Data Management
```javascript
// Save all application data
async function saveData() {
  const data = {
    subjects,
    students,
    percentageRanges,
    lastSaved: new Date().toISOString()
  };
  await invoke('write_file', {
    path: 'FeedbackData/feedback-data.json',
    content: JSON.stringify(data, null, 2)
  });
}

// Load all application data
async function loadData() {
  try {
    const content = await invoke('read_file', {
      path: 'FeedbackData/feedback-data.json'
    });
    const data = JSON.parse(content);
    subjects = data.subjects || [];
    students = data.students || [];
    percentageRanges = data.percentageRanges || [];
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}
```

#### Student Management
```javascript
// Add new student
function addStudent() {
  if (!newStudentName || !newStudentId) return;
  
  const student = {
    id: generateId(),
    name: newStudentName,
    studentId: newStudentId,
    displayName: `${newStudentName} (${newStudentId})`,
    createdAt: new Date().toISOString()
  };
  
  students = [...students, student];
  saveStudents();
}

// Select student
async function selectStudent(studentId) {
  currentStudentId = studentId;
  const student = students.find(s => s.id === studentId);
  studentName = student ? student.displayName : '';
  
  // Load student-specific data if available
  if (currentAssessmentId && currentSubjectId) {
    await loadStudentData(currentSubjectId, currentAssessmentId, studentId);
  }
}
```

#### Assessment Management
```javascript
// Add assessment to subject
function addAssessment() {
  if (!newAssessmentName || !currentSubjectId) return;
  
  const assessment = {
    id: generateId(),
    name: newAssessmentName,
    topics: [],
    categories: [],
    weight: 100
  };
  
  const subject = subjects.find(s => s.id === currentSubjectId);
  if (subject) {
    subject.assessments = [...(subject.assessments || []), assessment];
    saveData();
  }
}

// Update assessment weight
function updateAssessmentWeight(assessmentId, weight) {
  const subject = subjects.find(s => s.assessments?.some(a => a.id === assessmentId));
  if (subject) {
    const assessment = subject.assessments.find(a => a.id === assessmentId);
    if (assessment) {
      assessment.weight = parseFloat(weight) || 0;
      saveData();
    }
  }
}
```

#### PDF Generation
```javascript
// Generate PDF with selected content + auto-save
async function generatePDF() {
  const selectedText = getSelectedText();
  if (!selectedText) {
    showSuccessNotification('No paragraphs selected!');
    return;
  }

  // Check for marks warning
  const calculatedTotal = getTotalMarks();
  if (calculatedTotal > 0 && (!manualTotalMarks || manualTotalMarks === '0' || manualTotalMarks === '')) {
    showTotalMarksWarning = true;
    return;
  }

  const doc = new jsPDF();
  
  // Add full-width student image if available
  if (studentImage) {
    const img = new Image();
    img.onload = function() {
      const aspectRatio = img.width / img.height;
      let imageWidth = pageWidth - (margin * 2);
      let imageHeight = imageWidth / aspectRatio;
      
      doc.addImage(studentImage, 'JPEG', margin, margin, imageWidth, imageHeight);
      
      // Continue with content below image
      let currentY = margin + imageHeight + 15;
      generateRestOfPDF(doc, currentY, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name);
    };
    img.src = studentImage;
    return;
  }
  
  // Generate PDF content with professional formatting
  generateRestOfPDF(doc, margin, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name);
  
  // Auto-save student evaluation data when generating PDF
  if (currentStudentId) {
    await saveStudentEvaluation(); // Saves complete student data automatically
  }
  
  showSuccessNotification('PDF generated and downloaded successfully!');
}
```

## Build & Distribution

### Production Build
```bash
# Build desktop application
npm run tauri build
```

### Build Outputs
- **Windows**: `.exe` installer and portable executable
- **macOS**: `.app` bundle and `.dmg` installer
- **Linux**: `.deb`, `.rpm`, and `.AppImage` packages

### Distribution Strategy
1. Build platform-specific executables
2. Test on target platforms
3. Package with data folder structure
4. Distribute entire application folder
5. Users can run executable directly

### Portable Installation
The application is designed to be portable:
- All data stored in `FeedbackData/` folder next to executable
- No registry entries or system dependencies
- Copy entire folder to any computer
- Data persists across installations

## Troubleshooting

### Common Development Issues

#### 1. Build Failures
```bash
# Ensure Rust toolchain is installed
rustup update

# Clean build cache
cargo clean

# Reinstall Tauri CLI
cargo install tauri-cli --force
```

#### 2. File System Permissions
Ensure `capabilities/default.json` includes:
```json
{
  "fs": {
    "all": true,
    "readFile": true,
    "writeFile": true,
    "createDir": true,
    "removeDir": true,
    "removeFile": true,
    "exists": true
  }
}
```

#### 3. Svelte Compilation Errors
- Check for duplicate attributes in templates
- Ensure proper closing of HTML tags
- Verify Svelte block structure (`{#if}`, `{:else}`, `{/if}`)

#### 4. TypeScript Errors in Svelte Files
Add JSDoc type comments:
```svelte
<script>
  /** @type {any} */
  let { prop1, prop2 } = $props();
</script>
```

### Runtime Issues

#### 1. Data Not Persisting
- Check file system permissions
- Verify `FeedbackData` folder exists
- Ensure Tauri file system plugin is configured

#### 2. PDF Generation Fails
- Check image format compatibility
- Verify jsPDF library is loaded
- Ensure sufficient memory for large images

#### 3. Student Data Not Loading
- Check file naming convention
- Verify JSON format validity
- Ensure proper student ID matching

### Performance Optimization

#### 1. Large Dataset Handling
```javascript
// Implement pagination for large student lists
function getPaginatedStudents(page = 0, pageSize = 50) {
  const start = page * pageSize;
  const end = start + pageSize;
  return students.slice(start, end);
}
```

#### 2. Memory Management
```javascript
// Clear unused images from memory
function clearUnusedImages() {
  if (currentStudentId !== previousStudentId) {
    previousStudentImage = null;
  }
}
```

#### 3. Efficient State Updates
```javascript
// Use batch updates for multiple state changes
function batchUpdateState() {
  subjects = newSubjects;
  students = newStudents;
  percentageRanges = newRanges;
  // Single save operation
  saveData();
}
```

## Version History

### v2.5.0 - Current Version
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

### Key Architectural Decisions
1. **File-based Storage**: JSON files for portability and simplicity
2. **Component-based Architecture**: Modular Svelte components
3. **Reactive State Management**: Svelte 5 `$state` and `$derived`
4. **Cross-platform Desktop**: Tauri for native performance
5. **Bootstrap 5 UI**: Consistent, responsive interface design

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

This comprehensive guide provides everything needed to understand, develop, and maintain the Feedback Manager application.
