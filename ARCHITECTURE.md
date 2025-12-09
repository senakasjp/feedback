# Architecture Documentation

> **New:** Saving a student evaluation now automatically deselects the student and resets the dropdown to 'Select a student...' to prevent accidental edits.


## Version 3.2.6 - Manual Rubric Highlighting Reliability

- PDF rubric highlighting uses row label as the category and the selected paragraph’s position (top-down) to pick the target column via manual paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected, avoiding divergence between UI and exported PDF.
- Highlighting now mirrors the on-screen checkbox selection order.

## Version 3.2.4 - Total Marks Display & Enhanced Text Formatting

### Real-time Total Marks Display System

The application now includes a comprehensive real-time total marks display system that provides instant feedback on assessment totals:

#### Technical Implementation
```javascript
// Total marks calculation and display
function getTotalMarks() {
  return Object.values(categoryMarks || {})
    .reduce((total, mark) => total + (parseFloat(mark) || 0), 0)
}

// Reactive display in multiple locations
$: totalMarks = getTotalMarks()
```

#### Component Integration
- **Sidebar Component**: Added `categoryMarks` and `getTotalMarks` props for real-time display
- **Multiple Templates**: Updated all Sidebar usages across different template files
- **Conditional Rendering**: Total marks only appear when marks are entered (total > 0)
- **Visual Emphasis**: Red text styling using Bootstrap `text-danger` class

#### User Experience Benefits
- **Dual Location Display**: Total marks visible in both sidebar and paragraphs section
- **Immediate Feedback**: Real-time updates when category marks change
- **Assessment Tracking**: Enhanced monitoring of total marks across all categories
- **Clean Interface**: Conditional display prevents clutter when no marks entered

### Enhanced Rich Text Editor System

The application now includes advanced text formatting capabilities with font color support:

#### Technical Implementation
```javascript
// Font color functionality in RichTextEditor component
function changeFontColor(color) {
  document.execCommand('foreColor', false, color)
  updateFontColorState()
  onChange(editorRef.innerHTML)
}

// Color picker integration
<input 
  type="color" 
  bind:value={currentFontColor}
  onchange={() => changeFontColor(currentFontColor)}
  class="form-control form-control-sm"
/>
```

#### Component Architecture
- **HTML5 Color Input**: Native color picker with Bootstrap styling
- **Real-time Preview**: Color picker reflects current selection's color
- **State Management**: `currentFontColor` tracks selected color
- **Export Compatibility**: HTML content converted to plain text for clipboard/PDF

#### User Experience Benefits
- **Professional Formatting**: Enhanced text presentation capabilities
- **Visual Organization**: Color coding for better text organization
- **Export Safety**: Display-only colors don't affect PDF exports
- **Bootstrap Integration**: Consistent styling with existing UI

## Version 3.2.1 - Automatic Duplicate ID Detection & Fixing

### Critical Bug Fix: Duplicate Paragraph ID Management

The application now includes a comprehensive system for detecting and automatically fixing duplicate paragraph IDs, which were causing selection tracking failures:

#### Problem Resolution Architecture

**Root Cause Identified**:
- Multiple paragraphs sharing identical IDs (e.g., `mfq7dqffo4h768js19`)
- JavaScript `Set` objects can only store unique values
- Selection tracking failed when multiple paragraphs had same ID
- Print functions excluded paragraphs with duplicate IDs

**Solution Architecture**:
- **Automatic Detection**: Real-time duplicate ID detection during data loading
- **Auto-Fix System**: Automatic ID regeneration with unique identifiers
- **Enhanced Debug Tools**: Comprehensive debugging and monitoring capabilities
- **Data Persistence**: Automatic saving of fixed IDs to prevent recurrence

#### Technical Implementation

**ID Detection System**:
```javascript
function checkForDuplicateIds() {
  const allIds = paragraphs.map(p => p.id)
  const uniqueIds = [...new Set(allIds)]
  const duplicateIds = allIds.filter((id, index, arr) => arr.indexOf(id) !== index)
  
  // Returns true if duplicates found, false if all unique
  return duplicateIds.length > 0
}
```

