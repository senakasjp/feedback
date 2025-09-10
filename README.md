# Feedback Manager

A portable desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization and PDF generation capabilities.

## Application Structure

The application follows a hierarchical structure:

```
Subject (1 or more)
├── Assessment (0 or more)
    ├── Category (0 or more)
        └── Paragraph (0 or more)
```

### 🏗️ Hierarchical Organization
- **Subjects**: Top-level containers (e.g., "Studio 6", "Mathematics")
- **Assessments**: Specific evaluations within subjects (e.g., "Mid-PDR", "Final Exam")
- **Categories**: Feedback classification within assessments (e.g., "Strengths", "Areas for Improvement")
- **Paragraphs**: Individual feedback statements under categories

## Features

### 📚 Subject Management
- **Add/Remove Subjects**: Create and delete subjects with confirmation
- **Subject Overview**: View all subjects in a clean card layout
- **Assessment Count**: See number of assessments per subject

### 📝 Assessment Management
- **Add/Remove Assessments**: Create and delete assessments within subjects
- **Category Management**: Add, edit, and remove categories for each assessment
- **Topic Management**: Organize feedback with topics and categories
- **Reusable Categories**: Categories created for an assessment can be used for all students

### 🏷️ Universal Category System
- **Universal Support**: Works with any assessment type, not just PDR assessments
- **Custom Categories**: Create categories specific to each assessment
- **Dynamic Detection**: Automatically enables category selection when categories are defined
- **Category Grouping**: Paragraphs grouped by category with headers and marks input
- **Fallback Handling**: Legacy paragraphs grouped under "General Feedback"
- **Visual Indicators**: Categories displayed as blue headers in feedback sections

### 📝 Feedback Management
- **Add Paragraphs**: Create feedback paragraphs with category and topic selection
- **Checkbox Selection**: Select specific paragraphs for inclusion in reports
- **Live Preview**: See selected paragraphs in a dedicated section
- **Auto-save**: All data is automatically saved as you work

### 🎯 Marks Management System
- **Individual Category Marks**: Enter marks for each category at first appearance
- **Total Marks Input**: Right-aligned input box in "Paragraphs" header
- **PDF Integration**: Displays marks in professional slash format (calculated/manual)
- **Warning System**: Popup alert when marks are incomplete
- **Real-time Calculation**: Automatic total marks calculation from individual categories
- **Persistent Storage**: Marks saved with assessment data

### 📊 Universal Percentage Ranges
- **Universal Access**: Available across all views (subjects, assessments, feedback)
- **Custom Ranges**: Create percentage ranges with value, color, and percentage bounds
- **Color Coding**: Visual indicators with 5 color options (red, orange, yellow, light green, green)
- **Automatic Calculation**: Calculates actual value ranges based on percentage inputs
- **Persistent Storage**: Ranges saved globally and persist across app sessions
- **Real-time Display**: Shows calculated ranges with color indicators
- **Easy Management**: Add and delete ranges with simple form interface
- **Cross-Session Persistence**: Data automatically loads when app reopens

### 👤 Student Information
- **Student Name**: Enter and store student names
- **Photo Upload**: Upload and display student photos
- **Image Preview**: 60x60px thumbnail preview in the interface
- **Persistent Storage**: Photos are saved as base64 data

### 📄 PDF Generation
- **Professional Reports**: Generate PDF reports with selected feedback
- **Full-Width Header**: Student photos span the entire page width (edge-to-edge)
- **Aspect Ratio Preserved**: Images maintain proportions while filling page width
- **Dynamic Filename**: PDFs named automatically (e.g., `feedback-report-John-Doe.pdf`)
- **Clean Layout**: Professional formatting with proper spacing and typography

