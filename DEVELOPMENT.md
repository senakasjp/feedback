# Development Guide

## Latest Updates (v3.2.3)

### Total Marks Display Implementation
- **Real-time Calculation**: Added `getTotalMarks()` function for reactive total calculation
- **Component Integration**: Enhanced Sidebar component with `categoryMarks` and `getTotalMarks` props
- **Multiple Display Locations**: Total marks shown in both sidebar and paragraphs section
- **Conditional Rendering**: Total marks only appear when marks are entered (total > 0)
- **Visual Emphasis**: Red text styling using Bootstrap `text-danger` class

### Enhanced Rich Text Editor Features
- **Font Color Support**: Added HTML5 color picker with real-time color application
- **State Management**: Implemented `currentFontColor` state and `updateFontColorState()` function
- **Export Compatibility**: HTML content converted to plain text for clipboard/PDF exports
- **Bootstrap Integration**: Consistent styling with existing UI components

### Technical Implementation Notes
- **Reactive Updates**: Total marks automatically update when category marks change
- **HTML Storage**: Paragraph content stored as HTML for formatting preservation
- **Color Conversion**: RGB to hex conversion for color picker state management
- **Export Safety**: Display-only formatting doesn't affect PDF generation

## Previous Updates (v3.1.0)

### Visual Debug Panel Implementation
- **Checkbox Debug Panel**: Added comprehensive visual debugging for checkbox selection issues
- **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements
- **Duplicate Detection**: Automatic detection and warnings for duplicate paragraph IDs
- **ID Regeneration Tool**: One-click fix for duplicate ID issues
- **Tauri-Friendly**: Designed specifically for debugging in Tauri desktop app where console access is limited

### Critical Bug Fixes
- **Duplicate ID Resolution**: Fixed multiple checkbox ticking issue caused by duplicate paragraph IDs
- **Enhanced ID Generation**: Improved `generateId()` function with timestamp and random components for true uniqueness
- **Data Contamination Prevention**: Strict filtering prevents paragraphs from other assessments being loaded
- **Legacy Data Migration**: Automatic migration of old paragraphs without `subjectId`/`assessmentId` properties

### Visual Debug Panel Features
The debug panel provides real-time monitoring of:
- **Paragraph Selection Events**: Click tracking with timestamps
- **Duplicate ID Detection**: Automatic warnings when multiple paragraphs share same ID
- **DOM Element Monitoring**: Detection of multiple DOM elements with same ID
- **Selection State Tracking**: Live count of selected vs total paragraphs
- **ID Regeneration**: One-click fix for existing duplicate ID issues

### How to Add Visual Debug Panel (If Needed)
To re-implement the visual debug panel in future versions:

1. **Add State Variables**:
```javascript
let showCheckboxDebug = $state(false)
let checkboxDebugInfo = $state([])
```

2. **Add Debug Message Function**:
```javascript
function addCheckboxDebug(message) {
    const timestamp = new Date().toLocaleTimeString()
    checkboxDebugInfo = [...checkboxDebugInfo, `[${timestamp}] ${message}`]
    if (checkboxDebugInfo.length > 20) {
        checkboxDebugInfo = checkboxDebugInfo.slice(-20)
    }
}
```

3. **Add Debug Toggle Button** (in navbar):
```html
<li class="nav-item">
    <button 
        class="btn btn-outline-light btn-sm ms-2" 
        onclick={() => showCheckboxDebug = !showCheckboxDebug}
        title="Toggle Checkbox Debug"
        aria-label="Toggle Checkbox Debug"
    >
        <i class="bi bi-check-square"></i>
    </button>
</li>
```

4. **Add Debug Panel UI** (before closing `</main>` tag):
```html
<!-- Visual Debug Panel for Checkbox Issue -->
{#if showCheckboxDebug}
    <div class="container-fluid mt-4 mb-4">
        <div class="row">
            <div class="col-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning text-dark">
                        <h5 class="mb-0">
                            <i class="bi bi-check-square me-2"></i>Checkbox Debug Panel
                            <button 
                                class="btn btn-sm btn-outline-dark float-end" 
                                onclick={() => showCheckboxDebug = false}
                            >
                                <i class="bi bi-x"></i>
                            </button>
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <button 
                                    class="btn btn-sm btn-outline-secondary me-2" 
                                    onclick={() => checkboxDebugInfo = []}
                                >
                                    <i class="bi bi-trash me-1"></i>Clear Debug Log
                                </button>
                                <button 
                                    class="btn btn-sm btn-warning" 
                                    onclick={regenerateParagraphIds}
                                >
                                    <i class="bi bi-arrow-clockwise me-1"></i>Fix Duplicate IDs
                                </button>
                            </div>
                            <div class="col-md-6 text-end">
                                <small class="text-muted">
                                    Selected: {selectedParagraphs.size} | 
                                    Total Paragraphs: {paragraphs.length}
                                </small>
                            </div>
                        </div>
                        <div style="max-height: 300px; overflow-y: auto; background-color: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 0.9em;">
                            {#if checkboxDebugInfo.length === 0}
                                <p class="text-muted mb-0">No debug messages yet. Try clicking a checkbox.</p>
                            {:else}
                                {#each checkboxDebugInfo as message}
                                    <div class="mb-1">{message}</div>
                                {/each}
                            {/if}
                        </div>
                        <div class="mt-3">
                            <h6>Current Paragraph IDs:</h6>
                            <div style="max-height: 100px; overflow-y: auto; background-color: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.8em;">
                                {#each paragraphs as para, index}
                                    <div class="mb-1">
                                        <span class="badge {selectedParagraphs.has(para.id) ? 'bg-success' : 'bg-secondary'} me-2">
                                            {selectedParagraphs.has(para.id) ? '✓' : '○'}
                                        </span>
                                        {index}: {para.id}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
```