**Auto-Fix System**:
```javascript
function regenerateParagraphIds() {
  // Generate new unique IDs for all paragraphs
  paragraphs = paragraphs.map((para, index) => ({
    ...para,
    id: generateId(para.text || para, index)
  }))
  
  // Clear selections since IDs have changed
  selectedParagraphs = new Set()
  
  // Save the updated paragraphs
  saveAssessmentData()
  if (currentStudentId) {
    saveStudentParagraphs()
  }
}
```

#### Integration Points

**Automatic Detection Integration**:
- **Tauri Path**: Integrated into `loadAssessmentData()` function
- **LocalStorage Path**: Integrated into localStorage fallback
- **Auto-Fix**: Automatically triggers `regenerateParagraphIds()` when duplicates detected

**Debug Panel Enhancements**:
- **Check Duplicate IDs Button**: Manual verification of ID uniqueness
- **Fix Duplicate IDs Button**: Manual regeneration of paragraph IDs
- **Enhanced Logging**: Comprehensive console output for troubleshooting

#### Data Flow Architecture

1. **Load Process**:
   - Paragraphs loaded from storage
   - `checkForDuplicateIds()` automatically called
   - If duplicates detected, `regenerateParagraphIds()` automatically triggered
   - Fixed IDs automatically saved to storage

2. **Debug Process**:
   - User can manually check for duplicates via debug panel
   - User can manually fix duplicates via debug panel
   - All actions logged to console and debug panel

3. **Prevention Process**:
   - All new paragraph IDs generated with unique identifiers
   - Existing data automatically fixed on load
   - System maintains ID uniqueness going forward

#### Impact & Benefits

**Immediate Fixes**:
- ✅ All paragraph selections now work correctly
- ✅ Print functions include all selected content
- ✅ Selection counter accurately reflects selected paragraphs
- ✅ No more missing paragraphs in generated documents

**Long-term Benefits**:
- ✅ Automatic prevention of future duplicate ID issues
- ✅ Enhanced debugging capabilities for troubleshooting
- ✅ Improved system reliability and data integrity
- ✅ Better user experience with consistent selection behavior

---

## Version 3.2.0 - Student Selection Data Storage System

### New Student-Centric Selection Storage

The application now implements a revolutionary student-centric approach to storing paragraph selections, making data management more organized and efficient:

#### Key Features
1. **Student Properties Storage**: Selected paragraph data is now stored as properties of each student object
2. **Assessment-Specific Selections**: Each student maintains separate selections for each assessment
3. **Data Replacement Policy**: Old selection data is automatically replaced on each save
4. **Backward Compatibility**: System maintains compatibility with existing evaluation files
5. **Automatic Loading**: Selection data loads automatically when students are selected

#### Student Data Structure Enhancement
```javascript
{
  id: "student-123",
  displayName: "John Doe (12345)",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  selectedParagraphs: {
    "assessment-1": ["para-id-1", "para-id-2"],
    "assessment-2": ["para-id-3", "para-id-4"],
    "assessment-3": []
  }
}
```

#### Data Flow Architecture
1. **Save Process**: 
   - Selected paragraphs → `student.selectedParagraphs[assessmentId]`
   - Old selection data → **Replaced** (not merged)
   - Student data → Saved to main students file
   - Evaluation data → Saved to separate files (marks, etc.)

2. **Load Process**:
   - **Primary**: Load from `student.selectedParagraphs[assessmentId]`
   - **Fallback**: Load from evaluation files (backward compatibility)
   - **UI Update**: Apply selections to checkboxes automatically

3. **Print/Save Process**:
   - Uses loaded selection data from student properties
   - Generates PDFs and copies text based on student selections
   - Maintains all existing functionality

## Version 3.1.0 - Major Bug Fixes Release

### Visual Debug Panel Architecture

The application now includes a comprehensive visual debugging system designed specifically for Tauri desktop applications:

#### Debug Panel Components
1. **State Management**: `showCheckboxDebug` and `checkboxDebugInfo` state variables
2. **Message System**: `addCheckboxDebug()` function with timestamp and message limit
3. **UI Components**: Toggle button in navbar and comprehensive debug panel
4. **ID Management**: `regenerateParagraphIds()` function for fixing duplicate IDs
5. **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements

