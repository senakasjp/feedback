# Feedback Manager

A comprehensive desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization, PDF generation, and advanced assessment management capabilities.

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

## Key Features

- **Dual Storage System**: Sophisticated paragraph management with assignment-level and student-level storage
- **Hierarchical Organization**: Subjects → Assessments → Categories → Paragraphs
- **Student Management**: Comprehensive student database with photo upload
- **PDF Generation**: Professional report generation with images
- **Assessment Weighting**: Percentage-based assessment weights
- **CSV Export**: Student marks table export functionality
- **Cross-Platform**: Windows, macOS, and Linux support

## Architecture Overview

The application uses a modern tech stack with clear separation of concerns:

- **Frontend**: Svelte 5 with Bootstrap 5 UI
- **Backend**: Tauri (Rust) for desktop functionality
- **Storage**: JSON-based file system for portability
- **Build**: Vite for frontend bundling

## Documentation

- **[User Guide](USER_GUIDE.md)** - How to use the application
- **[Architecture](ARCHITECTURE.md)** - Technical architecture and design
- **[Development Guide](DEVELOPMENT.md)** - Setup and development workflow
- **[API Reference](API_REFERENCE.md)** - Technical API documentation
- **[Changelog](CHANGELOG.md)** - Version history and changes

## Data Storage

The application implements a sophisticated dual storage system:

- **Assignment-Level**: Paragraphs stored per assessment
- **Student-Level**: Complete paragraph history across all assignments
- **Evaluation Data**: Marks, selections, and metadata per student-assessment

## Build & Distribution

### Development
```bash
npm run tauri dev
```

### Production
```bash
npm run tauri build
```

### Outputs
- **Windows**: `.exe` installer and portable executable
- **macOS**: `.app` bundle and `.dmg` installer
- **Linux**: `.deb`, `.rpm`, and `.AppImage` packages

## Portable Installation

The application is designed to be portable:
- All data stored in `FeedbackData/` folder next to executable
- No registry entries or system dependencies
- Copy entire folder to any computer
- Data persists across installations

## License

This project is proprietary software.

## Support

For technical issues, refer to the [Development Guide](DEVELOPMENT.md) troubleshooting section.