# Troubleshooting Guide

> **New:** PDF rubric export now respects manual row → category mapping for marks/highlighting (no more `undefined` marks in the PDF).


## Desktop App Doesn't Reflect Recent Code Changes

**Symptoms**: A feature works when tested via `npm run dev` in a browser, but the installed `/Applications/Feedback.app` doesn't show it at all — even after toggling every relevant setting in the UI.

**Diagnosis**: `/Applications/Feedback.app` is a compiled snapshot from whichever git branch was checked out when `BULD_DEPLOY.SH` was last run. If that branch didn't yet contain the feature (e.g. it only exists on a feature branch, or was added after the last deploy), the installed app simply doesn't have the code — no amount of in-app configuration will make it appear.

**Solutions**:
- Confirm the feature exists in your current branch's source (`grep` for a distinctive string in `src/App.svelte`, or `git log -S "<string>" -- src/App.svelte`).
- **Don't** try to verify via `strings` on the compiled binary at `/Applications/Feedback.app/Contents/MacOS/app` — Tauri compresses embedded frontend assets, so this reliably shows false negatives even when the feature is present.
- Instead, run `npm run build` and `grep` the distinctive string in `dist/assets/*.js` to confirm it compiled into this build.
- If confirmed, redeploy from the correct branch: `bash BULD_DEPLOY.SH` (runs e2e tests, rebuilds via `tauri:build`, replaces `/Applications/Feedback.app`, relaunches). This is safe — your data lives in the sibling `/Applications/FeedbackData/` folder and is never touched by the deploy script.

## Version 3.2.9 - Latest Issues and Solutions

### PDF Rubric Shows `undefined` or Doesn’t Highlight

**Symptoms**: Marks column shows `undefined` or mapped row doesn’t highlight in the PDF.
**Diagnosis**: Older builds ignored manual row → category mapping during PDF generation.
**Solutions**:
- Upgrade to v3.2.9 (manual row → category mapping is used for marks and highlighting).
- Ensure each rubric row is mapped to the correct category in the Assessment HTML card.
- Verify paragraph-position → column mapping is set for the category’s paragraph order.

### Total Marks Display Issues

#### Issue: Total Marks Not Appearing
**Symptoms**: Total marks don't show in sidebar or paragraphs section
**Diagnosis**: Check if marks have been entered in any category
**Solutions**:
- Ensure at least one category has marks entered
- Check that `getTotalMarks()` function is working correctly
- Verify Sidebar component has `categoryMarks` and `getTotalMarks` props
- Total marks only appear when total > 0 (conditional display)

#### Issue: Total Marks Not Updating
**Symptoms**: Total marks don't change when category marks are modified
**Diagnosis**: Check reactive state updates
**Solutions**:
- Ensure `categoryMarks` is properly bound to input fields
- Verify `getTotalMarks()` function is reactive
- Check for JavaScript errors in console
- Refresh the application if reactive updates fail

### Enhanced Text Formatting Issues

#### Issue: Font Colors Not Applying
**Symptoms**: Color picker doesn't change text color
**Diagnosis**: Check rich text editor functionality
**Solutions**:
- Ensure text is selected before applying color
- Check if `document.execCommand('foreColor')` is supported
- Verify color picker is properly bound to `changeFontColor()` function
- Try refreshing the editor by canceling and re-editing

#### Issue: Formatting Lost on Save
**Symptoms**: Bold or colored text reverts to plain text
**Diagnosis**: Check HTML storage and conversion
**Solutions**:
- Verify paragraph content is stored as HTML
- Check `convertHtmlToText()` function for clipboard/PDF exports
- Ensure `{@html}` directive is used for display
- Formatting should persist in display but convert to plain text for exports

#### Issue: Color Picker Not Reflecting Current Color
**Symptoms**: Color picker shows wrong color for selected text
**Diagnosis**: Check `updateFontColorState()` function
**Solutions**:
- Ensure text is properly selected before checking color
- Verify `rgbToHex()` conversion function is working
- Check for CSS color inheritance issues
- Try selecting text again and checking color picker

## Selection System Issues

### Quick Diagnostic Checklist

#### 1. Check for Duplicate Paragraph IDs (v3.2.1)
**Most Common Issue**: Duplicate paragraph IDs causing selection failures.

**✅ Normal Operation:**
```
🔍 DEBUG: ✅ All 20 IDs are unique
```

**⚠️ Duplicate IDs Detected:**
```
🔍 DEBUG: ⚠️ Found 1 duplicate IDs: mfq7dqffo4h768js19
🔧 Duplicate IDs found: ["mfq7dqffo4h768js19"]
```

**🔧 Auto-Fix Applied:**
```
🔄 Regenerating IDs for 20 paragraphs
✅ ID regeneration successful - all IDs are now unique
🧹 Cleared selections due to ID regeneration
```

#### 2. Check Console Output for Selection Data
Open browser/Tauri developer tools and look for these messages:

**✅ Normal Operation:**
```
💾 SAVING: Selected paragraphs to student properties: {...}
✅ SAVED: Student data updated with new selections
✅ LOADED: Selected paragraphs from student properties: [...]
```

**⚠️ Using Legacy Data:**
```
🔄 LEGACY: Selected paragraphs from evaluation file (legacy data): [...]
⚠️ WARNING: Using legacy data - consider migrating to student properties
```

**❌ Errors:**
```
❌ ERROR: Current student not found for ID: student-123
⚠️ No selections found in student properties for assessment: assessment-456
```

#### 3. Verify Data Structure
Check if student object has the correct structure:

```javascript
// Expected student structure
{
  id: "student-123",
  displayName: "John Doe (12345)",
  selectedParagraphs: {
    "assessment-1": ["para-id-1", "para-id-2"],
    "assessment-2": ["para-id-3", "para-id-4"]
  }
}
```

#### 4. Test Save/Load Cycle
1. Select a student
2. Select some paragraphs
3. Save (Ctrl+S or auto-save)
4. Switch to another student
5. Switch back to first student
6. Verify selections are restored

### Common Issues and Solutions

#### Issue: Duplicate Paragraph IDs (v3.2.1)
**Symptoms:** 
- Selections not working properly
- Print functions excluding selected paragraphs
- Debug panel showing duplicate IDs

**Diagnosis:** 
- Check console for duplicate ID messages
- Use "Check Duplicate IDs" button in debug panel
- Look for identical IDs in paragraph list

**Solutions:**
- System automatically detects and fixes duplicates
- Use "Fix Duplicate IDs" button for manual fix
- All IDs will be regenerated with unique values
- Selections will be cleared after ID regeneration (normal behavior)

#### Issue: Selections Not Saving
**Symptoms:** Checkboxes uncheck after saving
**Diagnosis:** Check console for save messages
**Solutions:**
- Verify student is selected before saving
- Check if `studentsService.saveStudents()` is being called
- Ensure no JavaScript errors in console

#### Issue: Selections Not Loading
**Symptoms:** Checkboxes don't restore when selecting student
**Diagnosis:** Check console for load messages
**Solutions:**
- Verify student ID and assessment ID match
- Check if student has `selectedParagraphs` property
- Ensure assessment ID exists in student's selectedParagraphs

#### Issue: Old Selections Still Appearing
**Symptoms:** Selections from previous sessions still showing
**Diagnosis:** Look for legacy data messages
**Solutions:**
- Check if evaluation files contain `selectedParagraphs` field
- Verify new selections are being saved to student properties
- Clear browser cache if using web version

#### Issue: Multiple Students Show Same Selections
**Symptoms:** Different students show identical paragraph selections
**Diagnosis:** Check student ID matching in console
**Solutions:**
- Verify each student has unique ID
- Check if assessment ID is correct
- Ensure student properties are isolated

### Debug Commands

#### Check Student Data
```javascript
// In browser console
console.log('Current students:', students);
console.log('Current student:', students.find(s => s.id === currentStudentId));
```

#### Check Selection Data
```javascript
// In browser console
const student = students.find(s => s.id === currentStudentId);
console.log('Student selectedParagraphs:', student?.selectedParagraphs);
console.log('Current assessment ID:', currentAssessmentId);
console.log('Selections for current assessment:', student?.selectedParagraphs?.[currentAssessmentId]);
```

#### Force Data Refresh
```javascript
// In browser console (if needed)
selectedParagraphs = new Set(); // Clear current selections
await loadStudentEvaluation(); // Reload from storage
```

### File Locations

#### Data Storage
- **Students**: `FeedbackData/` directory (Tauri) or localStorage (web)
- **Evaluation Files**: `FeedbackData/student-evaluation-{studentId}-{assessmentId}.json`
- **Student Paragraphs**: `FeedbackData/student-paragraphs-{studentId}.json`

#### Configuration
- **Tauri Config**: `src-tauri/tauri.conf.json`
- **Student Service**: `src/services/dataService.js`
- **Main Logic**: `src/App.svelte`

### Performance Notes

#### Large Datasets
- Students with many assessments may have large `selectedParagraphs` objects
- Consider pagination if performance issues occur
- Monitor memory usage with large student lists

#### Network Issues (Web Version)
- Check network connectivity for data loading
- Verify localStorage quota if using web version
- Clear cache if data seems stale

### Support Information

#### Version Check
Current version: 3.2.9
- Real-time total marks display
- Enhanced text formatting with font colors
- Student-centric selection storage
- Manual row/column rubric mapping honored in PDF exports
- Backward compatibility maintained

#### Reporting Issues
When reporting issues, include:
1. Console output (debug messages)
2. Student data structure
3. Steps to reproduce
4. Expected vs actual behavior
5. Browser/Tauri version

#### Data Recovery
If data appears lost:
1. Check `FeedbackData/` directory for backup files
2. Look for recent evaluation files
3. Verify student IDs haven't changed
4. Check localStorage (web version) for cached data
