# Feedback Application Architecture Diagram

## Latest Architecture Updates (v3.1.0)

### Visual Debug Panel Architecture
The application now includes a comprehensive visual debugging system:

1. **Debug State Management**: `showCheckboxDebug` and `checkboxDebugInfo` state variables
2. **Message System**: `addCheckboxDebug()` function with timestamp and message limit
3. **UI Components**: Toggle button in navbar and comprehensive debug panel
4. **ID Management**: `regenerateParagraphIds()` function for fixing duplicate IDs
5. **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements

### Enhanced ID Generation System
- **Problem Solved**: Multiple checkbox ticking caused by duplicate paragraph IDs
- **Solution**: Enhanced `generateId()` function with timestamp and random components
- **Architecture**: Deterministic hash + timestamp + random for true uniqueness
- **Impact**: Eliminates duplicate IDs and ensures one-to-one checkbox mapping

### Data Contamination Prevention Architecture
- **Problem Solved**: Paragraphs from other assessments being loaded
- **Solution**: Strict filtering by `subjectId` and `assessmentId`
- **Architecture**: Legacy data migration with automatic property assignment
- **Impact**: Clean data separation between assessments

## Previous Architecture Updates (v3.0.7)

### Critical Data Contamination Prevention Architecture
The application now implements strict saving criteria to prevent dataset contamination:

1. **Assessment Saving Flow**: Data flows to assignment files ONLY when no student is selected
2. **Student Saving Flow**: Data flows to student files ONLY when a student is selected
3. **Strict Validation**: Multiple layers of validation prevent cross-contamination
4. **Enhanced Routing**: Autosave system strictly routes data based on student selection state

### Student Photo System Removal
- **Complete Removal**: All `studentImage` references removed from architecture
- **Header Photo Only**: Only assessment header photos are supported in data structure
- **Clean Data Flow**: No photo data flows to student files
- **Simplified Architecture**: Removed student photo upload and storage components

## Previous Architecture Updates (v3.0.6)

### Strict Data Separation Architecture
The application now implements a strict data separation policy with three core rules:

1. **Assignment Data Flow**: When no student is selected, data flows only to assignment files
2. **Student Data Flow**: When a student is selected, data flows to student-specific files
3. **Dual Autosave System**: Automatic routing of data to appropriate storage locations

### Enhanced Paragraph Merging System
- **Smart Comparison**: Normalized text comparison prevents duplicate identical paragraphs
- **Source Tracking**: Each paragraph marked with origin (assignment vs student)
- **Conflict Resolution**: Modified IDs prevent conflicts between assignment and student versions
- **Visual Indicators**: Clear UI badges show paragraph source and differences