#### Enhanced ID Generation System
- **Problem Solved**: Multiple checkbox ticking caused by duplicate paragraph IDs
- **Solution**: Enhanced `generateId()` function with timestamp and random components
- **Architecture**: Deterministic hash + timestamp + random for true uniqueness
- **Impact**: Eliminates duplicate IDs and ensures one-to-one checkbox mapping

#### Data Contamination Prevention
- **Problem Solved**: Paragraphs from other assessments being loaded
- **Solution**: Strict filtering by `subjectId` and `assessmentId`
- **Architecture**: Legacy data migration with automatic property assignment
- **Impact**: Clean data separation between assessments

## Overview

The Feedback Manager implements a sophisticated dual storage system that separates assignment-level paragraph storage from student-specific paragraph collections, enabling comprehensive feedback management across multiple assignments while maintaining data integrity.

## Strict Data Separation Policy

The application follows three strict rules to prevent data confusion and ensure clean data management:

### Rule 1: Assignment Data Rule
- **Definition**: Paragraphs when no student selected are assignment data
- **Implementation**: Only assignment-level paragraphs are saved to assessment files
- **Technical**: Assignment files never contain student-specific information
- **Benefits**: Assignment data remains clean and reusable across all students

### Rule 2: Student Data Rule
- **Definition**: Anything saved when student is selected are student data
- **Implementation**: All paragraphs, selections, and marks are saved to student-specific files
- **Technical**: Student data includes merged assignment + student-specific paragraphs
- **Benefits**: Complete student evaluation data is preserved independently

### Rule 3: Persistent Student Data Rule
- **Definition**: Student data should be saved even if not selected
- **Implementation**: Autosave system automatically saves student data when student is selected
- **Technical**: Data integrity maintained across all application states
- **Benefits**: Student work is always saved, regardless of selection state

### Implementation Details
- **Dual Autosave System**: Assignment data when no student, student data when student selected
- **Strict Save Validation**: `saveAssessmentData()` only saves when no student is selected
- **Data Contamination Prevention**: Multiple validation layers prevent cross-contamination
- **Assignment Data Purity**: Assignment files never contain student-specific information

## Strict Saving Criteria Implementation (v3.0.7)

### Critical Data Contamination Prevention
The application now implements strict saving criteria to prevent dataset contamination:

#### Assessment Saving Rule
```javascript
async function saveAssessmentData() {
    // STRICT SAVING CRITERIA 1: Only save to Assessment if student is NOT selected
    if (currentStudentId) {
        console.log('STRICT SAVING CRITERIA: Cannot save assessment data when student is selected')
        return
    }
    
    // STRICT VALIDATION: Ensure no student-specific data is being saved to assessment
    console.log('STRICT SAVING CRITERIA: Saving to assessment file - no student selected')
    // ... save logic
}
```

#### Student Saving Rule
```javascript
async function saveStudentEvaluation() {
    // STRICT SAVING CRITERIA 2: Only save to Student if student IS selected
    console.log('STRICT SAVING CRITERIA: Saving to student file - student selected')
    
    // STRICT VALIDATION: Ensure student is actually selected
    if (!currentStudentId) {
        console.log('STRICT SAVING CRITERIA: Cannot save student data when no student is selected')
        return
    }
    // ... save logic
}
```

### Student Photo System Removal
- **Complete Removal**: All `studentImage` references removed from codebase
- **Header Photo Only**: Only assessment header photos are supported
- **Clean Data Structure**: No photo data in student files
- **Simplified Architecture**: Removed student photo upload and storage functionality

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

## Unique ID-Based Paragraph Management System

### Overview

The application implements a robust paragraph management system using unique IDs instead of array indices. This ensures reliable paragraph selection, editing, and tracking even when paragraphs are modified, reordered, or merged from different sources.

### ID Generation and Management

#### Unique ID Generation
```javascript
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
```

#### Data Migration
```javascript
function ensureParagraphsHaveIds(paragraphs) {
  return paragraphs.map(para => {
    if (typeof para === 'string') {
      return {
        id: generateId(),
        text: para,
        color: undefined
      }
    } else if (para && !para.id) {
      return {
        ...para,
        id: generateId()
      }
    }
    return para
  })
}
```

