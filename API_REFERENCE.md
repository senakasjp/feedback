# API Reference

## Tauri Backend Commands

### File System Operations

#### Read File
```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String>
```
Reads content from a file.

**Parameters**:
- `path`: String - File path relative to the data directory

**Returns**:
- `Result<String, String>` - File content or error message

**Usage**:
```javascript
const content = await invoke('read_file', {
  path: 'FeedbackData/feedback-data.json'
});
```

#### Write File
```rust
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>
```
Writes content to a file.

**Parameters**:
- `path`: String - File path relative to the data directory
- `content`: String - Content to write

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('write_file', {
  path: 'FeedbackData/feedback-data.json',
  content: JSON.stringify(data, null, 2)
});
```

#### File Exists
```rust
#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String>
```
Checks if a file exists.

**Parameters**:
- `path`: String - File path relative to the data directory

**Returns**:
- `Result<bool, String>` - True if file exists, false otherwise

**Usage**:
```javascript
const exists = await invoke('file_exists', {
  path: 'FeedbackData/feedback-data.json'
});
```

#### Create Directory
```rust
#[tauri::command]
async fn create_dir(path: String) -> Result<(), String>
```
Creates a directory.

**Parameters**:
- `path`: String - Directory path relative to the data directory

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('create_dir', {
  path: 'FeedbackData/backups'
});
```

### Data Management Commands

#### Read Portable Data
```rust
#[tauri::command]
fn read_portable() -> Result<String, String>
```
Reads the main configuration file.

**Returns**:
- `Result<String, String>` - JSON configuration data

**Usage**:
```javascript
const data = await invoke('read_portable');
const config = JSON.parse(data);
```

#### Write Portable Data
```rust
#[tauri::command]
fn write_portable(data: String) -> Result<(), String>
```
Writes the main configuration file.

**Parameters**:
- `data`: String - JSON configuration data

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('write_portable', {
  data: JSON.stringify(config, null, 2)
});
```

#### Read Subject Data
```rust
#[tauri::command]
fn read_subject_data(subject_id: String) -> Result<String, String>
```
Reads assessment-specific data.

**Parameters**:
- `subject_id`: String - Subject and assessment ID (format: "subjectId-assessmentId")

**Returns**:
- `Result<String, String>` - JSON assessment data

**Usage**:
```javascript
const data = await invoke('read_subject_data', {
  subjectId: 'subject-123-assessment-456'
});
```

#### Write Subject Data
```rust
#[tauri::command]
fn write_subject_data(subject_id: String, data: String) -> Result<(), String>
```
Writes assessment-specific data.

**Parameters**:
- `subject_id`: String - Subject and assessment ID
- `data`: String - JSON assessment data

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('write_subject_data', {
  subjectId: 'subject-123-assessment-456',
  data: JSON.stringify(assessmentData, null, 2)
});
```

### Student Data Commands

#### Read Student Evaluation
```rust
#[tauri::command]
fn read_student_evaluation(student_id: String, assessment_id: String) -> Result<String, String>
```
Reads student evaluation data for a specific assessment.

**Parameters**:
- `student_id`: String - Student identifier
- `assessment_id`: String - Assessment identifier

**Returns**:
- `Result<String, String>` - JSON evaluation data

**Usage**:
```javascript
const data = await invoke('read_student_evaluation', {
  studentId: 'student-123',
  assessmentId: 'assessment-456'
});
```

#### Write Student Evaluation
```rust
#[tauri::command]
fn write_student_evaluation(student_id: String, assessment_id: String, data: String) -> Result<(), String>
```
Writes student evaluation data for a specific assessment.

