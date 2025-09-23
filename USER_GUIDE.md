# User Guide

## Getting Started

### First Launch
1. Start the application
2. You'll see the welcome screen with options to create your first subject
3. Click "Create Subject" to begin

### Basic Workflow
1. **Create Subject** → **Add Assessment** → **Create Categories** → **Add Students** → **Create Feedback**

## Subject Management

### Creating a Subject
1. Click "Create Subject" on the welcome screen
2. Enter a subject name (e.g., "Studio 6", "Mathematics")
3. Click "Add" to create the subject

### Managing Subjects
- **View Subjects**: All subjects are displayed on the main screen
- **Delete Subject**: Click the trash icon next to a subject (confirmation required)
- **Open Subject**: Click on a subject to view its assessments

## Assessment Management

### Creating an Assessment
1. Open a subject
2. Click "Add Assessment" in the sidebar
3. Enter assessment name (e.g., "Mid-PDR", "Quiz 1")
4. Click "Add" to create the assessment

### Managing Assessments
- **View Assessments**: All assessments for a subject are displayed
- **Delete Assessment**: Click the X icon next to an assessment
- **Open Assessment**: Click "Open Feedback" to start creating feedback

### Assessment Categories
1. Open an assessment
2. Click "Manage Categories" in the assessment manager
3. Add categories like "Strengths", "Areas for Improvement", etc.
4. **Allocated Marks**: When adding a category, you can optionally set allocated marks (e.g., 30 marks for "Writing Skills")
5. Categories help organize your feedback paragraphs and provide mark allocation context

## Student Management

### Adding Students
1. Click "Student Management" in the sidebar
2. Click "Add New Student"
3. Enter student name and ID
4. Click "Add" to create the student

### Student Information
- **Name**: Student's full name
- **Student ID**: Unique identifier (e.g., student number)
- **Display Name**: Shows as "Name (ID)" in the interface
- **Photo**: Upload a header photo for PDF reports

### Selecting Students
1. Use the student dropdown in the sidebar
2. Select a student to load their data
3. The interface will show all paragraphs associated with that student

### Managing Students in Subjects
- **View Students**: Students with evaluation data for a subject appear in the assessment manager
- **Remove from Subject**: Click the red trash button next to a student's name to remove them from the current subject
- **Global vs Subject-Specific**: Removing a student from a subject only affects that subject; the student remains in the global student list

### Removing Students from Subjects
1. Open a subject and go to the assessment manager
2. Find the student you want to remove in the student list
3. Click the red trash button next to their name
4. A confirmation modal will appear with detailed information about what will be deleted
5. Review the warning information carefully
6. Click "Remove Student" to confirm or "Cancel" to abort
7. The student's evaluation data for all assessments in that subject will be permanently deleted
8. The student will no longer appear in the subject's student list but remains in the global student database

## Creating Feedback

### Adding Paragraphs
1. Open an assessment
2. Select a student (optional)
3. In the "Add New Paragraph" section:
   - Choose a category (if available)
   - Select a topic (if available)
   - Choose a color for the paragraph
   - Enter your feedback text
   - Click "Add"

### Paragraph Management
- **View Paragraphs**: All paragraphs are displayed in the main area
- **Select Paragraphs**: Check boxes to include in PDF reports
- **Edit Paragraphs**: Click the edit icon to modify paragraph text (preserves category and knowledge area prefixes)
- **Delete Paragraphs**: Click the trash icon to remove (kept in student history)
- **Filter Paragraphs**: Use category and topic filters to find specific content

### Paragraph Selection Reliability (v3.0.1+)
The paragraph selection system has been enhanced for improved reliability:

- **Consistent Selection**: Paragraph checkboxes work reliably for all students, including those with saved data
- **Selection Persistence**: Previously selected paragraphs remain selected when switching between students
- **Selection Count**: The selection count updates correctly when checkboxes are clicked
- **Selected Paragraphs Panel**: The "Selected Paragraphs" panel appears consistently when paragraphs are selected

