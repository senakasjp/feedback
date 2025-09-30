/**
 * Print Utilities for Feedback Manager
 * Modular functions for generating PDF reports
 */

import jsPDF from 'jspdf';

/**
 * Generates a PDF report of student marks table using jsPDF
 * @param {Array} studentsWithMarks - Array of students with marks
 * @param {Array} assessments - Array of assessments
 * @param {string} subjectName - Name of the subject
 * @param {Function} getStudentMarks - Function to get student marks for an assessment
 * @param {Function} getWeightedMarks - Function to get weighted marks for an assessment
 * @param {Function} getFinalGrade - Function to get final grade for a student
 */
export function printToDownload(studentsWithMarks, assessments, subjectName, getStudentMarks, getWeightedMarks, getFinalGrade) {
    console.log('printToDownload called with:', { studentsWithMarks: studentsWithMarks.length, assessments: assessments.length, subjectName });
    
    if (studentsWithMarks.length === 0 || assessments.length === 0) {
        console.log('No students or assessments, returning early');
        throw new Error('No students or assessments to print');
    }

    try {
        console.log('Creating PDF document...');
        const doc = new jsPDF('landscape', 'mm', 'a4');
        console.log('PDF document created successfully');
        
        // Page dimensions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const maxWidth = pageWidth - (margin * 2);
        
        let yPosition = margin;
        
        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${subjectName} - Student Marks Report`, margin, yPosition);
        yPosition += 10;
        
        // Date
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        doc.text(`Generated: ${dateStr}`, margin, yPosition);
        yPosition += 15;
        
        // Table headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        
        const headers = ['#', 'Student Name', 'Student ID'];
        assessments.forEach(assessment => {
            headers.push(`${assessment.name} (Marks)`);
            headers.push(`${assessment.name} (Weighted)`);
        });
        headers.push('Final Grade');
        
        // Calculate column widths
        const numColumns = headers.length;
        const colWidth = maxWidth / numColumns;
        
        // Draw table header
        let xPosition = margin;
        headers.forEach((header, index) => {
            // Draw cell background
            doc.setFillColor(240, 240, 240);
            doc.rect(xPosition, yPosition - 5, colWidth, 8, 'F');
            
            // Draw text
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(header, xPosition + 2, yPosition);
            xPosition += colWidth;
        });
        yPosition += 10;
        
        // Table data
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        studentsWithMarks.forEach((student, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
            }
            
            const rowData = [
                (index + 1).toString(),
                student.name,
                student.studentId
            ];
            
            assessments.forEach(assessment => {
                const marks = getStudentMarks(student.id, assessment.id);
                const marksValue = marks && marks.hasMarks ? String(marks.total) : 'No marks';
                
                const weighted = getWeightedMarks(student.id, assessment.id);
                const weightedValue = weighted ? weighted.displayValue : 'N/A';
                
                rowData.push(marksValue, weightedValue);
            });
            
            // Add final grade
            const finalGrade = getFinalGrade(student.id);
            rowData.push(finalGrade);
            
            // Draw table row
            xPosition = margin;
            rowData.forEach((cellData, cellIndex) => {
                // Truncate long text
                const maxTextWidth = colWidth - 4;
                let displayText = String(cellData);
                if (doc.getTextWidth(displayText) > maxTextWidth) {
                    while (doc.getTextWidth(displayText + '...') > maxTextWidth && displayText.length > 0) {
                        displayText = displayText.slice(0, -1);
                    }
                    displayText += '...';
                }
                
                doc.text(displayText, xPosition + 2, yPosition);
                xPosition += colWidth;
            });
            yPosition += 6;
        });
        
        // Footer
        yPosition += 10;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(`Total Students: ${studentsWithMarks.length}`, margin, yPosition);
        
        // Save PDF
        const safeSubjectName = subjectName.replace(/[^a-zA-Z0-9]/g, '-');
        const filename = `student-marks-${safeSubjectName}-${now.toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        console.log('PDF generated and saved successfully');
        return true;
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

/**
 * Generates a CSV export of student marks
 * @param {Array} studentsWithMarks - Array of students with marks
 * @param {Array} assessments - Array of assessments
 * @param {Function} getStudentMarks - Function to get student marks for an assessment
 * @param {Function} getWeightedMarks - Function to get weighted marks for an assessment
 * @param {Function} getFinalGrade - Function to get final grade for a student
 * @returns {string} CSV content
 */
export function generateCSVContent(studentsWithMarks, assessments, getStudentMarks, getWeightedMarks, getFinalGrade) {
    console.log('🔄 CSV Generation: Starting CSV generation');
    console.log('📊 CSV Generation: Input data -', {
        studentsCount: studentsWithMarks.length,
        assessmentsCount: assessments.length,
        studentsWithMarks: studentsWithMarks,
        assessments: assessments
    });
    
    if (studentsWithMarks.length === 0 || assessments.length === 0) {
        console.log('❌ CSV Generation: No data to generate CSV');
        return '';
    }

    // Create CSV headers
    const headers = ['Student Name', 'Student ID'];
    assessments.forEach(assessment => {
        headers.push(`${assessment.name} (Marks)`);
        headers.push(`${assessment.name} (Weight % & Weighted)`);
    });
    headers.push('Grade');

    console.log('📋 CSV Generation: Headers created -', headers);

    // Create CSV rows
    const rows = [headers.join(',')];
    
    studentsWithMarks.forEach((student, index) => {
        console.log(`🔄 CSV Generation: Processing student ${index + 1}:`, student);
        
        const row = [
            `"${student.name}"`,
            `"${student.studentId || 'N/A'}"`
        ];
        
        assessments.forEach(assessment => {
            const marks = getStudentMarks(student.id, assessment.id);
            const weighted = getWeightedMarks(student.id, assessment.id);
            
            console.log(`📊 CSV Generation: Student ${student.name}, Assessment ${assessment.name}:`, {
                marks: marks,
                weighted: weighted,
                assessmentWeight: assessment.weight
            });
            
            if (marks && marks.hasMarks) {
                row.push(String(marks.total));
                row.push(`"${assessment.weight || 0}% (${weighted ? weighted.weightedMarks.toFixed(1) : 0})"`);
            } else {
                row.push('No marks');
                row.push('No marks');
            }
        });
        
        const finalGrade = getFinalGrade(student.id);
        console.log(`📊 CSV Generation: Final grade for ${student.name}:`, finalGrade);
        row.push(`"${finalGrade}"`);
        rows.push(row.join(','));
    });

    const result = rows.join('\n');
    console.log('✅ CSV Generation: CSV generated successfully');
    console.log('📄 CSV Generation: Final result length:', result.length);
    console.log('📄 CSV Generation: Final result preview:', result.substring(0, 300) + '...');
    
    return result;
}