**Parameters**:
- `student_id`: String - Student identifier
- `assessment_id`: String - Assessment identifier
- `data`: String - JSON evaluation data

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('write_student_evaluation', {
  studentId: 'student-123',
  assessmentId: 'assessment-456',
  data: JSON.stringify(evaluationData, null, 2)
});
```

#### Read Student Paragraphs
```rust
#[tauri::command]
fn read_student_paragraphs(student_id: String) -> Result<String, String>
```
Reads all paragraphs associated with a student.

**Parameters**:
- `student_id`: String - Student identifier

**Returns**:
- `Result<String, String>` - JSON paragraph data

**Usage**:
```javascript
const data = await invoke('read_student_paragraphs', {
  studentId: 'student-123'
});
```

#### Write Student Paragraphs
```rust
#[tauri::command]
fn write_student_paragraphs(student_id: String, data: String) -> Result<(), String>
```
Writes all paragraphs associated with a student.

**Parameters**:
- `student_id`: String - Student identifier
- `data`: String - JSON paragraph data

**Returns**:
- `Result<(), String>` - Success or error message

**Usage**:
```javascript
await invoke('write_student_paragraphs', {
  studentId: 'student-123',
  data: JSON.stringify(paragraphData, null, 2)
});
```

### PDF Generation

#### Generate PDF File
```rust
#[tauri::command]
fn generate_pdf_file(
    content: String,
    subject_name: Option<String>,
    assessment_name: Option<String>,
    student_name: Option<String>,
) -> Result<String, String>
```
Generates a PDF file with the specified content.

**Parameters**:
- `content`: String - PDF content (text)
- `subject_name`: Option<String> - Subject name for header
- `assessment_name`: Option<String> - Assessment name for header
- `student_name`: Option<String> - Student name for header

**Returns**:
- `Result<String, String>` - Path to generated PDF file

**Usage**:
```javascript
const pdfPath = await invoke('generate_pdf_file', {
  content: selectedText,
  subjectName: 'Studio 6',
  assessmentName: 'Mid-PDR',
  studentName: 'John Doe'
});
```

## Frontend API Functions

### Data Management

#### Save All Application Data
```javascript
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
```

#### Load All Application Data
```javascript
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

### Student Management

#### Add New Student
```javascript
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
```

#### Select Student
```javascript
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

### Assessment Management

#### Add Assessment to Subject
```javascript
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
```

#### Update Assessment Weight
```javascript
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

### Unique ID-Based Paragraph Management

#### Generate Unique ID
```javascript
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
```
Generates a unique string identifier for paragraphs.

**Returns**:
- `string` - Unique ID combining random string and timestamp

**Usage**:
```javascript
const paragraphId = generateId();
```

#### Ensure Paragraphs Have IDs
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
Migrates existing paragraphs to include unique IDs for backward compatibility.

**Parameters**:
- `paragraphs`: Array - Array of paragraph objects or strings

**Returns**:
- `Array` - Array of paragraph objects with unique IDs

**Usage**:
```javascript
const migratedParagraphs = ensureParagraphsHaveIds(paragraphs);
```

#### Toggle Paragraph Selection (ID-Based)
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
Toggles paragraph selection using unique IDs instead of array indices.

**Parameters**:
- `index`: number - Array index of the paragraph

**Usage**:
```javascript
toggleParagraph(0); // Toggle first paragraph
```

#### Check Category Has Selected Paragraphs (ID-Based)
```javascript
function checkCategoryHasSelectedParagraphs(category) {
  for (const selectedId of selectedParagraphs) {
    const paragraph = paragraphs.find(p => p.id === selectedId)
    if (paragraph) {
      const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
      if (paragraphText.includes(`${category}:`)) {
        return true
      }
    }
  }
  return false
}
```
Checks if any selected paragraphs belong to a specific category using ID-based lookup.

**Parameters**:
- `category`: string - Category name to check

**Returns**:
- `boolean` - True if category has selected paragraphs

**Usage**:
```javascript
const hasSelected = checkCategoryHasSelectedParagraphs('Strengths');
```

#### Delete Paragraph (ID-Based)
```javascript
function deleteParagraph(index) {
  const deletedParagraphId = paragraphs[index]?.id
  paragraphs.splice(index, 1)
  if (deletedParagraphId) {
    selectedParagraphs.delete(deletedParagraphId)
    selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
  }
  saveAssessmentData()
}
```
Deletes a paragraph and removes its ID from selected paragraphs.

**Parameters**:
- `index`: number - Array index of the paragraph to delete

**Usage**:
```javascript
deleteParagraph(2); // Delete third paragraph
```

