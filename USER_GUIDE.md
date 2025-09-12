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
4. Categories help organize your feedback paragraphs

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
- **Photo**: Upload a student photo for PDF reports

### Selecting Students
1. Use the student dropdown in the sidebar
2. Select a student to load their data
3. The interface will show all paragraphs associated with that student

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
- **Delete Paragraphs**: Click the trash icon to remove (kept in student history)
- **Filter Paragraphs**: Use category and topic filters to find specific content

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
- **Student Photo**: Full-width header image
- **Student Information**: Name and assessment details
- **Selected Feedback**: Only chosen paragraphs are included
- **Professional Formatting**: Clean, readable layout
- **Auto-Save**: Student data is automatically saved when generating PDF

### PDF Content
- Subject and assessment names
- Student name and photo
- Selected feedback paragraphs
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

## Troubleshooting

### Common Issues

#### Paragraphs Not Saving
- Ensure you're in an assessment view
- Check that a subject is selected
- Try saving manually with "Save Student Data"

#### PDF Generation Fails
- Check that paragraphs are selected
- Ensure student photo is in correct format
- Try with a smaller image file

#### Student Data Not Loading
- Verify student is selected in dropdown
- Check that assessment is open
- Try refreshing the application

#### Data Not Persisting
- Check file permissions in FeedbackData folder
- Ensure application has write access
- Try running as administrator (if needed)

### Getting Help
- Check the [Development Guide](DEVELOPMENT.md) for technical issues
- Review the [Architecture](ARCHITECTURE.md) documentation
- Ensure you're following the correct workflow steps