### 💾 Data Persistence
- **Portable Storage**: Data stored in local `FeedbackData` folder next to executable
- **Cross-Platform**: Copy entire app folder between computers with data intact
- **JSON Format**: Human-readable data storage with hierarchical structure
- **Auto-backup**: No manual save required - all changes saved automatically
- **Tauri File System API**: Uses Rust-based file operations for reliability
- **Base64 Image Storage**: Student photos stored as base64-encoded strings in JSON
- **Individual Assessment Files**: Each assessment gets its own JSON file for better organization

## Technology Stack

- **Frontend**: Svelte 5 with modern reactivity (`$state`)
- **Desktop Framework**: Tauri (Rust backend)
- **UI Framework**: Bootstrap 5 with Sveltestrap components
- **PDF Generation**: jsPDF library
- **Build Tool**: Vite
- **File System**: Tauri filesystem plugins

## Data Storage Technology

### 🗄️ Storage Architecture
The application uses a **file-based storage system** built on Tauri's Rust file system API:

#### **Core Storage Components:**
- **Main Data File**: `FeedbackData/feedback-data.json` - Contains subjects, assessments, categories, and knowledge areas
- **Individual Assessment Files**: `FeedbackData/subject-{id}-{timestamp}.json` - Student-specific data for each assessment
- **Portable Structure**: All data stored relative to executable location for easy distribution