**How It Works**:
- Each paragraph has a unique, deterministic ID based on its content and position
- Saved selections are validated against current paragraph IDs to prevent mismatches
- Invalid selections are automatically filtered out to maintain system reliability

### Editing Paragraphs
1. **Start Editing**: Click the edit icon (pencil) next to any paragraph
2. **Edit Text**: Modify only the main text content in the textarea
3. **Save Changes**: Click the save icon (checkmark) to confirm changes
4. **Cancel Editing**: Click the cancel icon (X) to discard changes

**Important Notes**:
- Only the main text content can be edited
- Category prefixes (e.g., "Strengths: ") are automatically preserved
- Knowledge area suffixes (e.g., " - Design") are automatically preserved
- Changes are saved to both assignment and student storage
- Original structural information is maintained for proper organization

### Paragraph Colors
- **Red**: Critical issues or major problems
- **Orange**: Areas needing attention
- **Yellow**: Caution or minor issues
- **Light Green**: Good progress
- **Green**: Excellent work or strengths

## Grading and Marks

### Category Marks
1. For each category with selected paragraphs, enter marks
2. The system will calculate totals automatically
3. You can also enter manual total marks

### Marking Workflow
1. Select paragraphs for the student
2. Enter marks for each category
3. Review the calculated total
4. Generate PDF report

## PDF Generation

### Creating Reports
1. Select paragraphs for inclusion
2. Enter marks and grades
3. Click "Generate PDF" in the sidebar
4. The PDF will be downloaded automatically

### PDF Features
- **Header Photo**: Full-width header image
- **Student Information**: Name and assessment details
- **Selected Feedback**: Only chosen paragraphs are included
- **Professional Formatting**: Clean, readable layout
- **Enhanced Marks Display**: Shows marks in `[actual/allocated Marks]` format (e.g., `[15/30 Marks]`)
- **Auto-Save**: Student data is automatically saved when generating PDF

### PDF Content
- Subject and assessment names
- Student name and photo
- Selected feedback paragraphs
- **Category Marks**: Displayed as `[actual/allocated Marks]` when allocated marks are set for categories
- Category organization
- Professional formatting

## Navigation and Interface

### Sidebar Navigation
- **Subjects**: View and manage all subjects
- **Assessments**: View assessments for current subject
- **Student Management**: Add and manage students
- **Calculator**: Percentage range calculator
- **Actions**: Save/Load data, copy to clipboard

### Calculator Mode
1. Click the calculator icon in the sidebar
2. Manage percentage ranges for grading
3. Set color-coded ranges (green, light green, yellow, orange, red)
4. Click the list icon to return to navigation

### Keyboard Shortcuts
- **Tab**: Navigate between form elements
- **Enter**: Submit forms and add paragraphs
- **Escape**: Close modals and dialogs

## Data Management

### Saving Data
- **Auto-Save**: Data is automatically saved when generating PDFs
- **Manual Save**: Click "Save Student Data" in the sidebar
- **Load Data**: Click "Load Student Data" to restore previous state

### Data Storage
- All data is stored locally in the `FeedbackData` folder
- No internet connection required
- Data persists between application sessions
- Portable - copy the entire folder to move data

### Backup and Recovery
- Copy the `FeedbackData` folder to backup your data
- Restore by copying the folder back
- Each student's data is stored separately
- Assignment data is stored per assessment

## Tips and Best Practices

### Organizing Feedback
1. **Use Categories**: Group related feedback together
2. **Color Coding**: Use colors to indicate priority or type
3. **Be Specific**: Write clear, actionable feedback
4. **Consistent Format**: Use similar structure across paragraphs

### Efficient Workflow
1. **Create Templates**: Set up categories and topics in advance
2. **Batch Operations**: Add multiple paragraphs before saving
3. **Use Filters**: Find specific content quickly
4. **Regular Saves**: Save data frequently to avoid loss