#### Merge Paragraphs (ID-Based)
```javascript
function mergeParagraphs(assignmentParagraphs, studentParagraphs) {
  const merged = [...assignmentParagraphs]
  for (const studentPara of studentParagraphs) {
    const studentId = studentPara?.id
    const studentText = typeof studentPara === 'string' ? studentPara : studentPara.text
    const existsById = assignmentParagraphs.some(assignmentPara =>
      assignmentPara?.id === studentId
    )
    const existsByText = assignmentParagraphs.some(assignmentPara => {
      const assignmentText = typeof assignmentPara === 'string' ? assignmentPara : assignmentPara.text
      return assignmentText === studentText
    })
    if (!existsById && !existsByText) {
      merged.push(studentPara)
    }
  }
  return merged
}
```
Merges assignment and student paragraphs using ID-based duplicate detection.

**Parameters**:
- `assignmentParagraphs`: Array - Assignment-level paragraphs
- `studentParagraphs`: Array - Student-level paragraphs

**Returns**:
- `Array` - Merged paragraph array without duplicates

**Usage**:
```javascript
const merged = mergeParagraphs(assignmentParagraphs, studentParagraphs);
```

#### Map Selections to Merged Paragraphs (ID-Based)
```javascript
function mapSelectionsToMergedParagraphs(savedSelections, assignmentParagraphs, studentParagraphs, mergedParagraphs) {
  const mappedSelections = new Set()
  const assignmentParagraphMap = new Map()
  assignmentParagraphs.forEach(para => {
    if (para && para.id) {
      assignmentParagraphMap.set(para.id, para)
    }
  })
  const studentParagraphMap = new Map()
  studentParagraphs.forEach(para => {
    if (para && para.id) {
      studentParagraphMap.set(para.id, para)
    }
  })
  const mergedParagraphMap = new Map()
  mergedParagraphs.forEach(para => {
    if (para && para.id) {
      mergedParagraphMap.set(para.id, para)
    }
  })
  for (const savedId of savedSelections) {
    if (mergedParagraphMap.has(savedId)) {
      mappedSelections.add(savedId)
    }
  }
  return mappedSelections
}
```
Maps saved paragraph selections (IDs) to merged paragraph array using ID-based matching.

**Parameters**:
- `savedSelections`: Set - Set of saved paragraph IDs
- `assignmentParagraphs`: Array - Assignment-level paragraphs
- `studentParagraphs`: Array - Student-level paragraphs
- `mergedParagraphs`: Array - Merged paragraph array

**Returns**:
- `Set` - Set of mapped paragraph IDs

**Usage**:
```javascript
const mappedSelections = mapSelectionsToMergedParagraphs(
  savedSelections, 
  assignmentParagraphs, 
  studentParagraphs, 
  mergedParagraphs
);
```

### Paragraph Management

#### Add Paragraph
```javascript
function addParagraph() {
  if (newParagraph.trim()) {
    let paragraphText = newParagraph.trim();
    
    // Add category prefix if selected
    if (needsCategorySelection() && selectedCategory) {
      paragraphText = `${selectedCategory}: ${paragraphText}`;
    }
    
    // Add knowledge area prefix if selected
    if (selectedKnowledgeArea) {
      paragraphText = `${paragraphText} - ${selectedKnowledgeArea}`;
    }
    
    paragraphs.push({
      text: paragraphText,
      color: selectedColor || undefined
    });
    
    newParagraph = '';
    selectedKnowledgeArea = '';
    
    // Save to both assignment and student storage
    saveAssessmentData();
    if (currentStudentId) {
      saveStudentParagraphs();
    }
  }
}
```

#### Edit Paragraph
```javascript
function startEditParagraph(index) {
  editingParagraphIndex = index;
  // Extract only the main text content (without category and knowledge area prefixes)
  editingParagraphText = extractMainTextFromParagraph(paragraphs[index].text);
}

function saveEditParagraph() {
  if (editingParagraphIndex !== null && editingParagraphText.trim()) {
    // Reconstruct the paragraph text with original prefixes
    const originalText = paragraphs[editingParagraphIndex].text;
    const newText = reconstructParagraphText(originalText, editingParagraphText.trim());
    paragraphs[editingParagraphIndex].text = newText;
    editingParagraphIndex = null;
    editingParagraphText = '';
    
    // Save to both assignment and student storage
    saveAssessmentData();
    if (currentStudentId) {
      saveStudentParagraphs();
    }
  }
}

function cancelEditParagraph() {
  editingParagraphIndex = null;
  editingParagraphText = '';
}
```