### Paragraph Object Structure

All paragraphs now include a unique `id` field:

```json
{
  "id": "abc123def456",
  "text": "Student demonstrates excellent understanding of design principles.",
  "color": "green"
}
```

### ID-Based Selection System

#### Selection Tracking
```javascript
let selectedParagraphs = $state(new Set())  // Stores unique IDs, not indices
```

#### Toggle Function
```javascript
function toggleParagraph(index) {
  const paragraphId = paragraphs[index]?.id
  if (!paragraphId) return

  if (selectedParagraphs.has(paragraphId)) {
    selectedParagraphs.delete(paragraphId)
  } else {
    selectedParagraphs.add(paragraphId)
  }
  selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
}
```

### Data Migration and Backward Compatibility

The system automatically migrates existing data to include unique IDs:

1. **Assignment Data Loading**: `loadAssessmentData()` applies `ensureParagraphsHaveIds()`
2. **Student Data Loading**: `loadStudentParagraphs()` applies `ensureParagraphsHaveIds()`
3. **Paragraph Creation**: New paragraphs automatically get unique IDs
4. **Data Merging**: ID-based duplicate detection prevents conflicts

### Benefits of ID-Based System

1. **Reliable Selection**: Paragraph selections remain correct even after editing or reordering
2. **Robust Merging**: ID-based duplicate detection prevents data conflicts
3. **Data Integrity**: Unique identifiers ensure consistent paragraph tracking
4. **Backward Compatibility**: Automatic migration ensures existing data works seamlessly
5. **Future-Proof**: System can handle complex paragraph operations without breaking

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
**Purpose**: Stores student-specific evaluation data including marks and metadata for specific assignments. **Note**: Selected paragraph data is now stored in student properties (see above).

**File Structure**:
```
FeedbackData/
├── student-evaluation-{studentId}-{assessmentId}.json  # Student evaluation data (marks, etc.)
```

**Data Structure**:
```json
{
  "studentId": "student-123",
  "assessmentId": "assessment-456",
  "paragraphs": [],
  "selectedParagraphs": [0, 1],  // Legacy field - now stored in student.selectedParagraphs
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

**Important**: The `selectedParagraphs` field in evaluation files is now maintained for backward compatibility only. New selections are stored in `student.selectedParagraphs[assessmentId]`.

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

#### 2. Editing Paragraphs
When a paragraph is edited:

```javascript
function startEditParagraph(index) {
  editingParagraphIndex = index
  // Extract only the main text content (without category and knowledge area prefixes)
  editingParagraphText = extractMainTextFromParagraph(paragraphs[index].text)
}

function saveEditParagraph() {
  if (editingParagraphIndex !== null && editingParagraphText.trim()) {
    // Reconstruct the paragraph text with original prefixes
    const originalText = paragraphs[editingParagraphIndex].text
    const newText = reconstructParagraphText(originalText, editingParagraphText.trim())
    paragraphs[editingParagraphIndex].text = newText
    editingParagraphIndex = null
    editingParagraphText = ''
    
    // Save to both assignment and student storage
    saveAssessmentData()
    if (currentStudentId) {
      saveStudentParagraphs()
    }
  }
}
```

**Helper Functions**:
```javascript
// Extract main text from paragraph (without prefixes)
function extractMainTextFromParagraph(paragraphText) {
  let text = paragraphText
  
  // Remove category prefix (format: "Category: text")
  if (text.includes(': ')) {
    const parts = text.split(': ')
    if (parts.length >= 2) {
      text = parts.slice(1).join(': ')
    }
  }
  
  // Remove knowledge area suffix (format: "text - Knowledge Area")
  if (text.includes(' - ')) {
    const parts = text.split(' - ')
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]
      if (!lastPart.includes(':')) {
        text = parts.slice(0, -1).join(' - ')
      }
    }
  }
  
  return text
}