### Student Management
1. **Consistent Naming**: Use the same format for student names
2. **Unique IDs**: Ensure each student has a unique identifier
3. **Photo Upload**: Add photos for better PDF reports
4. **Regular Updates**: Keep student information current

### PDF Reports
1. **Review Before Generating**: Check selected paragraphs
2. **Complete Marks**: Ensure all categories have marks
3. **Professional Presentation**: Use clear, constructive language
4. **Consistent Formatting**: Maintain similar structure across reports

## Advanced Features

### Professional PDF Report Generation

#### Download PDF Reports
1. Navigate to the Assessment Manager view
2. Ensure students have marks recorded for assessments
3. Click the **"Download PDF"** button in the Students with Marks section
4. The PDF will automatically download with:
   - **Professional Layout**: Clean, academic-style formatting
   - **Student Marks Table**: Complete overview of all student performance
   - **Grade Distribution Summary**: Statistical breakdown of grades
   - **Multi-page Support**: Automatic page breaks for large student lists

#### PDF Report Features
- **Dynamic Headers**: Word-wrapping headers that adjust to content
- **Column-based Layout**: Precise column widths with responsive text wrapping
- **Grade Analysis**: Comprehensive grade distribution with counts, percentages, and ranges
- **Student Name Truncation**: Smart truncation of long names for clean layout
- **Font Consistency**: Professional typography matching academic standards
- **Header Shading**: Light gray backgrounds for better visual organization
- **UI Synchronization**: PDF grade distribution table matches UI table exactly

#### CSV Export
1. Click the **"Export CSV"** button next to the Download PDF button
2. Excel-compatible CSV file will be downloaded
3. Contains all student marks data for external analysis

### Performance Analysis System

#### Individual Assessment Performance Cards
After viewing the students with marks table, you'll see individual performance highlight cards for each assessment:

1. **Performance Categories**:
   - **Highest Performers**: Students with the best marks (same marks grouped together)
   - **Medium Performers**: Students with median performance levels
   - **Needs Support**: Students requiring additional help (<50%)

2. **Smart Analysis Features**:
   - **Same Marks Grouping**: Multiple students with identical marks are displayed together
   - **Median-based Categorization**: Balanced performance analysis using statistical median
   - **Visual Indicators**: Color-coded badges and icons for quick recognition
   - **Assessment-specific**: Each assessment gets its own performance analysis

3. **Card Layout**:
   - **Horizontal Layout**: Cards arranged side-by-side with consistent sizing
   - **Responsive Design**: Adapts to different screen sizes
   - **Assessment Names**: Clear identification of which assessment each card represents

#### Understanding Performance Categories
- **Highest Performers**: All students achieving the top percentage for that assessment (same marks grouped together)
- **Medium Performers**: Students performing at the median level (middle marks)
- **Needs Support**: All students achieving the lowest percentage for that assessment (same lowest marks grouped together)
- **Dynamic Labels**: Category names automatically adjust (e.g., "Performer" vs "Performers")
- **Side-by-Side Layout**: Performance cards display in responsive grid layout for optimal viewing

### Grade Distribution Analysis

The Assessment Manager includes a comprehensive Grade Distribution table that provides an overview of student performance across all assessments.

#### Grade Distribution Table Features
- **Complete Grade Overview**: Shows all letter grades (A+ through E) even with zero students
- **Count and Percentage**: Displays both raw counts and percentage distribution
- **Grade Ranges**: Shows percentage ranges for each grade level
- **Real-time Updates**: Automatically updates when student marks change
- **Professional Layout**: Clean, academic-style table suitable for reporting

#### Understanding the Grade Distribution
- **A+ (90-100%)**: Exceptional performance
- **A (85-89%)**: Excellent performance  
- **A- (80-84%)**: Very good performance
- **B+ (75-79%)**: Good performance
- **B (70-74%)**: Above average performance
- **B- (65-69%)**: Satisfactory performance
- **C+ (60-64%)**: Average performance
- **C (55-59%)**: Below average performance
- **C- (50-54%)**: Marginal performance
- **D (40-49%)**: Poor performance
- **E (0-39%)**: Failing performance

