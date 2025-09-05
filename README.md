# Feedback Management Application

A modern, cross-platform desktop application built with Tauri and React for managing feedback, assessments, and content organization.

## 🚀 Features

### Core Functionality
- **Subject Management**: Create, edit, and delete feedback subjects
- **Assessment Management**: Organize assessments under each subject
- **Category Management**: Create categories to organize paragraph content
- **Paragraph Management**: Add paragraphs with content, images, and category assignments
- **Content Selection**: Checkbox-based selection system for paragraphs
- **Export Options**: Copy to clipboard and print to downloads folder

### Technical Features
- **Cross-Platform**: Runs on Windows, macOS, and Linux
- **Portable Database**: SQLite database that travels with the application
- **Modern UI**: Material-UI components with responsive design
- **Real-time Updates**: Live content selection and preview
- **Breadcrumb Navigation**: Easy navigation between different sections

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Material-UI
- **Backend**: Rust with Tauri 2.0
- **Database**: SQLite with Tauri SQL plugin
- **Build System**: Vite
- **UI Framework**: Material-UI (MUI)

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- Rust (latest stable)
- Tauri CLI

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Tauri CLI (if not already installed):
   ```bash
   npm install -g @tauri-apps/cli
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run tauri dev
```

### Build for Production
```bash
npm run build
npm run tauri build
```

## 📖 How to Use

### 1. Getting Started
- Launch the application
- The sidebar provides navigation between Subjects and Categories
- Use breadcrumbs to navigate back to previous sections

### 2. Managing Subjects
- Click "Add Subject" to create new feedback subjects
- Click on a subject card to view its assessments
- Use edit/delete buttons to modify subjects

### 3. Managing Assessments
- Navigate to a subject to see its assessments
- Click "Add Assessment" to create new assessments
- Each assessment can contain multiple paragraphs

### 4. Managing Categories
- Use the sidebar to access the Categories section
- Create categories to organize your paragraph content
- Categories help you filter and organize feedback content

### 5. Managing Paragraphs
- Navigate to an assessment to manage its paragraphs
- Click "Add Paragraph" to create new content
- Fill in:
  - **Name**: Title for the paragraph
  - **Category**: Select from existing categories
  - **Content**: The actual paragraph text
  - **Image Path**: Optional path to an image file

### 6. Selecting and Exporting Content
- Use checkboxes to select paragraphs you want to include
- Selected content appears in the right panel
- Use "Copy to Clipboard" to copy selected content
- Use "Print to Download" to save content as a text file in your downloads folder

## 🗂️ Project Structure

```
feedback-react/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── SubjectsManager.tsx
│   │   ├── AssessmentsManager.tsx
│   │   ├── CategoriesManager.tsx
│   │   └── ParagraphsManager.tsx
│   ├── types.ts           # TypeScript type definitions
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   ├── index.html         # HTML template
│   └── styles.css         # Global styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Tauri commands and handlers
│   │   └── database.rs    # Database operations
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── dist/                  # Built frontend assets
└── target/                # Built Rust application
```

## 🗄️ Database Schema

The application uses SQLite with the following tables:

- **subjects**: Stores feedback subjects
- **assessments**: Stores assessments under subjects
- **categories**: Stores paragraph categories
- **paragraphs**: Stores paragraph content with category assignments

## 🔧 Development

### Available Scripts
- `npm run dev`: Start Vite development server
- `npm run build`: Build frontend for production
- `npm run tauri dev`: Start Tauri development mode
- `npm run tauri build`: Build the complete application

### Adding New Features
1. **Frontend**: Add new components in `src/components/`
2. **Backend**: Add new Tauri commands in `src-tauri/src/main.rs`
3. **Database**: Add new database operations in `src-tauri/src/database.rs`

## 📱 Application Features

### User Interface
- **Sidebar Navigation**: Quick access to main sections
- **Breadcrumb Navigation**: Shows current location and allows easy navigation
- **Responsive Design**: Adapts to different window sizes
- **Modern Material Design**: Clean, professional appearance

### Data Management
- **CRUD Operations**: Full Create, Read, Update, Delete functionality
- **Data Validation**: Input validation and error handling
- **Cascading Deletes**: Proper cleanup when deleting parent records
- **Real-time Updates**: UI updates immediately after data changes

### Export Capabilities
- **Clipboard Integration**: One-click copying of selected content
- **File Export**: Automatic saving to downloads folder with timestamps
- **Content Formatting**: Properly formatted text output

## 🐛 Troubleshooting

### Common Issues
1. **Build Errors**: Ensure all dependencies are installed with `npm install`
2. **Rust Compilation**: Make sure Rust is properly installed and up to date
3. **Database Issues**: The SQLite database is created automatically on first run

### Getting Help
- Check the console for error messages
- Ensure all prerequisites are installed
- Verify that the Tauri CLI is properly configured

## 📄 License

This project is built for feedback management and content organization.

## 🔧 Troubleshooting

### Testing with Tauri App

When testing the application, always use the Tauri desktop app (`npm run tauri dev`) rather than the browser version. The browser version has limited functionality and may not work properly.

### Debug Information

The application sends detailed debug information to the running console. When you encounter issues:

1. **Keep the terminal open** where you ran `npm run tauri dev`
2. **Look for debug messages** in the console output
3. **Common debug patterns:**
   - `🔵` - Information messages (process starting, steps completed)
   - `🔴` - Error messages (something went wrong)
   - `✅` - Success messages (operation completed successfully)

### Common Issues and Solutions

#### Export Report Button Not Working
- **Check console for:** `🔵 PDF Export: Starting HTML-based PDF generation`
- **If no messages appear:** The button click isn't reaching the backend
- **If error messages appear:** Check the specific error details in console

#### Database Operations Failing
- **Check console for:** Database-related error messages
- **Look for:** `🔴 BACKEND:` messages indicating specific failures
- **Solution:** Restart the Tauri app to reinitialize the database

#### File Export Issues
- **Check console for:** `✅ PDF Export: Successfully saved HTML to: [file path]`
- **Verify:** The file path shown in the console
- **Check:** Your Downloads folder for the generated HTML file

### Getting Help

When reporting issues, please include:
1. **Console output** from the terminal running `npm run tauri dev`
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**

## 🤝 Contributing

This is a standalone application built to specific requirements. For modifications or enhancements, please refer to the code structure and follow the existing patterns.

### ⚠️ Important Development Guidelines

**DO NOT change any UI layouts, component arrangements, or visual design elements without explicit instructions from the project owner.** This includes:

- Layout structure (sidebar, content areas, positioning)
- Component sizing and spacing
- Visual styling and appearance
- Button placement and organization
- Form layouts and field arrangements

All UI changes must be explicitly requested and approved before implementation.

---

**Built with ❤️ using Tauri, React, and Rust**