// Reconstruct paragraph text with original prefixes
function reconstructParagraphText(originalText, newMainText) {
  let categoryPrefix = ''
  let knowledgeAreaSuffix = ''
  
  // Extract category prefix from original text
  if (originalText.includes(': ')) {
    const parts = originalText.split(': ')
    if (parts.length >= 2) {
      categoryPrefix = parts[0] + ': '
    }
  }
  
  // Extract knowledge area suffix from original text
  if (originalText.includes(' - ')) {
    const parts = originalText.split(' - ')
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]
      if (!lastPart.includes(':')) {
        knowledgeAreaSuffix = ' - ' + lastPart
      }
    }
  }
  
  // Reconstruct: Category: MainText - KnowledgeArea
  return categoryPrefix + newMainText + knowledgeAreaSuffix
}
```

**Key Behavior**:
- Only the main text content can be edited (preserves category and knowledge area prefixes)
- Edited paragraph is saved to both assignment and student storage
- Original structural information (category, knowledge area) is preserved
- Maintains data integrity across both storage systems

#### 3. Deleting Paragraphs
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

#### 4. Loading Assignment Data
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

#### 5. Loading Student Data
When selecting a student:

```javascript
async function loadStudentEvaluation() {
  if (!currentStudentId || !currentAssessmentId) return

  // First, load assignment paragraphs (including edited ones)
  await loadAssessmentData(currentSubjectId, currentAssessmentId)
  const assignmentParagraphs = [...paragraphs]

  // Then, load student paragraphs
  await loadStudentParagraphs()
  const studentParagraphs = [...paragraphs]

  // Merge assignment and student paragraphs (avoid duplicates)
  const mergedParagraphs = mergeParagraphs(assignmentParagraphs, studentParagraphs)
  paragraphs = mergedParagraphs

  // Load evaluation data to get selections and marks
  let savedSelectedParagraphs = new Set()
  let savedStudentName = ''
  let savedStudentImage = ''
  let savedCategoryMarks = {}
  let savedManualTotalMarks = ''

  try {
    const data = await invoke('read_student_evaluation', { 
      studentId: currentStudentId,
      assessmentId: currentAssessmentId
    })
    if (data) {
      const evaluationData = JSON.parse(data)
      savedSelectedParagraphs = new Set(evaluationData.selectedParagraphs || [])
      savedStudentName = evaluationData.studentName || ''
      savedStudentImage = evaluationData.studentImage || ''
      savedCategoryMarks = evaluationData.categoryMarks || {}
      savedManualTotalMarks = evaluationData.manualTotalMarks || ''
    }
  } catch (error) {
    // Fallback to localStorage
  }

  // Map saved selections to merged paragraph indices
  const mappedSelections = mapSelectionsToMergedParagraphs(
    savedSelectedParagraphs, 
    assignmentParagraphs, 
    studentParagraphs, 
    mergedParagraphs
  )

  // Apply the mapped selections and marks
  selectedParagraphs = mappedSelections
  studentName = savedStudentName
  studentImage = savedStudentImage
  categoryMarks = savedCategoryMarks
  manualTotalMarks = savedManualTotalMarks
}
```

**Helper Functions**:
```javascript
// Merge assignment and student paragraphs with enhanced identical detection
// If paragraphs at the same index differ, include both versions with source tracking
// If paragraphs are identical (after normalization), show only one version
function mergeParagraphs(assignmentParagraphs, studentParagraphs) {
  const merged = []
  const maxLength = Math.max(assignmentParagraphs.length, studentParagraphs.length)
  
  // Process each index position
  for (let i = 0; i < maxLength; i++) {
    const assignmentPara = assignmentParagraphs[i]
    const studentPara = studentParagraphs[i]
    
    // Get paragraph texts for comparison
    const assignmentText = assignmentPara ? (typeof assignmentPara === 'string' ? assignmentPara : assignmentPara.text) : null
    const studentText = studentPara ? (typeof studentPara === 'string' ? studentPara : studentPara.text) : null
    
    if (assignmentText && studentText) {
      // Both paragraphs exist at this index
      // Normalize texts for comparison (trim whitespace and normalize line endings)
      const normalizedAssignmentText = assignmentText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const normalizedStudentText = studentText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      
      if (normalizedAssignmentText !== normalizedStudentText) {
        // Paragraphs are different - include both versions with source tracking
        console.log(`Different paragraphs at index ${i}:`, {
          assignment: normalizedAssignmentText,
          student: normalizedStudentText
        })
        
        // Add assignment version with source marking
        merged.push({
          ...assignmentPara,
          _source: 'assignment'
        })
        
        // Add student version with modified ID to avoid conflicts
        merged.push({
          ...studentPara,
          id: studentPara.id + '_student',
          _source: 'student'
        })
      } else {
        // Paragraphs are identical - add only one version (no duplicates)
        console.log(`Identical paragraphs at index ${i} - showing only one version`)
        merged.push(assignmentPara)
      }
    } else if (assignmentText) {
      // Only assignment paragraph exists at this index
      merged.push(assignmentPara)
    } else if (studentText) {
      // Only student paragraph exists at this index
      merged.push(studentPara)
    }
  }
  
  return merged
}