## File and Function Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (Svelte)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │   main.js       │    │   App.svelte    │    │   types.ts      │             │
│  │                 │    │                 │    │                 │             │
│  │ • Mount App     │───▶│ • Main State    │    │ • TypeScript    │             │
│  │ • Bootstrap CSS │    │ • Navigation    │    │   Definitions  │             │
│  │ • Google Fonts  │    │ • Data Loading  │    │                 │             │
│  │ • Bootstrap Icons│   │ • PDF Generation│    │                 │             │
│  └─────────────────┘    │ • Student Mgmt  │    └─────────────────┘             │
│                         │ • Assessment Mgmt│                                   │
│                         │ • Subject Mgmt   │                                   │
│                         └─────────────────┘                                   │
│                                  │                                             │
│                                  ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            COMPONENT LIBRARY                            │   │
│  │                                                                         │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │ │  Sidebar    │ │  Breadcrumb │ │  Welcome    │ │  Counter    │       │   │
│  │ │             │ │             │ │   Screen    │ │             │       │   │
│  │ │ • Navigation│ │ • Navigation│ │ • Welcome   │ │ • Test      │       │   │
│  │ │ • Actions   │ │   History   │ │   Message   │ │   Component │       │   │
│  │ │ • Student   │ │ • Back/Next │ │ • Get       │ │             │       │   │
│  │ │   Selection │ │   Buttons   │ │   Started   │ │             │       │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  │                                                                         │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │ │ Subject     │ │ Assessment  │ │ Subject     │ │ Feedback    │       │   │
│  │ │ Manager     │ │ Manager     │ │ Overview    │ │ Editor      │       │   │
│  │ │             │ │             │ │             │ │             │       │   │
│  │ │ • Add/Edit  │ │ • Add/Edit  │ │ • Display   │ │ • Paragraph │       │   │
│  │ │ • Delete    │ │ • Delete    │ │   Subject   │ │   Selection │       │   │
│  │ │ • List      │ │ • List      │ │   Details   │ │ • Category  │       │   │
│  │ │ • Confirm   │ │ • Confirm   │ │ • Assessment│ │   Selection │       │   │
│  │ │   Delete    │ │   Delete    │ │   List      │ │ • Color     │       │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ │   Selection │       │   │
│  │                                                 │ • Image     │       │   │
│  │                                                 │   Upload    │       │   │
│  │                                                 └─────────────┘       │   │
│  │                                                                         │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │   │
│  │ │ Category    │ │ Selected    │ │ Assessment  │                       │   │
│  │ │ Editor      │ │ Text        │ │ Manager     │                       │   │
│  │ │             │ │ Section     │ │ (Legacy)    │                       │   │
│  │ │ • Add       │ │             │ │             │                       │   │
│  │ │   Categories│ │ • Display   │ │ • Legacy    │                       │   │
│  │ │ • Delete    │ │   Selected  │ │   Component │                       │   │
│  │ │   Categories│ │   Text      │ │             │                       │   │
│  │ │ • Edit      │ │ • Copy      │ │             │                       │   │
│  │ │   Categories│ │   to        │ │             │                       │   │
│  │ └─────────────┘ │   Clipboard │ │             │                       │   │
│  │                 │ • PDF       │ │             │                       │   │
│  │                 │   Download  │ │             │                       │   │
│  │                 └─────────────┘ └─────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND (Rust/Tauri)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │   main.rs       │    │   lib.rs        │    │   Cargo.toml    │             │
│  │                 │    │                 │    │                 │             │
│  │ • Entry Point   │───▶│ • Tauri Commands│    │ • Dependencies  │             │
│  │ • Windows       │    │ • File I/O      │    │ • Build Config  │             │
│  │   Subsystem     │    │ • PDF Generation│    │ • Tauri Config  │             │
│  │ • App Launch    │    │ • Data Storage  │    │                 │             │
│  └─────────────────┘    │ • Student Data  │    └─────────────────┘             │
│                         │                 │                                   │
│                         └─────────────────┘                                   │
│                                  │                                             │
│                                  ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            TAURI COMMANDS                               │   │
│  │                                                                         │   │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │   │
│  │ │ portable_data_dir│ │ write_portable  │ │ read_portable   │             │   │
│  │ │                 │ │                 │ │                 │             │   │
│  │ │ • Get Data Dir  │ │ • Save Global   │ │ • Load Global   │             │   │
│  │ │ • Create Dir    │ │   Data          │ │   Data          │             │   │
│  │ │ • Cross-Platform│ │ • Subjects      │ │ • Subjects      │             │   │
│  │ │                 │ │ • Students      │ │ • Students      │             │   │
│  │ │                 │ │ • Knowledge     │ │ • Knowledge     │             │   │
│  │ │                 │ │   Areas         │ │   Areas         │             │   │
│  │ └─────────────────┘ └─────────────────┘ └─────────────────┘             │   │
│  │                                                                         │   │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │   │
│  │ │ write_subject_  │ │ read_subject_   │ │ generate_pdf_   │             │   │
│  │ │ data            │ │ data            │ │ file            │             │   │
│  │ │                 │ │                 │ │                 │             │   │
│  │ │ • Save Subject  │ │ • Load Subject  │ │ • Create PDF    │             │   │
│  │ │   Data          │ │   Data          │ │ • Format Text   │             │   │
│  │ │ • Assessments   │ │ • Assessments   │ │ • Add Headers   │             │   │
│  │ │ • Categories    │ │ • Categories    │ │ • Save File     │             │   │
│  │ │ • Topics        │ │ • Topics        │ │ • Return Path   │             │   │
│  │ └─────────────────┘ └─────────────────┘ └─────────────────┘             │   │
│  │                                                                         │   │
│  │ ┌─────────────────┐ ┌─────────────────┐                                 │   │
│  │ │ write_student_  │ │ read_student_   │                                 │   │
│  │ │ evaluation      │ │ evaluation      │                                 │   │
│  │ │                 │ │                 │                                 │   │
│  │ │ • Save Student  │ │ • Load Student  │                                 │   │
│  │ │   Evaluation    │ │   Evaluation    │                                 │   │
│  │ │ • Selected Text │ │ • Selected Text │                                 │   │
│  │ │ • Marks Data    │ │ • Marks Data    │                                 │   │
│  │ │ • Assessment    │ │ • Assessment    │                                 │   │
│  │ │   Specific      │ │   Specific      │                                 │   │
│  │ └─────────────────┘ └─────────────────┘                                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA STORAGE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │ feedback-data   │    │ subject-{id}    │    │ student-eval-   │             │
│  │ .json           │    │ .json           │    │ {student}-{assess}│           │
│  │                 │    │                 │    │ .json           │             │
│  │ • Global Data   │    │ • Subject       │    │ • Student       │             │
│  │ • Subjects List │    │   Specific      │    │   Evaluation    │             │
│  │ • Students List │    │ • Assessments   │    │ • Selected      │             │
│  │ • Knowledge     │    │ • Categories    │    │   Paragraphs    │             │
│  │   Areas         │    │ • Topics        │    │ • Marks Data    │             │
│  │ • Categories    │    │ • Paragraphs    │    │ • Assessment    │             │
│  │ • Settings      │    │ • Selected Text │    │   Context       │             │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Function Relationships