5. **Add ID Regeneration Function**:
```javascript
function regenerateParagraphIds() {
    addCheckboxDebug(`🔄 Regenerating IDs for ${paragraphs.length} paragraphs`)
    
    const beforeIds = paragraphs.map(p => p.id)
    const duplicateIds = beforeIds.filter((id, index, arr) => arr.indexOf(id) !== index)
    
    if (duplicateIds.length > 0) {
        addCheckboxDebug(`⚠️ Found ${duplicateIds.length} duplicate IDs before regeneration`)
    }
    
    paragraphs = paragraphs.map((para, index) => ({
        ...para,
        id: generateId(para.text || para, index)
    }))
    
    const afterIds = paragraphs.map(p => p.id)
    const afterDuplicateIds = afterIds.filter((id, index, arr) => arr.indexOf(id) !== index)
    
    if (afterDuplicateIds.length === 0) {
        addCheckboxDebug(`✅ All IDs are now unique!`)
    } else {
        addCheckboxDebug(`❌ Still have ${afterDuplicateIds.length} duplicate IDs after regeneration`)
    }
    
    selectedParagraphs = new Set()
    addCheckboxDebug(`🧹 Cleared selections due to ID regeneration`)
}
```

6. **Add Debug Calls** (in checkbox click handlers):
```javascript
onchange={() => {
    addCheckboxDebug(`🖱️ Checkbox clicked: ${id}`)
    addCheckboxDebug(`🔍 Is selected? ${selectedParagraphs.has(id)}`)
    
    // Check for duplicate IDs in current paragraphs
    const duplicateIds = paragraphs.map(p => p.id).filter((pid, index, arr) => arr.indexOf(pid) !== index)
    if (duplicateIds.length > 0) {
        addCheckboxDebug(`⚠️ DUPLICATE IDs found: ${duplicateIds.join(', ')}`)
    }
    
    // Check DOM elements
    const domElements = document.querySelectorAll(`#paragraph-${id}`)
    if (domElements.length > 1) {
        addCheckboxDebug(`⚠️ Multiple DOM elements with ID: ${id} (${domElements.length} found)`)
    }
    
    toggleParagraph(id)
}}
```

## Previous Updates (v3.0.7)

### Critical Data Contamination Prevention
- **Fixed Dataset Contamination**: Implemented strict saving criteria to prevent student data from contaminating assessment files
- **Enhanced Save Validation**: Added multiple layers of validation to ensure data is saved to correct location
- **Strict Routing Logic**: Autosave system now strictly routes data based on student selection state
- **Console Logging**: Added comprehensive logging for verification and debugging

### Strict Saving Criteria Implementation
The application now enforces two strict saving rules:

1. **Assessment Saving Rule**: Strictly save anything to Assessment if only a student is NOT selected
2. **Student Saving Rule**: Strictly save anything to Student if only a student IS selected

### Student Photo System Removal
- **Complete Removal**: All `studentImage` references removed from codebase
- **Header Photo Only**: Only assessment header photos are supported
- **Clean Data Structure**: No photo data in student files
- **Simplified UI**: Removed student photo upload functionality

### Key Technical Changes
- **Enhanced saveAssessmentData()**: Strict validation prevents saving when student is selected
- **Enhanced saveStudentEvaluation()**: Strict validation requires student to be selected
- **Dual Autosave System**: Assignment data when no student, student data when student selected
- **Assignment Data Purity**: Assignment files never contain student-specific information
- **Data Contamination Prevention**: Multiple validation layers prevent cross-contamination

## Previous Updates (v3.0.6)

### Strict Data Separation Policy Implementation
The application now follows three strict rules to prevent data confusion:

1. **Assignment Data Rule**: Paragraphs when no student selected are assignment data
2. **Student Data Rule**: Anything saved when student is selected are student data  
3. **Persistent Student Data Rule**: Student data should be saved even if not selected

### Identical Paragraph Merging Fix
- **Enhanced Text Normalization**: Improved paragraph comparison to handle whitespace and line ending differences
- **Duplicate Prevention**: Identical assignment and student paragraphs now show only one version
- **Smart Comparison**: Normalizes text before comparison to catch minor formatting differences

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
  "version": "3.2.3",
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
    "version": "3.2.3"
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

#### 2. Paragraph Selection Issues (Fixed in v3.0.1)
**Issue**: Paragraph checkboxes stop working when students with saved data are selected.

**Root Cause**: Saved paragraph IDs don't match current paragraph IDs due to random ID generation.

**Solution**: Implemented deterministic ID generation and selection validation:
```javascript
// Deterministic ID generation based on content and position
function generateId(text = '', index = 0) {
  const content = text || `paragraph-${index}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `para-${Math.abs(hash)}-${index}`
}

// Selection validation in loadStudentEvaluation
if (savedSelectedParagraphs.size > 0) {
  const currentParagraphIds = new Set(paragraphs.map(p => p.id))
  const validSelections = new Set()
  
  for (const savedId of savedSelectedParagraphs) {
    if (currentParagraphIds.has(savedId)) {
      validSelections.add(savedId)
    }
  }
  
  selectedParagraphs = validSelections
}
```

#### 3. File System Permissions
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