// Map saved selections to merged paragraph indices
function mapSelectionsToMergedParagraphs(savedSelections, assignmentParagraphs, studentParagraphs, mergedParagraphs) {
  const mappedSelections = new Set()
  
  // Create maps to find paragraph text by index
  const assignmentTexts = assignmentParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  )
  const studentTexts = studentParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  )
  const mergedTexts = mergedParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  )
  
  // Map each saved selection
  for (const savedIndex of savedSelections) {
    let paragraphText = null
    
    // First, try to find in assignment paragraphs
    if (savedIndex < assignmentTexts.length) {
      paragraphText = assignmentTexts[savedIndex]
    }
    // If not found in assignment, try student paragraphs
    else if (savedIndex - assignmentTexts.length < studentTexts.length) {
      const studentIndex = savedIndex - assignmentTexts.length
      paragraphText = studentTexts[studentIndex]
    }
    
    // If we found the paragraph text, find its new index in merged array
    if (paragraphText) {
      const newIndex = mergedTexts.findIndex(text => text === paragraphText)
      if (newIndex !== -1) {
        mappedSelections.add(newIndex)
      }
    }
  }
  
  return mappedSelections
}
```

**Key Behavior**:
- Loads assignment paragraphs (including edited ones) first
- Loads student paragraphs second
- Merges both sets, avoiding duplicates
- Maps saved selection indices to new merged paragraph indices
- Loads student evaluation data (marks, selections, metadata)
- Provides complete paragraph history with correct selections and marks

### Benefits of Dual Storage System

1. **Comprehensive Student History**: Students can see all their feedback paragraphs from all assignments
2. **Assignment Isolation**: Each assignment maintains its own paragraph collection
3. **Data Integrity**: Deletion from assignments doesn't affect student history
4. **Flexible Evaluation**: Marks and selections are specific to each assignment
5. **Backup and Recovery**: Student data is preserved even if assignment data is modified
6. **Cross-Assignment Learning**: Students can reference feedback from previous assignments

### Data Consistency Rules

1. **Paragraph Addition**: Always saved to both assignment and student storage when student is selected
2. **Paragraph Editing**: Always saved to both assignment and student storage when student is selected
3. **Paragraph Deletion**: Only removed from assignment storage, preserved in student storage
4. **Student Selection**: Loads complete student paragraph history plus assignment-specific marks with proper index mapping
5. **Assignment Selection**: Loads assignment paragraphs with reset selections and marks
6. **Duplicate Prevention**: Student storage avoids duplicate paragraphs through content comparison
7. **Selection Mapping**: Saved selections are correctly mapped to merged paragraph indices using text-based matching

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
let studentImage = $state('')               // Header photo (base64)
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
- Subject-specific student management
- Professional delete confirmations with Bootstrap modals

**Student Management Features**:
- **Student List Display**: Shows students with evaluation data for the current subject
- **Student Removal**: Red trash button to remove students from the current subject
- **Confirmation Modal**: Professional Bootstrap modal with detailed warning information
- **Data Cleanup**: Removes all evaluation data for the student across all assessments in the subject
- **Global Preservation**: Student remains in global student list for use in other subjects

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
- Header photo integration
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