#### **Technical Implementation:**
- **Rust Backend**: File operations handled by Tauri's Rust backend for performance and reliability
- **JSON Serialization**: Data serialized to/from JSON format for human readability
- **Base64 Encoding**: Images converted to base64 strings for embedded storage
- **Atomic Writes**: File operations use proper locking to prevent data corruption
- **Cross-Platform Paths**: Tauri handles Windows (`\`), macOS/Linux (`/`) path differences automatically

#### **Data Flow:**
1. **Frontend Changes** → Svelte state updates
2. **State Change Detection** → Automatic save triggers
3. **Tauri Invoke** → Frontend calls Rust backend functions
4. **Rust File Operations** → Write to JSON files
5. **Error Handling** → Graceful failure with user feedback

#### **File Structure:**
```
FeedbackData/
├── feedback-data.json              # Main configuration data
├── subject-abc123-1234567890.json  # Assessment 1 data
├── subject-def456-1234567891.json  # Assessment 2 data
└── subject-ghi789-1234567892.json  # Assessment 3 data
```

#### **Data Persistence Features:**
- **Auto-Save**: Every state change automatically triggers save
- **No Manual Save**: Users never need to manually save data
- **Crash Recovery**: Data persists even if application crashes
- **Version Control Friendly**: JSON format works well with Git
- **Backup Simple**: Copy entire folder to backup all data
- **Migration Easy**: JSON files can be edited or migrated programmatically

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Rust (latest stable)
- npm or yarn

### Development Setup
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

### Production Use
1. Run `npm run tauri build`
2. Find the executable in `src-tauri/target/release/`
3. Copy the entire app folder to any computer
4. Data is stored in `FeedbackData/feedback.txt` alongside the executable

## Usage

### Getting Started
1. **Launch the app** - Open the executable or run `npm run dev`
2. **Create Subjects** - Add subjects to organize your feedback (e.g., "Studio 6", "Mathematics")
3. **Create Assessments** - Add assessments within subjects (e.g., "Mid-PDR", "Final Exam")
4. **Set up Categories** - Create categories for each assessment to organize feedback

### Workflow
1. **Subject Management** - Start by creating subjects
2. **Assessment Management** - Add assessments to subjects
3. **Category Setup** - Create categories for each assessment
4. **Feedback Creation** - Add paragraphs with category and topic selection
5. **Report Generation** - Select paragraphs and generate PDFs

### Creating Feedback
1. **Select Assessment** - Choose an assessment to work with
2. **Enter student name** - Fill in the student name field
3. **Upload photo** - Click "Choose File" to select a student photo
4. **Choose category** - Select from assessment's predefined categories
5. **Choose topic** - Select from assessment's topics (optional)
6. **Add feedback** - Type feedback paragraphs and click "Add"

### Creating Reports
1. **Select paragraphs** - Check the boxes next to desired feedback
2. **Preview selection** - View selected text in the bottom panel
3. **Generate PDF** - Click "📄 Generate PDF" button
4. **Copy text** - Use "📋 Copy to Clipboard" for other uses

### Managing Percentage Ranges
1. **Access Ranges** - Navigate to any view (subjects, assessments, or feedback)
2. **Add New Range** - Fill in the percentage range form in the sidebar:
   - **Value**: Enter the base value (e.g., 100 for 100 points)
   - **Lower %**: Enter lower percentage (0-100)
   - **Upper %**: Enter upper percentage (0-100)
   - **Color**: Select from 5 color options (red, orange, yellow, light green, green)
3. **View Ranges** - See calculated ranges with color indicators
4. **Delete Ranges** - Click the trash icon to remove unwanted ranges
5. **Universal Access** - Ranges are available across all views and persist between sessions

### PDF Output
- **Header Image**: Student photo spans full page width at the top
- **Title**: "Feedback Report"
- **Student Info**: Student name displayed prominently
- **Content**: Selected feedback paragraphs with proper formatting
- **Multi-page**: Automatically handles long content across pages

## File Structure

```
feedback-app/
├── src/                    # Svelte frontend source
│   ├── App.svelte         # Main application component
│   ├── main.js            # Application entry point
│   └── app.css            # Global styles
├── src-tauri/             # Tauri backend
│   ├── src/
│   │   └── lib.rs         # Rust backend with file system commands
│   ├── tauri.conf.json    # Tauri configuration
│   └── capabilities/      # Permission definitions
├── FeedbackData/          # Data storage (created at runtime)
│   └── feedback.txt       # JSON data file
└── package.json           # Node.js dependencies
```

## Data Format

The application stores data in JSON format with hierarchical structure:

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
          "topics": [
            {
              "id": "topic-1",
              "name": "Design Process"
            }
          ],
          "categories": [
            {
              "id": "category-1",
              "name": "Strengths",
              "description": "Positive aspects of student work"
            },
            {
              "id": "category-2",
              "name": "Areas for Improvement",
              "description": "Areas where student can improve"
            }
          ]
        }
      ]
    }
  ],
  "knowledgeAreas": ["Prior Experience", "Student Specific Comments"],
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

## Data Structure Relationships

The application follows a **many-to-many relationship model** where students can be enrolled in multiple subjects, and each subject contains multiple assessments:

### 📊 Entity Relationships

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

### 🔗 Key Relationships

- **Student ↔ Subject**: **Many-to-Many** - A student can take multiple subjects, and a subject can have multiple students
- **Subject ↔ Assessment**: **One-to-Many** - Each subject contains multiple assessments, each assessment belongs to one subject
- **Student ↔ Assessment**: **Many-to-Many** - A student can be evaluated on multiple assessments across different subjects

### 💾 Data Storage Structure

#### Global Data (`feedback-data.json`)
- **Subjects**: Array of all subjects with their assessments
- **Students**: Array of all registered students
- **Knowledge Areas**: Global knowledge area definitions
- **Categories**: Global category templates
- **Percentage Ranges**: Universal percentage range definitions

#### Subject-Specific Data (`subject-{subjectId}-{assessmentId}.json`)
- **Assessment Details**: Topics, categories, and configuration
- **Feedback Paragraphs**: All available feedback content
- **Selected Paragraphs**: Indices of currently selected content

#### Student Evaluation Data (`student-evaluation-{studentId}-{assessmentId}.json`)
- **Student-Specific Content**: Individual evaluation data per student-assessment combination
- **Selected Paragraphs**: Student-specific paragraph selections
- **Marks**: Category marks and total marks for the student
- **Student Information**: Name, photo, and metadata

### 🎯 Practical Implications

This structure allows for:
- **Multi-Subject Support**: Students can be evaluated across different academic subjects
- **Flexible Assessment Management**: Each subject can have its own set of assessments
- **Individual Student Tracking**: Each student's progress is tracked separately per assessment
- **Data Isolation**: Student evaluations are stored independently, preventing data conflicts
- **Scalable Organization**: Easy to add new subjects, assessments, and students without affecting existing data

### Assessment Data Format
Each assessment stores student-specific data:

```json
{
  "paragraphs": [
    "Student shows excellent understanding...",
    "Areas for improvement include..."
  ],
  "selectedParagraphs": [0, 1],
  "studentName": "John Doe",
  "studentImage": "data:image/jpeg;base64,..."
}
```

## Key Features Detail

### Portable Data Storage
- **Tauri File System API**: Uses Rust-based file operations for cross-platform compatibility
- **Relative Path Storage**: Data stored relative to executable location (`./FeedbackData/`)
- **No External Dependencies**: No database server or external files required
- **JSON-Based Architecture**: Human-readable data format for easy debugging and migration
- **Individual File Strategy**: Each assessment stored in separate JSON file for better organization
- **Base64 Image Encoding**: Student photos embedded directly in JSON files
- **Automatic File Creation**: Creates necessary directories and files on first run
- **Cross-Platform Path Handling**: Tauri handles Windows/macOS/Linux path differences
- **Atomic Write Operations**: Data integrity ensured through proper file locking
- **Easy Backup**: Simply copy the entire app folder to preserve all data

### Image Handling
- Accepts all common image formats (JPEG, PNG, GIF, WebP)
- Converts to base64 for storage
- Maintains aspect ratio in PDF output
- Full-width presentation for maximum impact

### PDF Generation
- Client-side generation (no server required)
- Professional formatting
- Automatic page breaks
- Edge-to-edge image headers
- Responsive text wrapping

## Browser Support (Development)

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Building for Distribution

### Desktop App
```bash
npm run tauri build
```

Produces platform-specific executables:
- Windows: `.exe` installer and portable
- macOS: `.app` bundle and `.dmg`
- Linux: `.deb`, `.rpm`, and `.AppImage`

### Development
```bash
npm run dev        # Web development
npm run tauri dev  # Desktop development with hot reload
```

## Troubleshooting

### Common Issues

**"Permission denied" errors**
- Ensure proper file system permissions in `capabilities/default.json`

**Images not displaying in PDF**
- Check image format compatibility
- Verify image size (very large images may cause issues)

**Data not persisting**
- Check if `FeedbackData` folder has write permissions
- Verify Tauri file system plugin is properly configured

**Confirmation dialogs not appearing (Tauri on Mac/Windows)**
- Browser `alert()` and `confirm()` dialogs often don't work in Tauri apps
- Solution: Use custom Bootstrap 5 modals instead of native browser dialogs
- Example implementation:

```svelte
<!-- Custom confirmation dialog -->
{#if showDeleteConfirm && subjectToDelete}
  <div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-danger text-white">
          <h5 class="modal-title">
            <i class="bi bi-exclamation-triangle me-2"></i>Confirm Deletion
          </h5>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning">
            <i class="bi bi-warning me-2"></i>
            <strong>Warning:</strong> This action cannot be undone.
          </div>
          <p class="mb-0">Are you sure you want to delete this item?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={cancelAction}>
            <i class="bi bi-x-circle me-2"></i>Cancel
          </button>
          <button type="button" class="btn btn-danger" onclick={confirmAction}>
            <i class="bi bi-trash me-2"></i>Delete
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
```

**State management for custom dialogs:**
```javascript
// Add to component state
let showDeleteConfirm = $state(false);
let itemToDelete = $state(null);

// Show dialog function
function showConfirmDialog(item) {
  itemToDelete = item;
  showDeleteConfirm = true;
}

// Confirm action
function confirmAction() {
  // Perform deletion
  deleteItem(itemToDelete);
  // Close dialog
  showDeleteConfirm = false;
  itemToDelete = null;
}

// Cancel action
function cancelAction() {
  showDeleteConfirm = false;
  itemToDelete = null;
}
```

### Development Issues

**Sveltestrap warnings**
- Use `--legacy-peer-deps` flag for npm install
- Warnings about Svelte 5 compatibility are expected

**Build failures**
- Ensure Rust toolchain is properly installed
- Check Tauri CLI version compatibility

## License

This project is open source. See the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## PDF Font Standardization

### 🎯 PDF Typography Optimization (v1.4.0)

The PDF output now uses **10px as the standard font size** for consistent, compact formatting:

#### **PDF Output Font Sizes:**
- **Headers**: 10px bold (Subject, Assessment, Student)
- **Category headers**: 10px bold (Sub Objectives, Sub Learning Objectives, Report, Decision)
- **Content text**: 10px normal weight
- **All elements**: Uniform 10px sizing throughout PDF

#### **Interface Font Sizes (Unchanged):**
- **Base font**: 14px for body text
- **Forms/Labels**: 13px for optimal readability
- **Buttons**: 13px regular, 12px for small buttons
- **Headers**: H1: 28px, H2: 24px, H3: 20px, H4: 18px, H5: 16px, H6: 14px
- **Cards**: 13px content, 16px titles
- **Special elements**: Subject cards (22px titles), Assessment cards (20px titles)

#### **Benefits:**
- ✅ **Compact PDF output** with maximum information density
- ✅ **Professional PDF appearance** with uniform typography
- ✅ **Readable interface** with comfortable font sizes
- ✅ **Optimized for different contexts** - screen vs. print
- ✅ **Small PDF file sizes** due to consistent formatting

This approach optimizes PDF output for print density while maintaining comfortable screen readability.

## Universal Category System & Marks Management

### 🏷️ Universal Category Support (v2.1.0)

The application now supports **universal category management** for any assessment type, not just specific PDR assessments:

#### **Category System Features:**
- **Universal Detection**: Any assessment with categories defined will automatically enable category selection
- **Dynamic Category Lists**: Uses assessment-specific categories instead of hardcoded lists
- **Fallback Support**: Existing PDR assessments continue to work with their predefined categories
- **Default Grouping**: Paragraphs without categories are grouped under "General Feedback"

#### **Marks Management System:**
- **Individual Category Marks**: Enter marks for each category at its first appearance
- **Total Marks Input**: Right-aligned input box in the "Paragraphs" header
- **PDF Integration**: Displays marks in slash format (calculated/manual total)
- **Warning System**: Popup alert when individual marks are entered but total marks field is empty

#### **Category Workflow:**
1. **Create Assessment**: Add categories to any assessment
2. **Select Category**: Choose from dropdown when adding paragraphs
3. **Add Paragraphs**: Text is automatically prefixed with selected category
4. **Enter Marks**: Assign marks to categories and total marks
5. **Generate PDF**: Marks appear in professional format with slash notation

#### **Marks Display Format:**
- **Individual Categories**: `[X MARKS]` after category name in PDF
- **Total Marks**: `Total Marks: 15/100` (calculated/manual total)
- **GUI Display**: Shows total marks in red alert box above selected paragraphs

#### **Backward Compatibility:**
- **Legacy Paragraphs**: Automatically grouped under "General Feedback" if no category prefix
- **PDR Assessments**: Continue to work with existing hardcoded categories
- **Data Migration**: No data loss when upgrading to universal system

### **Technical Implementation:**
- **Dynamic Detection**: `needsCategorySelection()` checks for assessment categories
- **Flexible Grouping**: `getGroupedParagraphs()` handles any category format
- **State Management**: Marks stored per category and total marks separately
- **PDF Generation**: Universal category detection with bold formatting

## Student Management System

### 👥 Comprehensive Student Management (v2.2.0)

The application now includes a **complete student management system** that allows you to save and load student evaluation data, replacing manual student name entry with a structured database approach.

#### **Core Student Management Features:**
- **Student Database**: Centralized storage of all students with unique IDs
- **Student Selection**: Dropdown-based student selection instead of manual name entry
- **Data Persistence**: Individual student evaluation data saved per assessment
- **Auto-Save Integration**: Automatic saving when generating PDFs
- **Student Information Display**: Visual confirmation of selected student

#### **Student Data Structure:**
```javascript
{
  id: "unique-student-id",
  name: "Student Name",
  studentId: "STU12345",
  displayName: "Student Name (STU12345)",
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

#### **Student Management UI Components:**

##### **1. Student Selection Interface:**
- **Dropdown Selection**: Choose from registered students
- **Add Student Button**: Quick access to add new students (+ icon)
- **Student Manager Button**: Full management interface (⚙️ icon)
- **Selected Student Display**: Blue info box showing current selection

##### **2. Student Management Modal:**
- **Student List**: View all registered students with names and IDs
- **Select Student**: Click to choose a student for current session
- **Delete Student**: Remove students and their evaluation data
- **Add New Student**: Direct access to student creation

##### **3. Add Student Modal:**
- **Student Name Field**: Enter the student's full name
- **Student ID Field**: Enter unique identifier (e.g., student number)
- **Auto-Generated Display Name**: Combines name and ID for uniqueness
- **Validation**: Both fields required before adding

#### **Student Evaluation Data Management:**

##### **Data Storage Structure:**
```javascript
{
  studentId: "student-unique-id",
  assessmentId: "assessment-unique-id", 
  paragraphs: [...], // All feedback paragraphs
  selectedParagraphs: [...], // Indices of selected paragraphs
  studentName: "Student Name (ID)",
  studentImage: "data:image/jpeg;base64...", // Base64 encoded image
  categoryMarks: { // Individual category marks
    "Category 1": "10",
    "Category 2": "15"
  },
  manualTotalMarks: "25", // Manually entered total
  savedAt: "2024-01-01T00:00:00.000Z"
}
```

##### **Save/Load Functionality:**
- **Save Student Data**: Manual save button in sidebar
- **Load Student Data**: Restore previous evaluation work
- **Auto-Save on PDF**: Automatically saves when generating PDF
- **Individual Files**: Each student-assessment combination gets separate file
- **Data Recovery**: Load any previous work for any student

#### **File Storage System:**

##### **Main Data Files:**
- **`feedback-data.json`**: Contains subjects, assessments, and students list
- **`student-evaluation-{studentId}-{assessmentId}.json`**: Individual evaluation data

##### **Storage Locations:**
- **Tauri Desktop**: `./FeedbackData/` folder next to executable
- **Web Development**: Browser localStorage with prefixed keys
- **Cross-Platform**: Automatic path handling for Windows/macOS/Linux

#### **User Workflow:**

##### **1. Student Registration:**
1. Click "+" button next to student dropdown
2. Enter student name and ID in modal
3. Click "Add Student" to register
4. Student appears in dropdown list

##### **2. Student Selection:**
1. Choose student from dropdown
2. See confirmation in blue info box below
3. Student name updates throughout interface
4. All evaluation data tied to selected student

##### **3. Evaluation Work:**
1. Add paragraphs with categories and topics
2. Enter marks for individual categories
3. Select paragraphs for inclusion
4. Use "Save Student Data" to store progress
5. Use "Load Student Data" to restore work

##### **4. Report Generation:**
1. Generate PDF with selected content
2. Data automatically saved during PDF creation
3. Success notification confirms save operation
4. Student name included in PDF filename

#### **Technical Implementation Details:**

##### **State Management:**
```javascript
// Student data
let students = $state([]) // Array of student objects
let currentStudentId = $state(null) // Currently selected student
let studentName = $state('') // Display name for current student

// Student management UI
let showAddStudent = $state(false) // Add student modal
let showStudentManager = $state(false) // Student manager modal
let newStudentName = $state('') // New student name input
let newStudentId = $state('') // New student ID input
```

##### **Key Functions:**
```javascript
// Student management
addStudent() // Add new student to database
deleteStudent(studentId) // Remove student and data
selectStudent(studentId) // Set current student
getCurrentStudent() // Get current student object

// Data persistence
saveStudentEvaluation() // Save current evaluation data
loadStudentEvaluation() // Load saved evaluation data
saveStudents() // Save students list to main data file
```

##### **Tauri Backend Functions:**
```rust
// New Tauri commands for student data
write_student_evaluation(student_id, assessment_id, data)
read_student_evaluation(student_id, assessment_id)
```

#### **UI/UX Enhancements:**

##### **Student Selection Area:**
- **Full-Width Layout**: Student dropdown and photo upload span full card width
- **Action Buttons**: Add (+) and manage (⚙️) buttons integrated
- **Visual Feedback**: Selected student clearly displayed below dropdown
- **Responsive Design**: Works on all screen sizes

##### **Notification System:**
- **Success Toasts**: Professional notifications for all actions
- **Auto-Hide**: Notifications disappear after 3 seconds
- **Action Feedback**: Save, load, copy, and PDF operations confirmed
- **Error Handling**: Clear messages for failed operations

##### **Action Buttons:**
- **Save Student Data**: Blue button with save icon
- **Load Student Data**: Purple button with upload icon
- **Copy to Clipboard**: Green button with clipboard icon
- **Print to PDF**: Red button with download icon

#### **Data Migration & Compatibility:**
- **Backward Compatible**: Existing data continues to work
- **Automatic Migration**: Students list added to main data file
- **No Data Loss**: All existing evaluations preserved
- **Seamless Upgrade**: New features work with existing assessments

#### **Benefits of Student Management System:**
- **Organized Data**: Each student's work saved separately
- **Easy Recovery**: Load any previous evaluation work
- **Unique Identification**: Student ID prevents name conflicts
- **Professional Workflow**: Structured approach to student evaluation
- **Data Integrity**: Automatic saving prevents work loss
- **Scalable**: Handles unlimited students and assessments
- **Portable**: Copy app folder to preserve all student data

## Version History

- **v1.0.0** - Initial release with basic feedback management
- **v1.1.0** - Added PDF generation capabilities
- **v1.2.0** - Implemented student photo support
- **v1.3.0** - Full-width PDF headers and improved UI
- **v1.4.0** - PDF font standardization to 10px (interface fonts unchanged)
- **v2.0.0** - **MAJOR UPDATE**: Hierarchical organization with subjects, assessments, and categories
  - Added Subject Management (add/remove subjects)
  - Added Assessment Management (add/remove assessments)
  - Added Category Management (add/remove categories per assessment)
  - Added Topic Management (organize feedback with topics)
  - Redesigned UI with dedicated management screens
  - Categories are reusable across all students for each assessment
  - Improved data structure with hierarchical organization
- **v2.1.0** - **UNIVERSAL CATEGORY SYSTEM & MARKS MANAGEMENT**
  - Universal category support for any assessment type (not just PDR)
  - Dynamic category detection and management
  - Individual category marks input system
  - Total marks input with slash format in PDF
  - Warning system for incomplete marks entry
  - Backward compatibility with legacy paragraphs
  - Professional PDF formatting with bold category headers
  - Right-aligned marks input in "Paragraphs" header
- **v2.2.0** - **COMPREHENSIVE STUDENT MANAGEMENT SYSTEM**
  - Complete student database with unique ID system
  - Dropdown-based student selection replacing manual entry
  - Individual student evaluation data storage per assessment
  - Save/Load functionality for student evaluation work
  - Auto-save integration with PDF generation
  - Student management modals (add, view, select, delete)
  - Visual student selection confirmation display
  - Success notification system for all actions
  - Full-width student information card layout
  - Cross-platform data persistence with Tauri backend
  - Backward compatibility with existing data
  - Professional workflow for student evaluation management