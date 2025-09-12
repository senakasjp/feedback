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