#### Paragraph Text Processing
```javascript
// Extract main text from paragraph (without prefixes)
function extractMainTextFromParagraph(paragraphText) {
  let text = paragraphText;
  
  // Remove category prefix (format: "Category: text")
  if (text.includes(': ')) {
    const parts = text.split(': ');
    if (parts.length >= 2) {
      text = parts.slice(1).join(': ');
    }
  }
  
  // Remove knowledge area suffix (format: "text - Knowledge Area")
  if (text.includes(' - ')) {
    const parts = text.split(' - ');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (!lastPart.includes(':')) {
        text = parts.slice(0, -1).join(' - ');
      }
    }
  }
  
  return text;
}

// Reconstruct paragraph text with original prefixes
function reconstructParagraphText(originalText, newMainText) {
  let categoryPrefix = '';
  let knowledgeAreaSuffix = '';
  
  // Extract category prefix from original text
  if (originalText.includes(': ')) {
    const parts = originalText.split(': ');
    if (parts.length >= 2) {
      categoryPrefix = parts[0] + ': ';
    }
  }
  
  // Extract knowledge area suffix from original text
  if (originalText.includes(' - ')) {
    const parts = originalText.split(' - ');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (!lastPart.includes(':')) {
        knowledgeAreaSuffix = ' - ' + lastPart;
      }
    }
  }
  
  // Reconstruct: Category: MainText - KnowledgeArea
  return categoryPrefix + newMainText + knowledgeAreaSuffix;
}
```

#### Delete Paragraph
```javascript
function deleteParagraph(index) {
  // Remove from paragraphs array (assignment level only)
  paragraphs.splice(index, 1);
  
  // Update selected paragraphs indices
  const newSelectedParagraphs = new Set();
  selectedParagraphs.forEach(selectedIndex => {
    if (selectedIndex < index) {
      newSelectedParagraphs.add(selectedIndex);
    } else if (selectedIndex > index) {
      newSelectedParagraphs.add(selectedIndex - 1);
    }
  });
  selectedParagraphs = newSelectedParagraphs;
  
  // Save assignment data (without the deleted paragraph)
  saveAssessmentData();
}
```

### PDF Generation

#### Generate PDF with Auto-Save
```javascript
async function generatePDF() {
  const selectedText = getSelectedText();
  if (!selectedText) {
    showSuccessNotification('No paragraphs selected!');
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
    await saveStudentEvaluation();
  }
  
  showSuccessNotification('PDF generated and downloaded successfully!');
}
```

### Student Data Loading and Merging

#### Load Student Evaluation with Merging
```javascript
async function loadStudentEvaluation() {
  if (!currentStudentId || !currentAssessmentId) return;

  // First, load assignment paragraphs (including edited ones)
  await loadAssessmentData(currentSubjectId, currentAssessmentId);
  const assignmentParagraphs = [...paragraphs];

  // Then, load student paragraphs
  await loadStudentParagraphs();
  const studentParagraphs = [...paragraphs];

  // Merge assignment and student paragraphs (avoid duplicates)
  const mergedParagraphs = mergeParagraphs(assignmentParagraphs, studentParagraphs);
  paragraphs = mergedParagraphs;

  // Load evaluation data to get selections and marks
  let savedSelectedParagraphs = new Set();
  let savedStudentName = '';
  let savedStudentImage = '';
  let savedCategoryMarks = {};
  let savedManualTotalMarks = '';

  try {
    const data = await invoke('read_student_evaluation', { 
      studentId: currentStudentId,
      assessmentId: currentAssessmentId
    });
    if (data) {
      const evaluationData = JSON.parse(data);
      savedSelectedParagraphs = new Set(evaluationData.selectedParagraphs || []);
      savedStudentName = evaluationData.studentName || '';
      savedStudentImage = evaluationData.studentImage || '';
      savedCategoryMarks = evaluationData.categoryMarks || {};
      savedManualTotalMarks = evaluationData.manualTotalMarks || '';
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
  );

  // Apply the mapped selections and marks
  selectedParagraphs = mappedSelections;
  studentName = savedStudentName;
  studentImage = savedStudentImage;
  categoryMarks = savedCategoryMarks;
  manualTotalMarks = savedManualTotalMarks;
}
```

