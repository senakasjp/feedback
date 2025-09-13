# Development Guide

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

## Development Workflow

### 1. Setting Up Development Environment
```bash
# Clone the repository
git clone <repository-url>
cd feedback-app

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### 2. Making Changes
- Edit Svelte components in `src/`
- Modify Rust backend in `src-tauri/src/`
- Update styles in `src/app.css` or component-specific CSS
- Test changes with hot reload

### 3. Testing
- Test in development mode with `npm run tauri dev`
- Build and test production version with `npm run tauri build`
- Test on target platforms before distribution

### 4. Building for Production
```bash
# Build for current platform
npm run tauri build

# Build for specific platform (if cross-compiling is set up)
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## Unique ID-Based Paragraph Management

### Overview
The application now uses a unique ID-based system for paragraph management instead of array indices. This ensures reliable paragraph selection, editing, and tracking even when paragraphs are modified, reordered, or merged from different sources.

### Key Changes in v2.6.0

#### 1. Paragraph Object Structure
All paragraphs now include a unique `id` field:
```javascript
{
  id: "abc123def456",  // Unique identifier
  text: "Paragraph content",
  color: "green"
}
```

#### 2. ID Generation
```javascript
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
```

#### 3. Data Migration
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

#### 4. Selection System
- `selectedParagraphs` now stores unique IDs instead of array indices
- `toggleParagraph()` uses IDs for reliable selection tracking
- `checkCategoryHasSelectedParagraphs()` uses ID-based lookup

### Migration Strategy

#### Automatic Migration
The system automatically migrates existing data:
1. **Assignment Data Loading**: `loadAssessmentData()` applies `ensureParagraphsHaveIds()`
2. **Student Data Loading**: `loadStudentParagraphs()` applies `ensureParagraphsHaveIds()`
3. **Paragraph Creation**: New paragraphs automatically get unique IDs
4. **Data Merging**: ID-based duplicate detection prevents conflicts

#### Backward Compatibility
- Existing data without IDs is automatically migrated
- No manual data conversion required
- System works seamlessly with both old and new data formats

### Development Considerations

#### When Adding New Paragraph Functions
1. Always use `paragraph.id` for identification
2. Update `selectedParagraphs` using IDs, not indices
3. Apply `ensureParagraphsHaveIds()` when loading data
4. Use ID-based duplicate detection in merging functions

#### When Debugging Paragraph Issues
1. Check that paragraphs have valid IDs
2. Verify `selectedParagraphs` contains IDs, not indices
3. Use `console.log` to trace ID-based operations
4. Ensure migration functions are applied to loaded data

#### Performance Impact
- Minimal performance impact from ID generation
- Improved reliability outweighs slight overhead
- ID-based lookups are efficient with Map/Set operations

## Subject-Specific Student Management

### Overview
The application now supports removing students from specific subjects while preserving their global student records. This allows for flexible student management across multiple subjects.

### Key Features

#### Student Deletion from Subject
- **Location**: `src/lib/AssessmentManager.svelte`
- **UI Element**: Red trash button next to student name in the student list
- **Confirmation**: Professional Bootstrap modal with comprehensive warning information
- **Data Impact**: Removes all evaluation data for the student across all assessments in the current subject

#### Modal Warning System
- **Bootstrap Integration**: Uses consistent modal design patterns
- **Comprehensive Information**: Shows student details, warning alerts, and action consequences
- **User-Friendly**: Clear explanation of what will be deleted and what will be preserved
- **Accessibility**: Proper ARIA labels and semantic HTML structure

### Implementation Details

#### State Management
```javascript
let showStudentDeleteConfirm = $state(false);
let studentToDelete = $state(null);
```

#### Core Functions
- `deleteStudentFromSubject(studentId)`: Shows confirmation modal
- `confirmStudentDelete()`: Executes the deletion and data cleanup
- `cancelStudentDelete()`: Cancels the operation and closes modal

#### Data Cleanup Process
1. Iterates through all assessments in the current subject
2. Clears evaluation data for each student-assessment combination
3. Updates both Tauri storage and localStorage fallback
4. Reloads student evaluations to update the display
5. Shows success notification

### UI/UX Considerations

#### Button Placement
- Positioned horizontally next to move up/down buttons
- Uses Bootstrap's `btn-outline-danger` class for consistent styling
- Small size (24x20px) to fit in the student name column
- Font Awesome trash icon (`bi-trash`) for clear visual indication

#### Modal Design
- **Header**: Red background with warning icon and clear title
- **Student Info**: Large icon, name, and student ID display
- **Warning Section**: Red alert explaining data deletion consequences
- **Info Section**: Blue alert clarifying global student preservation
- **Action Buttons**: Cancel (secondary) and Remove Student (danger) buttons

### Development Guidelines

#### When Adding Similar Features
1. Follow the established modal pattern for confirmations
2. Use Bootstrap 5 "sm" theme consistently
3. Include comprehensive warning information
4. Provide clear user feedback for actions
5. Maintain accessibility standards

#### Error Handling
- Graceful fallback between Tauri and localStorage
- User-friendly error messages
- Console logging for debugging
- Proper state cleanup on errors

## Code Style Guidelines

### Svelte Components
- Use `$state` for reactive variables
- Use `$derived` for computed values
- Follow Bootstrap 5 "sm" theme guidelines
- Use proper TypeScript types where possible

### Rust Backend
- Follow Rust naming conventions
- Use proper error handling with `Result<T, E>`
- Document public functions with doc comments

### File Organization
- Keep components focused and single-purpose
- Use descriptive file and function names
- Group related functionality together
- Maintain consistent indentation and formatting