#### Using Grade Distribution Data
- **Performance Analysis**: Quickly identify grade distribution patterns
- **Report Generation**: Use data for academic reporting and analysis
- **Student Support**: Identify students needing additional support
- **Curriculum Assessment**: Evaluate assessment difficulty and student outcomes

### Notification System
- **Success Notifications**: Green toast notifications for successful operations
- **Error Feedback**: Clear error messages if operations fail
- **Automatic Dismissal**: Notifications disappear automatically after a few seconds
- **Manual Dismissal**: Click the X button to close notifications early

### Student Management

#### Deleting Students
1. Navigate to the Student Manager by clicking the gear icon next to the student dropdown
2. Find the student you want to delete in the list
3. Click the red trash icon next to the student's name
4. A professional Bootstrap confirmation modal will appear showing:
   - **Warning Header**: Red header with warning triangle icon
   - **Student Name**: Clearly displays which student will be deleted
   - **Detailed List**: Shows exactly what will be permanently removed:
     - Student information and profile
     - All evaluation data and feedback
     - All feedback paragraphs and comments
     - All assessment marks and grades
   - **Additional Information**: Notes about current selection being cleared
5. Choose your action:
   - **Cancel**: Click the "Cancel" button to abort the deletion
   - **Delete**: Click the "Delete Student" button to proceed
6. During deletion:
   - The delete button shows a loading spinner and "Deleting..." text
   - Both buttons are disabled to prevent multiple clicks
7. After completion:
   - Modal automatically closes
   - Success notification appears confirming the deletion and cleanup

#### What Gets Deleted
When you delete a student, the system removes:
- **Student Information**: Name, ID, and display name from the student database
- **Evaluation Files**: All `student-evaluation-{studentId}-{assessmentId}.json` files
- **Paragraph Files**: The `student-paragraphs-{studentId}.json` file
- **Current Selection**: If the deleted student was currently selected, the selection is cleared
- **Application State**: All related UI state is reset

#### Important Notes
- **Permanent Deletion**: Student deletion cannot be undone
- **Complete Cleanup**: All associated files are automatically removed
- **No Orphaned Data**: The system ensures no leftover files remain
- **Cross-Platform**: Works in both Tauri desktop and browser environments
- **Professional UI**: Uses Bootstrap 5 confirmation modal for better user experience
- **Safety Features**: Multiple warnings and confirmation steps prevent accidental deletions

## Troubleshooting

### Common Issues

#### Paragraphs Not Saving
- Ensure you're in an assessment view
- Check that a subject is selected
- Try saving manually with "Save Student Data"

#### PDF Generation Fails
- Check that students have marks recorded for assessments
- Ensure you're in the Assessment Manager view
- Verify that the "Download PDF" button is enabled
- Check browser download settings if PDF doesn't appear
- Try refreshing the application if PDF generation fails

#### Student Data Not Loading
- Verify student is selected in dropdown
- Check that assessment is open
- Try refreshing the application

#### Data Not Persisting
- Check file permissions in FeedbackData folder
- Ensure application has write access
- Try running as administrator (if needed)

#### Performance Highlights Not Showing
- Ensure students have marks recorded for assessments
- Check that at least one student has marks for each assessment
- Verify that you're viewing the Assessment Manager page
- Performance cards only appear after the students with marks table

#### CSV Export Issues
- Ensure students have marks recorded before exporting
- Check that the "Export CSV" button is enabled (not grayed out)
- Verify browser download settings if CSV doesn't appear
- Try refreshing the application if export fails

#### Student Deletion Issues
- Ensure you have proper permissions to delete files
- Check that the student is not currently selected in another view
- Verify that all associated data has been properly cleaned up
- If deletion fails, try refreshing the application and attempt again

### Getting Help
- Check the [Development Guide](DEVELOPMENT.md) for technical issues
- Review the [Architecture](ARCHITECTURE.md) documentation
- Ensure you're following the correct workflow steps
