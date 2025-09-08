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

### 🏷️ Category System
- **Custom Categories**: Create categories specific to each assessment
- **Category Descriptions**: Add optional descriptions for better organization
- **Visual Indicators**: Categories displayed as blue badges in feedback
- **Category Filtering**: Filter paragraphs by category

### 📝 Feedback Management
- **Add Paragraphs**: Create feedback paragraphs with category and topic selection
- **Checkbox Selection**: Select specific paragraphs for inclusion in reports
- **Live Preview**: See selected paragraphs in a dedicated section
- **Auto-save**: All data is automatically saved as you work

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
- **JSON Format**: Human-readable data storage
- **Auto-backup**: No manual save required

## Technology Stack

- **Frontend**: Svelte 5 with modern reactivity (`$state`)
- **Desktop Framework**: Tauri (Rust backend)
- **UI Framework**: Bootstrap 5 with Sveltestrap components
- **PDF Generation**: jsPDF library
- **Build Tool**: Vite
- **File System**: Tauri filesystem plugins

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
  ]
}
```

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
- Uses Tauri's file system API for cross-platform compatibility
- Data stored relative to executable location
- No external database required
- Easy backup and transfer

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