### Frontend Data Flow
```
App.svelte (Main Controller)
├── loadSubjects() → Tauri: read_portable()
├── saveSubjects() → Tauri: write_portable()
├── loadAssessmentData() → Tauri: read_subject_data()
├── saveAssessmentData() → Tauri: write_subject_data()
├── generatePDF() → Tauri: generate_pdf_file()
├── saveStudentEvaluation() → Tauri: write_student_evaluation()
└── loadStudentEvaluation() → Tauri: read_student_evaluation()

Component Communication:
├── Sidebar → App: onSelectSubject, onSelectAssessment, onAddSubject, etc.
├── SubjectManager → App: onUpdateSubjects, onSelectSubject
├── AssessmentManager → App: onUpdateAssessments, onSelectAssessment
├── FeedbackEditor → App: onAddParagraph, onToggleParagraph, onDeleteParagraph
└── Breadcrumb → App: handleBreadcrumbNavigation
```

### Backend Command Mapping
```
Tauri Commands (lib.rs):
├── portable_data_dir() → Get/create data directory
├── write_portable(data) → Save global data (subjects, students, knowledge areas)
├── read_portable() → Load global data
├── write_subject_data(subject_id, data) → Save subject-specific data
├── read_subject_data(subject_id) → Load subject-specific data
├── generate_pdf_file(content, subject, assessment, student) → Create PDF
├── write_student_evaluation(student_id, assessment_id, data) → Save student evaluation
└── read_student_evaluation(student_id, assessment_id) → Load student evaluation
```

### Data Structure Hierarchy
```
Global Data (feedback-data.json):
├── subjects: Subject[]
│   ├── id: string
│   ├── name: string
│   └── assessments: Assessment[]
│       ├── id: string
│       ├── name: string
│       ├── topics: Topic[]
│       └── categories: Category[]
├── students: Student[]
│   ├── id: string
│   ├── name: string
│   ├── studentId: string
│   └── displayName: string
├── knowledgeAreas: string[]
└── categories: Category[]

Subject Data (subject-{id}.json):
├── assessments: Assessment[]
├── categories: Category[]
├── topics: Topic[]
├── paragraphs: string[]
└── selectedParagraphs: number[]

Student Evaluation (student-eval-{student}-{assessment}.json):
├── selectedParagraphs: number[]
├── studentName: string
├── studentImage: string
├── categoryMarks: object
└── manualTotalMarks: string
```

## Component Responsibilities

### App.svelte (Main Controller)
- **State Management**: Global application state
- **Data Persistence**: Loading/saving data via Tauri
- **Navigation**: View switching and breadcrumb handling
- **Student Management**: Student CRUD operations
- **PDF Generation**: Client-side PDF creation
- **Event Handling**: Component communication coordination

### Sidebar.svelte (Navigation)
- **Navigation**: Subject/assessment selection
- **Actions**: Add, manage, copy, print operations
- **Student Selection**: Student dropdown and management
- **Mobile Support**: Responsive sidebar behavior

### SubjectManager.svelte (Subject Management)
- **Subject CRUD**: Create, read, update, delete subjects
- **Confirmation Dialogs**: Delete confirmation modals
- **State Updates**: Notify parent of changes

### AssessmentManager.svelte (Assessment Management)
- **Assessment CRUD**: Create, read, update, delete assessments
- **Category Management**: Add/remove categories
- **Topic Management**: Add/remove topics
- **Confirmation Dialogs**: Delete confirmation modals

### FeedbackEditor.svelte (Content Creation)
- **Paragraph Management**: Add, edit, delete paragraphs
- **Category Selection**: Assign categories to paragraphs
- **Color Coding**: Visual paragraph organization
- **Image Upload**: Header photo handling
- **Filtering**: Filter by category/topic

### Backend (Rust/Tauri)
- **File I/O**: Cross-platform file operations
- **Data Persistence**: JSON file management
- **PDF Generation**: Server-side PDF creation
- **Directory Management**: Portable data directory creation
- **Error Handling**: Robust error management

This architecture provides a clean separation of concerns with the frontend handling UI/UX and the backend managing data persistence and file operations.