#### Merge Paragraphs
```javascript
function mergeParagraphs(assignmentParagraphs, studentParagraphs) {
  const merged = [...assignmentParagraphs];
  
  // Add student paragraphs that don't already exist in assignment
  for (const studentPara of studentParagraphs) {
    const studentText = typeof studentPara === 'string' ? studentPara : studentPara.text;
    const exists = assignmentParagraphs.some(assignmentPara => {
      const assignmentText = typeof assignmentPara === 'string' ? assignmentPara : assignmentPara.text;
      return assignmentText === studentText;
    });
    
    if (!exists) {
      merged.push(studentPara);
    }
  }
  
  return merged;
}
```

#### Map Selections to Merged Paragraphs
```javascript
function mapSelectionsToMergedParagraphs(savedSelections, assignmentParagraphs, studentParagraphs, mergedParagraphs) {
  const mappedSelections = new Set();
  
  // Create maps to find paragraph text by index
  const assignmentTexts = assignmentParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  );
  const studentTexts = studentParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  );
  const mergedTexts = mergedParagraphs.map(para => 
    typeof para === 'string' ? para : para.text
  );
  
  // Map each saved selection
  for (const savedIndex of savedSelections) {
    let paragraphText = null;
    
    // First, try to find in assignment paragraphs
    if (savedIndex < assignmentTexts.length) {
      paragraphText = assignmentTexts[savedIndex];
    }
    // If not found in assignment, try student paragraphs
    else if (savedIndex - assignmentTexts.length < studentTexts.length) {
      const studentIndex = savedIndex - assignmentTexts.length;
      paragraphText = studentTexts[studentIndex];
    }
    
    // If we found the paragraph text, find its new index in merged array
    if (paragraphText) {
      const newIndex = mergedTexts.findIndex(text => text === paragraphText);
      if (newIndex !== -1) {
        mappedSelections.add(newIndex);
      }
    }
  }
  
  return mappedSelections;
}
```

## Data Structures

### Main Configuration
```typescript
interface MainConfig {
  subjects: Subject[];
  students: Student[];
  percentageRanges: PercentageRange[];
  lastSaved: string;
}
```

### Subject
```typescript
interface Subject {
  id: string;
  name: string;
  assessments: Assessment[];
}
```

### Assessment
```typescript
interface Assessment {
  id: string;
  name: string;
  topics?: Topic[];
  categories?: Category[];
  weight?: number;
}
```

### Student
```typescript
interface Student {
  id: string;
  name: string;
  studentId: string;
  displayName: string;
  createdAt: string;
}
```

### Paragraph
```typescript
interface Paragraph {
  id: string;        // Unique identifier for reliable tracking
  text: string;
  color?: string;
}
```

### Student Evaluation Data
```typescript
interface StudentEvaluationData {
  studentId: string;
  assessmentId: string;
  paragraphs: Paragraph[];
  selectedParagraphs: string[];  // Now stores paragraph IDs instead of indices
  studentName: string;
  studentImage: string;
  categoryMarks: Record<string, string>;
  manualTotalMarks: string;
  savedAt: string;
}
```

### Student Paragraph Data
```typescript
interface StudentParagraphData {
  studentId: string;
  paragraphs: Paragraph[];
  savedAt: string;
}
```

## Error Handling

### Common Error Patterns
```javascript
try {
  const data = await invoke('read_file', { path: 'file.json' });
  // Process data
} catch (error) {
  console.error('Failed to read file:', error);
  // Handle error gracefully
}
```

### Fallback Strategies
```javascript
// Try Tauri first, fallback to localStorage
try {
  await invoke('write_file', { path: 'data.json', content: data });
} catch (error) {
  console.log('Tauri not available, using browser storage');
  localStorage.setItem('feedback-data', data);
}
```

## Performance Considerations

### Batch Operations
```javascript
// Batch multiple state updates
function batchUpdateState() {
  subjects = newSubjects;
  students = newStudents;
  percentageRanges = newRanges;
  // Single save operation
  saveData();
}
```

### Memory Management
```javascript
// Clear unused images from memory
function clearUnusedImages() {
  if (currentStudentId !== previousStudentId) {
    previousStudentImage = null;
  }
}
```

### Efficient Data Loading
```javascript
// Load data only when needed
async function loadStudentData() {
  if (!currentStudentId || !currentAssessmentId) return;
  // Load data
}
```
