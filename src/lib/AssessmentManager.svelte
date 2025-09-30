<script lang="ts">
	import { invoke } from '@tauri-apps/api/core'
	import { getDynamicColor, getGradeColor } from './colorUtils.js'
	import { generateCSVContent } from './printUtils.js'
	import jsPDF from 'jspdf'

  // Types
  type Assessment = {
    id: string;
    name: string;
    topics?: Topic[];
    categories?: Category[];
    weight?: number;
    headerPhoto?: string;
  }

  type Topic = {
    id: string;
    name: string;
  }

  type Category = {
    id: string;
    name: string;
    description?: string;
  }

  // Props
  let { 
    assessments = [], 
    students = [],
    subjectName = 'Unknown Subject',
    onSelectAssessment, 
    onUpdateAssessments,
		showAddAssessment = false,
		newAssessmentName = '',
		onAddAssessment,
		addCheckboxDebug = () => {}
  }: {
    assessments?: Assessment[];
    students?: any[];
    subjectName?: string;
    onSelectAssessment: (assessment: Assessment) => void;
    onUpdateAssessments: (assessments: Assessment[]) => void;
		showAddAssessment?: boolean;
		newAssessmentName?: string;
		onAddAssessment?: (name: string) => void;
		addCheckboxDebug?: (message: string) => void;
  } = $props()

	// Sort assessments alphabetically by name
	let sortedAssessments = $derived(
		[...assessments].sort((a, b) => a.name.localeCompare(b.name))
	)

  // Local state
	let showDeleteConfirm = $state(false);
	let assessmentToDelete = $state(null);
	let showStudentDeleteConfirm = $state(false);
	let studentToDelete = $state(null);
	let localNewAssessmentName = $state('');
	let studentEvaluations = $state({}); // Store student evaluation data
	let studentsWithMarks = $state([]); // Students who have marks for this subject
	let editingWeight = $state({}); // Track which weight is being edited
	let tempWeightValue = $state(''); // Temporary value while editing
	
	// Student reordering state
	let isReordering = $state(false);
	
	// Notification state
	let showNotification = $state(false);
	let notificationMessage = $state('');

	// Notification Functions
	function showSuccessNotification(message) {
		notificationMessage = message;
		showNotification = true;
		setTimeout(() => {
			showNotification = false;
		}, 3000); // Auto-hide after 3 seconds
	}

	// Functions
	// Ensure all assessments have categories array initialized
  $effect(() => {
    assessments.forEach(assessment => {
      if (!assessment.categories) {
				assessment.categories = [];
			}
		});
	});

	// Load student evaluation data for all students and assessments
	async function loadStudentEvaluations() {
		const evaluations = {};
		const studentsWithData = [];

		for (const student of students) {
			let hasMarksForSubject = false;
			const studentData = {};

			for (const assessment of assessments) {
				try {
					const data = await invoke('read_student_evaluation', { 
						studentId: student.id,
						assessmentId: assessment.id
					});
					
					if (data) {
						const evaluationData = JSON.parse(String(data));
						studentData[assessment.id] = evaluationData;
						
						// Check if student has marks for this assessment
						if (evaluationData.categoryMarks && Object.keys(evaluationData.categoryMarks).length > 0) {
							hasMarksForSubject = true;
						}
					}
				} catch (error) {
					// Try localStorage fallback
					try {
						const key = `student-evaluation-${student.id}-${assessment.id}`;
						const data = localStorage.getItem(key);
						if (data) {
							const evaluationData = JSON.parse(data);
							studentData[assessment.id] = evaluationData;
							
							// Check if student has marks for this assessment
							if (evaluationData.categoryMarks && Object.keys(evaluationData.categoryMarks).length > 0) {
								hasMarksForSubject = true;
							}
						}
					} catch (localError) {
						// No evaluation data found
					}
				}
			}

			if (Object.keys(studentData).length > 0) {
				evaluations[student.id] = studentData;
			}

			if (hasMarksForSubject) {
				studentsWithData.push(student);
			}
		}
		
		studentEvaluations = evaluations;
		studentsWithMarks = studentsWithData;
		
		// Debug logging
		console.log('=== STUDENT EVALUATIONS LOADED ===');
		console.log('Total students:', students.length);
		console.log('Students with marks:', studentsWithData.length);
		console.log('studentsWithMarks:', studentsWithMarks);
		console.log('assessments:', assessments);
	}

	// Load evaluations when component mounts or when students/assessments change
  $effect(() => {
    if (students.length > 0 && assessments.length > 0) {
			loadStudentEvaluations();
		}
	});

	// Helper function to get marks for a student-assessment combination
	function getStudentMarks(studentId: string, assessmentId: string) {
		const studentData = studentEvaluations[studentId];
		if (!studentData || !studentData[assessmentId]) {
			return null;
		}
		
		const evaluation = studentData[assessmentId];
		const categoryMarks = evaluation.categoryMarks || {};
		const manualTotal = evaluation.manualTotalMarks;
		
		// Calculate total from category marks if no manual total
		const calculatedTotal = Object.values(categoryMarks).reduce((total: number, marks: unknown) => {
			const numMarks = parseFloat(String(marks)) || 0;
			return total + numMarks;
		}, 0);
		
		// Prioritize calculated total from category marks, use manual total only if calculated is 0
		// This ensures we show the actual marks from categories
		const manualTotalNum = manualTotal ? parseFloat(String(manualTotal)) : 0;
		const finalTotal = Number(calculatedTotal) > 0 ? Number(calculatedTotal) : manualTotalNum;
		
		
		return {
			categoryMarks,
			total: finalTotal,
			hasMarks: Object.keys(categoryMarks).length > 0
		};
	}

	// Helper function to calculate weighted marks
	function getWeightedMarks(studentId: string, assessmentId: string) {
		const marks = getStudentMarks(studentId, assessmentId);
		const assessment = assessments.find(a => a.id === assessmentId);
		
		if (!marks || !marks.hasMarks || !assessment || !assessment.weight) {
			return null;
		}
		
		// Calculate weighted marks: marks × weight percentage
		const weightedMarks = Number(marks.total) * (assessment.weight / 100);
		return {
			weightedMarks: weightedMarks,
			displayValue: weightedMarks.toFixed(1)
		};
	}

	// Helper function to get the maximum possible raw marks for an assessment
	function getMaxPossibleRawMarks(assessmentId: string): number {
		const assessment = assessments.find(a => a.id === assessmentId);
		if (!assessment || !assessment.categories) {
			return 100; // Default fallback
		}
		const totalMarks = assessment.categories.reduce((total, category) => total + ((category as any).allocatedMarks || 0), 0);
		
		
		// If no allocated marks are set, use a default based on number of categories
		if (totalMarks === 0 && assessment.categories.length > 0) {
			return assessment.categories.length * 20; // 20 marks per category as default
		}
		
		return totalMarks || 100; // Fallback to 100 if still 0
	}

	// Helper function to calculate grade based on percentage
	function getGrade(percentage: number): string {
		if (percentage >= 90) return "A+";
		if (percentage >= 85) return "A";
		if (percentage >= 80) return "A-";
		if (percentage >= 75) return "B+";
		if (percentage >= 70) return "B";
		if (percentage >= 65) return "B-";
		if (percentage >= 60) return "C+";
		if (percentage >= 55) return "C";
		if (percentage >= 50) return "C-";
		if (percentage >= 40) return "D";
		return "E";
	}

	// Helper function to calculate final weighted grade for a student
	function getFinalGrade(studentId: string): string {
		let totalWeightedMarks = 0;
		let totalWeight = 0;
		let hasAnyMarks = false;
		let assessmentsWithMarks = 0;

		for (const assessment of assessments) {
			const weighted = getWeightedMarks(studentId, assessment.id);
			if (weighted) {
				totalWeightedMarks += weighted.weightedMarks;
				hasAnyMarks = true;
				assessmentsWithMarks++;
			}
			
			// Sum up the total weight percentage
			if (assessment.weight) {
				totalWeight += assessment.weight;
			}
		}

		// Don't provide final grade until each assessment has at least one result
		if (!hasAnyMarks || totalWeight === 0 || assessmentsWithMarks < assessments.length) {
			return "N/A";
		}

		// Calculate percentage: (actual weighted marks / total weight) * 100
		// This gives us the percentage out of the total possible weighted marks
		const finalPercentage = (totalWeightedMarks / totalWeight) * 100;
		
		// Debug logging
		console.log(`Final grade calculation for student ${studentId}:`, {
			totalWeightedMarks,
			totalWeight,
			assessmentsWithMarks,
			totalAssessments: assessments.length,
			finalPercentage: Math.round(finalPercentage * 100) / 100,
			grade: getGrade(finalPercentage)
		});
		
		return getGrade(finalPercentage);
	}

	// Print marks table to PDF
	// Print to download PDF function
	function generatePDFReport() {
		console.log('=== GENERATING PDF REPORT ===');
		console.log('studentsWithMarks:', studentsWithMarks.length);
		console.log('assessments:', assessments.length);
		console.log('subjectName:', subjectName);
		console.log('jsPDF available:', typeof jsPDF);
		console.log('jsPDF constructor:', jsPDF);
		
		try {
			console.log('Creating PDF document...');
			const doc = new jsPDF('landscape', 'mm', 'a4');
			console.log('PDF document created successfully:', doc);
			console.log('PDF page size:', doc.internal.pageSize.getWidth(), 'x', doc.internal.pageSize.getHeight());
			
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
			
			// Handle empty data case
			if (studentsWithMarks.length === 0) {
				console.log('No students with marks - adding test row');
				const testRow = ['1', 'Test Student', 'TEST001'];
				assessments.forEach(assessment => {
					testRow.push('No marks', 'N/A');
				});
				testRow.push('N/A');
				
				// Draw test row
				xPosition = margin;
				testRow.forEach((cellData) => {
					doc.text(String(cellData), xPosition + 2, yPosition);
					xPosition += colWidth;
				});
				yPosition += 6;
			} else {
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
			}
			
			// Footer
			yPosition += 10;
			doc.setFont('helvetica', 'italic');
			doc.setFontSize(8);
			doc.text(`Total Students: ${studentsWithMarks.length}`, margin, yPosition);
			
			// Save PDF
			const safeSubjectName = (subjectName || 'Unknown-Subject').replace(/[^a-zA-Z0-9]/g, '-');
			const filename = `student-marks-${safeSubjectName}-${now.toISOString().split('T')[0]}.pdf`;
			doc.save(filename);
			return true;
			
    } catch (error) {
			console.error('Error generating PDF:', error);
			throw error;
		}
	}

	// Print to download using the same approach as feedback page
	function handlePrintToDownload() {
		// Check if we have data
		if (studentsWithMarks.length === 0) {
			showSuccessNotification('No students with marks found. Please add student marks first.');
			return;
		}
		
		if (assessments.length === 0) {
			showSuccessNotification('No assessments found. Please add assessments first.');
			return;
		}
		
		// Generate PDF directly without confirmation
		
		// Generate PDF using the same approach as feedback page
		const doc = new jsPDF('landscape', 'mm', 'a4');
		
		// Page dimensions
		const margin = 20;
		const pageWidth = doc.internal.pageSize.getWidth();
		const pageHeight = doc.internal.pageSize.getHeight();
		let yPosition = margin;
		
		// Simple header with light gray background
		doc.setFillColor(248, 249, 250); // Light gray background
		doc.rect(0, 0, pageWidth, 35, 'F'); // Full width header background
		
		// Main title with dark text (same as feedback report)
		doc.setTextColor(0, 0, 0); // Black text
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10); // Same as feedback report
		doc.text('Student Marks Report', margin, 15);

		// Subtitle
		doc.setFontSize(10); // Same as feedback report
		doc.text('Academic Performance Overview', margin, 25);
		
		// Reset text color and position for content
		doc.setTextColor(0, 0, 0); // Black text
		yPosition = 45;
		
		// Simple info section with word wrapping
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(10);
		
		// Subject and date in two lines
		let subjectText = '';
		let dateText = '';
		if (subjectName) {
			subjectText = `Subject: ${subjectName}`;
		}
		dateText = `Date: ${new Date().toLocaleDateString()}`;
		
		// Display subject and date in two lines
		const maxWidth = pageWidth - (margin * 2);
		
		// Subject line
		if (subjectText) {
			const subjectLines = doc.splitTextToSize(subjectText, maxWidth);
			subjectLines.forEach((line, index) => {
				doc.text(line, margin, yPosition + (index * 5));
			});
			yPosition += (subjectLines.length * 5);
		}
		
		// Date line
		if (dateText) {
			const dateLines = doc.splitTextToSize(dateText, maxWidth);
			dateLines.forEach((line, index) => {
				doc.text(line, margin, yPosition + (index * 5));
			});
			yPosition += (dateLines.length * 5);
		}
		
		yPosition += 10;
		
		// Create proper column layout with fixed widths
		const basicHeaders = ['#', 'Student Name', 'Student ID'];
		const allHeaders = [...basicHeaders, 'Final Grade'];
		
		// Add assessment columns (2 per assessment: Marks and Percentage)
		assessments.forEach((assessment) => {
			allHeaders.push(`${assessment.name} (Marks)`);
			allHeaders.push(`${assessment.name} (${assessment.weight}%)`);
		});
		
		// Calculate column widths - give more space to student names and assessment names
		const totalCols = basicHeaders.length + (assessments.length * 2) + 1; // +1 for Final Grade
		const availableWidth = pageWidth - (margin * 2);
		
		// Define column widths based on content type
		const colWidths = [];
		basicHeaders.forEach((header, index) => {
			if (header === 'Student Name') {
				colWidths.push(availableWidth * 0.25); // 25% for student names
			} else {
				colWidths.push(availableWidth * 0.08); // 8% for # and Student ID
			}
		});
		
		// Assessment columns - share remaining space equally
		const remainingWidth = availableWidth - colWidths.reduce((sum, width) => sum + width, 0) - (availableWidth * 0.1); // 10% for Final Grade
		const assessmentColWidth = remainingWidth / (assessments.length * 2);
		
		assessments.forEach(() => {
			colWidths.push(assessmentColWidth); // Marks column
			colWidths.push(assessmentColWidth); // Weighted column
		});
		
		colWidths.push(availableWidth * 0.1); // Final Grade
		
		// Calculate maximum header height needed for word wrapping
		let maxHeaderHeight = 8; // Base height
		let allHeaderLines = [];
		
		// Check basic headers
		basicHeaders.forEach((header, index) => {
			const lines = doc.splitTextToSize(header, colWidths[index] - 4);
			allHeaderLines.push(lines);
			maxHeaderHeight = Math.max(maxHeaderHeight, lines.length * 4);
		});
		
		// Check assessment headers
		assessments.forEach((assessment, assessmentIndex) => {
			const marksHeader = `${assessment.name} (Marks)`;
			const weightHeader = `${assessment.name} (${assessment.weight}%)`;

			const marksLines = doc.splitTextToSize(marksHeader, colWidths[basicHeaders.length + (assessmentIndex * 2)] - 4);
			const weightLines = doc.splitTextToSize(weightHeader, colWidths[basicHeaders.length + (assessmentIndex * 2) + 1] - 4);

			allHeaderLines.push(marksLines, weightLines);
			maxHeaderHeight = Math.max(maxHeaderHeight, marksLines.length * 4, weightLines.length * 4);
		});
		
		// Check final grade header
		const finalGradeLines = doc.splitTextToSize('Final Grade', colWidths[colWidths.length - 1] - 4);
		allHeaderLines.push(finalGradeLines);
		maxHeaderHeight = Math.max(maxHeaderHeight, finalGradeLines.length * 4);
		
		// Add padding to header height - dynamic based on content
		const headerHeight = Math.max(15, maxHeaderHeight + 6);
		
		// Draw header background with light gray
		doc.setFillColor(248, 249, 250);
		doc.rect(margin, yPosition - 5, availableWidth, headerHeight, 'F');
		
		// Headers with proper width constraints (same as feedback report)
		doc.setTextColor(0, 0, 0);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10); // Same as feedback report
		
		let xPosition = margin;
		let headerLineIndex = 0;
		
		basicHeaders.forEach((header, index) => {
			const lines = allHeaderLines[headerLineIndex++];
			doc.text(lines, xPosition + 2, yPosition + 2);
			xPosition += colWidths[index];
		});
		
		// Assessment headers with proper width constraints
		assessments.forEach((assessment, assessmentIndex) => {
			// Marks header
			const marksLines = allHeaderLines[headerLineIndex++];
			doc.text(marksLines, xPosition + 2, yPosition + 2);
			xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2)];

			// Percentage header
			const weightLines = allHeaderLines[headerLineIndex++];
			doc.text(weightLines, xPosition + 2, yPosition + 2);
			xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2) + 1];
		});
		
		// Final Grade header
		const finalGradeHeaderLines = allHeaderLines[headerLineIndex++];
		doc.text(finalGradeHeaderLines, xPosition + 2, yPosition + 2);
		
		// Reset text color for table content and position below header
		doc.setTextColor(0, 0, 0);
		yPosition += headerHeight + 5; // Position data below header background with dynamic gap
		
		// Check if table fits on current page, if not start on new page
		const estimatedRowHeight = 8; // Estimated height per student row
		const rowsPerPage = Math.floor((pageHeight - yPosition - margin) / estimatedRowHeight);
		
		if (studentsWithMarks.length > rowsPerPage && yPosition > pageHeight - 100) {
			doc.addPage();
			yPosition = margin + 50; // Start with some space for header info
			
			// Redraw subject and date on new page
			if (subjectText) {
				const subjectLines = doc.splitTextToSize(subjectText, maxWidth);
				subjectLines.forEach((line, index) => {
					doc.text(line, margin, yPosition + (index * 5));
				});
				yPosition += (subjectLines.length * 5);
			}
			
			if (dateText) {
				const dateLines = doc.splitTextToSize(dateText, maxWidth);
				dateLines.forEach((line, index) => {
					doc.text(line, margin, yPosition + (index * 5));
				});
				yPosition += (dateLines.length * 5);
			}
			
			yPosition += 10;
			
			// Redraw table headers on new page
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(10);
			
			// Draw header background with light gray
			doc.setFillColor(248, 249, 250);
			doc.rect(margin, yPosition - 5, availableWidth, headerHeight, 'F');
			
			// Redraw all headers
			let xPosition = margin;
			let headerLineIndex = 0;
			
			basicHeaders.forEach((header, index) => {
				const lines = allHeaderLines[headerLineIndex++];
				doc.text(lines, xPosition + 2, yPosition + 2);
				xPosition += colWidths[index];
			});
			
			assessments.forEach((assessment, assessmentIndex) => {
				const marksLines = allHeaderLines[headerLineIndex++];
				doc.text(marksLines, xPosition + 2, yPosition + 2);
				xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2)];

				const weightLines = allHeaderLines[headerLineIndex++];
				doc.text(weightLines, xPosition + 2, yPosition + 2);
				xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2) + 1];
			});
			
			const finalGradeHeaderLines = allHeaderLines[headerLineIndex++];
			doc.text(finalGradeHeaderLines, xPosition + 2, yPosition + 2);
			
			yPosition += headerHeight + 5;
		}
		
		// Add table data (same as feedback report)
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(10); // Same as feedback report
		
		studentsWithMarks.forEach((student, index) => {
			// Check if we need a new page for each row
			if (yPosition > pageHeight - 30) {
				doc.addPage();
				yPosition = margin + 50; // Start with some space for header info
				
				// Redraw subject and date on new page
				if (subjectText) {
					const subjectLines = doc.splitTextToSize(subjectText, maxWidth);
					subjectLines.forEach((line, index) => {
						doc.text(line, margin, yPosition + (index * 5));
					});
					yPosition += (subjectLines.length * 5);
				}
				
				if (dateText) {
					const dateLines = doc.splitTextToSize(dateText, maxWidth);
					dateLines.forEach((line, index) => {
						doc.text(line, margin, yPosition + (index * 5));
					});
					yPosition += (dateLines.length * 5);
				}
				
				yPosition += 10;
				
				// Redraw table headers on new page
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(10);
				
				// Draw header background with light gray
				doc.setFillColor(248, 249, 250);
				doc.rect(margin, yPosition - 5, availableWidth, headerHeight, 'F');
				
				// Redraw all headers
				let xPosition = margin;
				let headerLineIndex = 0;
				
				basicHeaders.forEach((header, index) => {
					const lines = allHeaderLines[headerLineIndex++];
					doc.text(lines, xPosition + 2, yPosition + 2);
					xPosition += colWidths[index];
				});
				
				assessments.forEach((assessment, assessmentIndex) => {
					const marksLines = allHeaderLines[headerLineIndex++];
					doc.text(marksLines, xPosition + 2, yPosition + 2);
					xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2)];

					const weightLines = allHeaderLines[headerLineIndex++];
					doc.text(weightLines, xPosition + 2, yPosition + 2);
					xPosition += colWidths[basicHeaders.length + (assessmentIndex * 2) + 1];
				});
				
				const finalGradeHeaderLines = allHeaderLines[headerLineIndex++];
				doc.text(finalGradeHeaderLines, xPosition + 2, yPosition + 2);
				
				yPosition += headerHeight + 5;
				
				// Reset font for data
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(10);
			}
			
			const rowData = [
				String(index + 1),
				student.name,
				student.studentId
			];
			
			assessments.forEach(assessment => {
				const marks = getStudentMarks(student.id, assessment.id);
				if (marks && marks.hasMarks) {
					rowData.push(String(marks.total));
				} else {
					rowData.push('No marks');
				}
				
				const weighted = getWeightedMarks(student.id, assessment.id);
				const weightedValue = weighted ? weighted.displayValue : 'N/A';
				rowData.push(weightedValue);
			});
			
			const finalGrade = getFinalGrade(student.id);
			rowData.push(finalGrade);
			
			// Draw row data with proper column widths
			xPosition = margin;
			let maxCellHeight = 6; // Default row height
			
				rowData.forEach((cellData, cellIndex) => {
					let displayText = String(cellData);
					const currentColWidth = colWidths[cellIndex];

					// For student names, truncate to first three words if more than three words
					if (cellIndex === 1) { // Student Name column
						const words = displayText.split(' ');
						if (words.length > 3) {
							displayText = words.slice(0, 3).join(' ') + '...';
						}
					}

					// Use word wrapping for table cells with proper width constraint
					const cellLines = doc.splitTextToSize(displayText, currentColWidth - 4);

					// For student names, use word wrapping and track height
					if (cellIndex === 1) { // Student Name column
						doc.text(cellLines, xPosition + 2, yPosition);
						if (cellLines.length > 1) {
							maxCellHeight = Math.max(maxCellHeight, cellLines.length * 4);
						}
					} else {
						// For other columns, use first line if it wraps
						doc.text(cellLines[0] || '', xPosition + 2, yPosition);
					}

					xPosition += currentColWidth;
				});
			yPosition += maxCellHeight;
		});
		
		// Add grade distribution table - check if it fits on current page
		yPosition += 8; // Reduced spacing for compactness
		
		// Check if grade distribution fits on current page
		if (yPosition > pageHeight - 80) {
			doc.addPage();
			yPosition = margin + 20;
			
			// Redraw subject and date on new page
			if (subjectText) {
				const subjectLines = doc.splitTextToSize(subjectText, maxWidth);
				subjectLines.forEach((line, index) => {
					doc.text(line, margin, yPosition + (index * 5));
				});
				yPosition += (subjectLines.length * 5);
			}
			
			if (dateText) {
				const dateLines = doc.splitTextToSize(dateText, maxWidth);
				dateLines.forEach((line, index) => {
					doc.text(line, margin, yPosition + (index * 5));
				});
				yPosition += (dateLines.length * 5);
			}
			
			yPosition += 15;
		}
		
		// Calculate grade distribution - include all grades even if 0 students
		const gradeDistribution = {};
		const allPossibleGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E']; // Define all possible grades
		
		// Grade ranges mapping
		const gradeRanges = {
			'A+': '90-100%',
			'A': '85-89%',
			'A-': '80-84%',
			'B+': '75-79%',
			'B': '70-74%',
			'B-': '65-69%',
			'C+': '60-64%',
			'C': '55-59%',
			'C-': '50-54%',
			'D': '40-49%',
			'E': '0-39%'
		};
		
		// Initialize all grades with 0
		allPossibleGrades.forEach(grade => {
			gradeDistribution[grade] = 0;
		});
		
		// Count actual grades (exclude N/A)
		studentsWithMarks.forEach(student => {
			const finalGrade = getFinalGrade(student.id);
			if (finalGrade && finalGrade !== 'N/A' && allPossibleGrades.includes(finalGrade)) {
				gradeDistribution[finalGrade] = (gradeDistribution[finalGrade] || 0) + 1;
			}
		});
		
		// Add grade distribution header (compact)
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(9); // Smaller font for compactness
		doc.setTextColor(0, 0, 0);
		doc.text('Grade Distribution Summary', margin, yPosition);
		yPosition += 5; // Reduced spacing
		
		// Create grade distribution table (always show all grades)
		if (true) { // Always show the table
			// Table headers (compact)
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(9); // Smaller font for compactness

			// Grade distribution table background (match table size)
			// Calculate actual table width based on column positioning
			// Grade: margin+3, Count: margin+35, Percentage: margin+70, Range: margin+105
			// Table ends after "Range" text which is around margin+140
			const gradeTableWidth = 145; // Width from margin to end of last column
			
			doc.setFillColor(248, 249, 250);
			doc.rect(margin, yPosition - 1, gradeTableWidth, 4, 'F'); // Match table row height

			// Headers (distributed positioning across 4 columns)
			doc.text('Grade', margin + 3, yPosition + 1); // Left aligned
			doc.text('Count', margin + 35, yPosition + 1); // Second column
			doc.text('Percentage %', margin + 70, yPosition + 1); // Third column
			doc.text('Range', margin + 115, yPosition + 1); // Fourth column (right aligned)

			yPosition += 4; // Match table row spacing
			
			// Grade distribution data (compact)
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9); // Smaller font for compactness

			// Calculate total students with actual grades (exclude N/A)
			const totalStudents = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);

			// Use predefined grade order for consistent display
			const sortedGrades = allPossibleGrades;

			sortedGrades.forEach(grade => {
				const count = gradeDistribution[grade];
				const percentage = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
				const range = gradeRanges[grade] || 'N/A';

				doc.text(grade, margin + 3, yPosition + 1); // Left aligned
				doc.text(count.toString(), margin + 35, yPosition + 1); // Second column
				doc.text(`${percentage}%`, margin + 70, yPosition + 1); // Third column
				doc.text(range, margin + 115, yPosition + 1); // Fourth column (right aligned)

				yPosition += 4; // Reduced row spacing
			});
		} else {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9); // Smaller font for compactness
			doc.setTextColor(108, 117, 125);
			doc.text('No final grades available', margin, yPosition);
			yPosition += 4; // Reduced spacing
		}
		
		// Simple footer (same as feedback report)
		yPosition += 8; // Reduced spacing for compactness
		doc.setFont('helvetica', 'italic');
		doc.setFontSize(10); // Same as feedback report
		doc.setTextColor(108, 117, 125); // Gray text
		doc.text(`${new Date().toLocaleDateString()}`, margin, yPosition);
		
		// Save PDF
		const safeSubjectName = (subjectName || 'Unknown-Subject').replace(/[^a-zA-Z0-9]/g, '-');
		const filename = `student-marks-${safeSubjectName}-${new Date().toISOString().split('T')[0]}.pdf`;
		doc.save(filename);
		
		showSuccessNotification('PDF generated and downloaded successfully!');
	}

	// CSV Export confirmation modal state
	let showCSVExportModal = $state(false);
	let csvExportConfirmed = $state(false);

	// Export marks to CSV using Tauri native file system
	async function exportToCSV() {
		// Show immediate notification to test if function is called
		showSuccessNotification('CSV Export function called!');
		addCheckboxDebug('🔄 CSV Export: Starting export process');
		
		console.log('🔄 CSV Export: Starting export process');
		console.log('📊 CSV Export: Data check -', {
			studentsWithMarks: studentsWithMarks.length,
			assessments: assessments.length,
			subjectName: subjectName
		});
		
		addCheckboxDebug(`📊 CSV Export: Data check - Students: ${studentsWithMarks.length}, Assessments: ${assessments.length}, Subject: ${subjectName}`);
		
		// Reset confirmation state and show modal
		csvExportConfirmed = false;
		showCSVExportModal = true;
	}

	// Handle CSV export confirmation
	async function confirmCSVExport() {
		showCSVExportModal = false;
		csvExportConfirmed = true;
		
		console.log('✅ CSV Export: User confirmed export');
		addCheckboxDebug('✅ CSV Export: User confirmed export');
		
		await performCSVExport();
	}

	// Cancel CSV export
	function cancelCSVExport() {
		showCSVExportModal = false;
		csvExportConfirmed = false;
		
		console.log('❌ CSV Export: User cancelled export');
		addCheckboxDebug('❌ CSV Export: User cancelled export');
	}

	// Perform the actual CSV export
	async function performCSVExport() {
		try {
			console.log('🔄 CSV Export: Generating CSV content...');
			addCheckboxDebug('🔄 CSV Export: Generating CSV content...');
			
			const csvContent = generateCSVContent(
				studentsWithMarks,
				assessments,
				getStudentMarks,
				getWeightedMarks,
				getFinalGrade
			);

			console.log('📄 CSV Export: Generated content length:', csvContent.length);
			console.log('📄 CSV Export: Content preview:', csvContent.substring(0, 200) + '...');
			addCheckboxDebug(`📄 CSV Export: Generated content length: ${csvContent.length}`);
			addCheckboxDebug(`📄 CSV Export: Content preview: ${csvContent.substring(0, 100)}...`);

			if (!csvContent) {
				console.log('❌ CSV Export: No content generated');
				addCheckboxDebug('❌ CSV Export: No content generated');
				showSuccessNotification('No data to export');
				return;
			}

			// Try Tauri first (desktop app)
			try {
				console.log('🔄 CSV Export: Attempting Tauri file save...');
				addCheckboxDebug('🔄 CSV Export: Attempting Tauri file save...');
				
				const filePath = await invoke('export_csv_file', { 
					content: csvContent, 
					subjectName: subjectName || 'Unknown-Subject' 
				});
				
				console.log('✅ CSV Export: Tauri save successful:', filePath);
				addCheckboxDebug(`✅ CSV Export: Tauri save successful: ${filePath}`);
				showSuccessNotification(`CSV file saved successfully to: ${filePath}`);
			} catch (tauriError) {
				console.log('⚠️ CSV Export: Tauri failed, falling back to browser:', tauriError);
				addCheckboxDebug(`⚠️ CSV Export: Tauri failed, falling back to browser: ${tauriError.message}`);
				
				// Fallback to browser download for web development
				const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
				const link = document.createElement('a');
				const url = URL.createObjectURL(blob);
				link.setAttribute('href', url);
				
				// Generate filename with current date
				const now = new Date();
				const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
				const safeSubjectName = (subjectName || 'Unknown-Subject').replace(/[^a-zA-Z0-9]/g, '-'); // Replace special chars with dashes
				link.setAttribute('download', `student-marks-${safeSubjectName}-${dateStr}.csv`);
				
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				
				console.log('✅ CSV Export: Browser download completed');
				addCheckboxDebug('✅ CSV Export: Browser download completed');
				showSuccessNotification('CSV file downloaded successfully!');
			}
      } catch (error) {
			console.error('❌ CSV Export: Error occurred:', error);
			addCheckboxDebug(`❌ CSV Export: Error occurred: ${error.message}`);
			showSuccessNotification('Error exporting CSV: ' + error.message);
		}
	}

	// Weight editing functions
	function startEditingWeight(assessmentId: string) {
		editingWeight = { ...editingWeight, [assessmentId]: true };
		tempWeightValue = assessments.find(a => a.id === assessmentId)?.weight?.toString() || '';
		
		// Focus the input field after the DOM updates
		setTimeout(() => {
			const input = document.querySelector(`input[data-assessment-id="${assessmentId}"]`) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		}, 100);
	}

	function cancelEditingWeight(assessmentId: string) {
		editingWeight = { ...editingWeight, [assessmentId]: false };
		tempWeightValue = '';
	}

	function saveWeight(assessmentId: string) {
		const weight = tempWeightValue.trim() ? parseFloat(tempWeightValue) : undefined;
		
		// Update the assessment weight
		const assessment = assessments.find(a => a.id === assessmentId);
		if (assessment) {
			assessment.weight = weight;
			onUpdateAssessments([...assessments]);
		}
		
		editingWeight = { ...editingWeight, [assessmentId]: false };
		tempWeightValue = '';
	}

	function handleWeightKeydown(event: KeyboardEvent, assessmentId: string) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveWeight(assessmentId);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditingWeight(assessmentId);
		}
	}

	function removeAssessment(assessmentId: string) {
		const assessment = assessments.find(a => a.id === assessmentId);
		if (assessment) {
			assessmentToDelete = assessment;
			showDeleteConfirm = true;
		}
	}

	function confirmDelete() {
		if (assessmentToDelete) {
			const updatedAssessments = assessments.filter(a => a.id !== assessmentToDelete.id);
			assessments = updatedAssessments;
			onUpdateAssessments(updatedAssessments);
			showDeleteConfirm = false;
			assessmentToDelete = null;
		}
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		assessmentToDelete = null;
	}

	function addAssessment() {
		if (localNewAssessmentName.trim()) {
			const newAssessment = {
				id: Date.now().toString(),
				name: localNewAssessmentName.trim(),
				topics: [],
				categories: []
			};
			
			const updatedAssessments = [...assessments, newAssessment];
			assessments = updatedAssessments;
			onUpdateAssessments(updatedAssessments);
			
			// Reset form
			localNewAssessmentName = '';
			
			// Call parent add function if provided
			if (onAddAssessment) {
				onAddAssessment(newAssessment.name);
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			addAssessment();
		}
	}

	// Helper function to get performance highlights (top, medium, lowest)
	function getPerformanceHighlights() {
		if (studentsWithMarks.length === 0) {
			return { topPerformer: null, mediumPerformer: null, lowestPerformer: null };
		}

		// Calculate final percentages for all students
		const studentPerformances = studentsWithMarks.map(student => {
			let totalWeightedMarks = 0;
			let totalWeight = 0;
			let hasAnyMarks = false;

			for (const assessment of assessments) {
				const weighted = getWeightedMarks(student.id, assessment.id);
				if (weighted) {
					totalWeightedMarks += weighted.weightedMarks;
					hasAnyMarks = true;
				}
				
				if (assessment.weight) {
					totalWeight += assessment.weight;
				}
			}

			const percentage = hasAnyMarks && totalWeight > 0 ? (totalWeightedMarks / totalWeight) * 100 : 0;
			const finalGrade = getFinalGrade(student.id);

			return {
				student,
				percentage,
				finalGrade,
				totalWeightedMarks,
				totalWeight
			};
		}).filter(perf => perf.percentage > 0).sort((a, b) => b.percentage - a.percentage);

		if (studentPerformances.length === 0) {
			return { topPerformer: null, mediumPerformer: null, lowestPerformer: null };
		}

		const topPerformer = studentPerformances[0];
		const lowestPerformer = studentPerformances[studentPerformances.length - 1];
		const mediumIndex = Math.floor(studentPerformances.length / 2);
		const mediumPerformer = studentPerformances[mediumIndex];

		return { topPerformer, mediumPerformer, lowestPerformer };
	}

	// Helper function to get performance highlights for a specific assessment
	function getAssessmentPerformanceHighlights(assessmentId: string) {
		const assessment = assessments.find(a => a.id === assessmentId);
		if (!assessment) return { highestPerformers: [], mediumPerformers: [], needsSupport: [] };

		// Get all students with marks for this specific assessment
		const studentsWithAssessmentMarks = studentsWithMarks.filter(student => {
			const marks = getStudentMarks(student.id, assessmentId);
			return marks && marks.hasMarks;
		});

		if (studentsWithAssessmentMarks.length === 0) {
			return { highestPerformers: [], mediumPerformers: [], needsSupport: [] };
		}

		// Calculate percentages for each student for this assessment
		const studentPerformances = studentsWithAssessmentMarks.map(student => {
			const marks = getStudentMarks(student.id, assessmentId);
			const maxMarks = getMaxPossibleRawMarks(assessmentId);
			const percentage = maxMarks > 0 ? (marks.total / maxMarks) * 100 : 0;
			const grade = getGrade(percentage);

			return {
				student,
				marks: marks.total,
				percentage,
				grade,
				maxMarks
			};
		}).sort((a, b) => b.percentage - a.percentage);

		// Group students by performance levels - focusing on same marks
		const highestPerformers = [];
		const mediumPerformers = [];
		const needsSupport = [];

		if (studentPerformances.length === 0) {
			return { highestPerformers, mediumPerformers, needsSupport };
		}

		// Find the highest percentage achieved
		const highestPercentage = studentPerformances[0]?.percentage || 0;
		
		// Find the middle percentage (median)
		const middleIndex = Math.floor(studentPerformances.length / 2);
		const middlePercentage = studentPerformances[middleIndex]?.percentage || 0;
		
		// Find the lowest percentage achieved
		const lowestPercentage = studentPerformances[studentPerformances.length - 1]?.percentage || 0;
		
		// Group students by their performance levels
		studentPerformances.forEach(perf => {
			if (perf.percentage === highestPercentage) {
				// All students with the highest percentage
				highestPerformers.push(perf);
			} else if (perf.percentage === middlePercentage && perf.percentage !== highestPercentage) {
				// All students with the middle percentage (but not if it's the same as highest)
				mediumPerformers.push(perf);
			} else if (perf.percentage === lowestPercentage) {
				// All students with the lowest percentage (same lowest marks grouped together)
				needsSupport.push(perf);
			}
		});

		// If no medium performers found with exact middle percentage, find students around middle range
		if (mediumPerformers.length === 0 && studentPerformances.length > 2) {
			// Find students that are not highest or lowest performers
			const middleRangeStudents = studentPerformances.filter(perf => 
				perf.percentage !== highestPercentage && perf.percentage !== lowestPercentage
			);
			
			// Add middle range students to medium performers
			mediumPerformers.push(...middleRangeStudents);
		}

		return { highestPerformers, mediumPerformers, needsSupport };
	}

	// Helper function to get grade distribution
	function getGradeDistribution() {
		const gradeCounts = {};
		
		studentsWithMarks.forEach(student => {
			const grade = getFinalGrade(student.id);
			gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
		});

		const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E'];
		const gradeLabels = {
			'A+': 'A+ (90-100%)',
			'A': 'A (85-89%)',
			'A-': 'A- (80-84%)',
			'B+': 'B+ (75-79%)',
			'B': 'B (70-74%)',
			'B-': 'B- (65-69%)',
			'C+': 'C+ (60-64%)',
			'C': 'C (55-59%)',
			'C-': 'C- (50-54%)',
			'D': 'D (40-49%)',
			'E': 'E (0-39%)'
		};

		return gradeOrder.map(grade => ({
			grade,
			label: gradeLabels[grade] || grade,
			count: gradeCounts[grade] || 0,
			color: getGradeColor(grade)
		}));
	}

	// Student reordering functions
	function moveStudentUp(index) {
		if (index > 0) {
			isReordering = true;
			const newStudentsWithMarks = [...studentsWithMarks];
			// Swap with previous student
			[newStudentsWithMarks[index], newStudentsWithMarks[index - 1]] = 
			[newStudentsWithMarks[index - 1], newStudentsWithMarks[index]];
			studentsWithMarks = newStudentsWithMarks;
			// Reset reordering flag after a brief delay for visual feedback
			setTimeout(() => isReordering = false, 200);
		}
	}

	function moveStudentDown(index) {
		if (index < studentsWithMarks.length - 1) {
			isReordering = true;
			const newStudentsWithMarks = [...studentsWithMarks];
			// Swap with next student
			[newStudentsWithMarks[index], newStudentsWithMarks[index + 1]] = 
			[newStudentsWithMarks[index + 1], newStudentsWithMarks[index]];
			studentsWithMarks = newStudentsWithMarks;
			// Reset reordering flag after a brief delay for visual feedback
			setTimeout(() => isReordering = false, 200);
		}
	}

	// Show delete confirmation modal for student
	function deleteStudentFromSubject(studentId) {
		const student = students.find(s => s.id === studentId);
		if (!student) return;
		
		studentToDelete = student;
		showStudentDeleteConfirm = true;
	}

	// Confirm delete student from subject
	async function confirmStudentDelete() {
		if (!studentToDelete) return;

		try {
			// Delete evaluation data for each assessment in this subject
			for (const assessment of assessments) {
				try {
					// Try Tauri first
					await invoke('write_student_evaluation', {
						studentId: studentToDelete.id,
						assessmentId: assessment.id,
						data: JSON.stringify({
							studentId: studentToDelete.id,
							assessmentId: assessment.id,
							paragraphs: [],
							selectedParagraphs: [],
							studentName: '',
							studentImage: '',
							categoryMarks: {},
							manualTotalMarks: '',
							savedAt: new Date().toISOString()
						}, null, 2)
					});
				} catch (error) {
					// Fallback to localStorage
					const key = `student-evaluation-${studentToDelete.id}-${assessment.id}`;
					localStorage.removeItem(key);
				}
			}

			// Reload student evaluations to update the display
			await loadStudentEvaluations();
			
			// Close modal and show success notification
			showStudentDeleteConfirm = false;
			studentToDelete = null;
			alert(`${studentToDelete?.name || 'Student'} has been successfully removed from this subject.`);
    } catch (error) {
			console.error('Error deleting student from subject:', error);
			alert('Error removing student from subject. Please try again.');
		}
	}

	// Cancel student delete
	function cancelStudentDelete() {
		showStudentDeleteConfirm = false;
		studentToDelete = null;
	}
</script>

<style>
	.drag-row {
		transition: all 0.2s ease;
	}
	
	.drag-row:hover {
		background-color: rgba(0, 123, 255, 0.05);
	}
	
	.bi-grip-vertical:hover {
		color: #0d6efd !important;
	}
	
	.btn-sm.btn-outline-secondary:hover {
		background-color: #6c757d;
		border-color: #6c757d;
		color: white;
	}
	
	.btn-sm.btn-outline-secondary:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>

<div class="container-fluid">

	<!-- Add Assessment Form -->
	{#if showAddAssessment}
		<div class="row mb-4">
			<div class="col-12">
				<div class="card border-success">
					<div class="card-header bg-success text-white py-2">
						<h5 class="card-title mb-0">
							<i class="bi bi-plus-circle me-2"></i>Add New Assessment
						</h5>
    </div>
					<div class="card-body">
						<div class="row">
							<div class="col-12">
								<label for="assessmentName" class="form-label">Assessment Name:</label>
								<input
									id="assessmentName"
									type="text"
									class="form-control form-control-sm"
									placeholder="Enter assessment name..."
									bind:value={localNewAssessmentName}
									onkeydown={handleKeydown}
								>
							</div>
						</div>
						<div class="mt-3">
      <button 
								class="btn btn-success"
								onclick={addAssessment}
								disabled={!localNewAssessmentName.trim()}
							>
								<i class="bi bi-plus-circle me-1"></i>Add Assessment
      </button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if sortedAssessments.length > 0}
		<div class="d-flex flex-wrap gap-3">
			{#each sortedAssessments as assessment}
				<div class="border rounded p-3 shadow-sm d-flex flex-column" style="min-width: 300px; max-width: 350px; aspect-ratio: 1; height: 300px;">
					<!-- Header Section -->
					<div class="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
							<div class="d-flex align-items-center">
								<i class="bi bi-clipboard-check text-primary me-2" style="font-size: 1.5rem;"></i>
								<h6 class="mb-0">Assessment</h6>
							</div>
      <button 
							class="btn btn-sm btn-outline-danger border-0"
							onclick={() => removeAssessment(assessment.id)}
							title="Delete assessment"
							aria-label="Delete assessment"
						>
							<i class="bi bi-x"></i>
      </button>
					</div>
					
					<!-- Content Section -->
					<div class="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center">
						<h5 class="mb-3 fw-normal">{assessment.name}</h5>
						<div class="d-flex gap-2 mb-4">
							<span class="badge bg-info">
								<i class="bi bi-book me-1"></i>
								{assessment.topics?.length || 0} topics
							</span>
							<span class="badge bg-success">
								<i class="bi bi-tags me-1"></i>
								{assessment.categories?.length || 0} categories
							</span>
    </div>
  </div>

					<!-- Action Section -->
					<div class="flex-shrink-0">
						<button 
							class="btn btn-success w-100"
							onclick={() => onSelectAssessment(assessment)}
						>
							<i class="bi bi-arrow-right me-2"></i>Open Feedback
						</button>
    </div>
				</div>
			{/each}
		</div>
		
		<!-- Students with Marks Table -->
		{#if studentsWithMarks.length > 0 && assessments.length > 0}
			<div class="row mt-5">
				<div class="col-12">
					<div class="card">
						<div class="card-header d-flex justify-content-between align-items-center">
							<div>
								<h5 class="card-title mb-0">
									<i class="bi bi-people me-2"></i>Students with Marks
								</h5>
								<p class="text-muted mb-0 small">Students who have marks for assessments in this subject</p>
    </div>
							<div class="btn-group" role="group">
								<!-- Test button - always enabled -->
								<button 
									class="btn btn-outline-danger btn-sm"
									onclick={handlePrintToDownload}
									title="Generate and download PDF marks report"
								>
									<i class="bi bi-file-earmark-pdf me-1"></i>Download PDF
								</button>
							<button 
								class="btn btn-outline-success btn-sm"
								onclick={exportToCSV}
								disabled={studentsWithMarks.length === 0}
								title="Export marks to CSV for Excel"
							>
								<i class="bi bi-download me-1"></i>Export CSV
							</button>
        </div>
						</div>
						<div class="card-body p-0">
							<div class="table-responsive">
								<table class="table table-hover mb-0">
									<thead class="table-light">
										<tr>
											<th scope="col" class="sticky-top">
												<i class="bi bi-person me-2"></i>Student
											</th>
											{#each assessments as assessment}
												<th scope="col" class="text-center sticky-top" colspan="2">
													<div class="d-flex flex-column align-items-center">
														<i class="bi bi-clipboard-check me-1"></i>
														<span>{assessment.name}</span>
													</div>
												</th>
											{/each}
											<th scope="col" class="text-center sticky-top">
												<i class="bi bi-award me-1"></i>Final Grade
											</th>
										</tr>
										<tr>
											<th scope="col" class="sticky-top">
												<!-- Empty for student column -->
											</th>
											{#each assessments as assessment}
												<th scope="col" class="text-center sticky-top">
													<small class="text-muted">Marks</small>
												</th>
												<th scope="col" class="text-center sticky-top">
													{#if editingWeight[assessment.id]}
														<div class="d-flex align-items-center justify-content-center gap-1">
															<input
																type="number"
																class="form-control form-control-sm"
																style="width: 60px;"
																bind:value={tempWeightValue}
																onkeydown={(e) => handleWeightKeydown(e, assessment.id)}
																oninput={(e) => {
																	tempWeightValue = (e.target as HTMLInputElement).value;
																}}
																placeholder="0"
																min="0"
																max="100"
																step="0.1"
																aria-label="Weight percentage"
																data-assessment-id={assessment.id}
															>
          <button 
																class="btn btn-sm btn-success p-1"
																onclick={() => saveWeight(assessment.id)}
																title="Save"
																aria-label="Save weight"
																style="font-size: 0.7rem;"
															>
																<i class="bi bi-check"></i>
															</button>
															<button 
																class="btn btn-sm btn-secondary p-1"
																onclick={() => cancelEditingWeight(assessment.id)}
																title="Cancel"
																aria-label="Cancel editing"
																style="font-size: 0.7rem;"
															>
																<i class="bi bi-x"></i>
          </button>
        </div>
													{:else}
														<div class="d-flex align-items-center justify-content-center gap-1">
															<small class="text-muted">{assessment.weight || 0}%</small>
															<i 
																class="bi bi-pencil text-muted"
																onclick={() => startEditingWeight(assessment.id)}
																onkeydown={(e) => e.key === 'Enter' && startEditingWeight(assessment.id)}
																style="cursor: pointer; font-size: 0.8rem;"
																title="Edit weight percentage"
																role="button"
																tabindex="0"
															></i>
      </div>
													{/if}
												</th>
											{/each}
											<th scope="col" class="text-center sticky-top">
												<small class="text-muted">Grade</small>
											</th>
										</tr>
									</thead>
									<tbody>
										{#each studentsWithMarks as student, index}
											<tr class="drag-row" 
												style="cursor: move;">
												<td class="align-middle sticky-start bg-white" style="min-width: 200px;">
													<div class="d-flex align-items-center">
														<div class="me-3" style="width: 20px; font-weight: 600;">
															{index + 1}.
    </div>
														<div class="flex-grow-1">
															<div class="d-flex align-items-center justify-content-between">
																<div class="d-flex align-items-center">
																	<span>{student.name}</span>
  </div>
																<div class="d-flex gap-1">
																	<button 
																		class="btn btn-sm btn-outline-secondary p-1" 
																		style="width: 24px; height: 20px; font-size: 0.7rem;"
																		onclick={() => moveStudentUp(index)}
																		disabled={index === 0}
																		title="Move up"
																		aria-label="Move student up">
																		<i class="bi bi-chevron-up"></i>
																	</button>
																	<button 
																		class="btn btn-sm btn-outline-secondary p-1" 
																		style="width: 24px; height: 20px; font-size: 0.7rem;"
																		onclick={() => moveStudentDown(index)}
																		disabled={index === studentsWithMarks.length - 1}
																		title="Move down"
																		aria-label="Move student down">
																		<i class="bi bi-chevron-down"></i>
																	</button>
																	<button 
																		class="btn btn-sm btn-outline-danger p-1" 
																		style="width: 24px; height: 20px; font-size: 0.7rem;"
																		onclick={() => deleteStudentFromSubject(student.id)}
																		title="Remove student from this subject"
																		aria-label="Remove student from subject">
																		<i class="bi bi-trash"></i>
																	</button>
																</div>
															</div>
															<small class="text-muted">{student.studentId}</small>
														</div>
													</div>
												</td>
												{#each assessments as assessment}
													<!-- Marks Column -->
													<td class="align-middle text-center">
														{#if getStudentMarks(student.id, assessment.id)}
															{@const marks = getStudentMarks(student.id, assessment.id)}
															{#if marks.hasMarks}
																<span class="badge bg-success fs-6">
																	{marks.total}
																</span>
															{:else}
																<span class="text-muted small">No marks</span>
															{/if}
														{:else}
															<span class="text-muted small">No marks</span>
														{/if}
													</td>
													<!-- Weight Percentage Column (showing proportional bar and weighted value) -->
													<td class="align-middle text-center">
														<div class="d-flex flex-column align-items-center gap-2">
															<!-- Proportional Bar (representing calculated marks) -->
															<div class="w-100" style="max-width: 80px;">
																{#if getWeightedMarks(student.id, assessment.id)}
																	{@const weighted = getWeightedMarks(student.id, assessment.id)}
																	{@const marks = getStudentMarks(student.id, assessment.id)}
																	{@const maxRawMarks = getMaxPossibleRawMarks(assessment.id)}
																	{@const fallbackMaxMarks = 100}
																	{@const effectiveMaxMarks = maxRawMarks > 0 ? maxRawMarks : fallbackMaxMarks}
																	{@const barPercentage = (marks.total / effectiveMaxMarks) * 100}
																	
																	<div class="progress" style="height: 8px; background-color: #e9ecef;">
																		<div 
																			class="progress-bar" 
																			role="progressbar" 
																			style="width: {Math.max(barPercentage, 2)}%; min-width: 2px; background-color: {getDynamicColor(marks.total, effectiveMaxMarks)};"
																			aria-valuenow={marks.total} 
																			aria-valuemin="0" 
																			aria-valuemax={effectiveMaxMarks}
																		></div>
      </div>
																	<small class="text-muted">{weighted.displayValue}</small>
																{:else}
																	<div class="progress" style="height: 8px;">
																		<div class="progress-bar bg-secondary" style="width: 0%"></div>
																	</div>
																	<small class="text-muted">N/A</small>
																{/if}
															</div>
														</div>
													</td>
    {/each}
												<!-- Grades Column -->
												<td class="align-middle text-center">
													{#if getFinalGrade(student.id) !== "N/A"}
														{@const finalGrade = getFinalGrade(student.id)}
														{@const gradeColor = getGradeColor(finalGrade)}
														<span class="badge {gradeColor} fs-6">
															{finalGrade}
														</span>
													{:else}
														<span class="text-muted">N/A</span>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
  </div>

			<!-- Performance Highlights Cards for Each Assessment -->
			<div class="row mt-4">
				{#each assessments as assessment}
					{@const highlights = getAssessmentPerformanceHighlights(assessment.id)}
					{#if highlights.highestPerformers.length > 0 || highlights.mediumPerformers.length > 0 || highlights.needsSupport.length > 0}
						<div class="col-12 col-md-6 col-lg-4 mb-4">
							<div class="card h-100 shadow-sm">
								<!-- Card Header -->
								<div class="card-header bg-primary text-white">
									<div class="d-flex align-items-center">
										<i class="bi bi-trophy me-2" style="font-size: 1.2rem;"></i>
										<h6 class="mb-0 fw-bold">Performance Highlights</h6>
									</div>
									<small class="opacity-75">{assessment.name}</small>
								</div>
								
								<!-- Card Body -->
								<div class="card-body p-3">
									<!-- Highest Performers -->
									{#if highlights.highestPerformers.length > 0}
										<div class="mb-3">
											<div class="d-flex align-items-center mb-2">
												<div class="bg-success rounded-circle p-1 me-2">
													<i class="bi bi-trophy text-white" style="font-size: 0.8rem;"></i>
												</div>
												<span class="fw-bold text-success small">Highest Performer{highlights.highestPerformers.length > 1 ? 's' : ''}</span>
											</div>
											{#each highlights.highestPerformers as performer}
												<div class="d-flex justify-content-between align-items-center mb-1">
													<span class="small">{performer.student.name}</span>
													<span class="badge bg-success text-white fw-bold">
														{performer.grade} ({performer.percentage.toFixed(1)}%)
													</span>
												</div>
											{/each}
										</div>
									{/if}
									
									<!-- Medium Performers -->
									{#if highlights.mediumPerformers.length > 0}
										<div class="mb-3">
											<div class="d-flex align-items-center mb-2">
												<div class="bg-warning rounded-circle p-1 me-2">
													<i class="bi bi-award text-dark" style="font-size: 0.8rem;"></i>
												</div>
												<span class="fw-bold text-warning small">Medium Performer{highlights.mediumPerformers.length > 1 ? 's' : ''}</span>
											</div>
											{#each highlights.mediumPerformers as performer}
												<div class="d-flex justify-content-between align-items-center mb-1">
													<span class="small">{performer.student.name}</span>
													<span class="badge bg-warning text-dark fw-bold">
														{performer.grade} ({performer.percentage.toFixed(1)}%)
													</span>
												</div>
											{/each}
										</div>
									{/if}
									
									<!-- Needs Support -->
									{#if highlights.needsSupport.length > 0}
										<div class="mb-2">
											<div class="d-flex align-items-center mb-2">
												<div class="bg-danger rounded-circle p-1 me-2">
													<i class="bi bi-exclamation-triangle text-white" style="font-size: 0.8rem;"></i>
												</div>
												<span class="fw-bold text-danger small">Needs Support</span>
											</div>
											{#each highlights.needsSupport as performer}
												<div class="d-flex justify-content-between align-items-center mb-1">
													<span class="small">{performer.student.name}</span>
													<span class="badge bg-danger text-white fw-bold">
														{performer.grade} ({performer.percentage.toFixed(1)}%)
													</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
			
			<!-- Grade Distribution Table -->
			<div class="row mt-4">
				<div class="col-12">
					<div class="card shadow-sm">
						<div class="card-header bg-info text-white">
							<div class="d-flex align-items-center">
								<i class="bi bi-bar-chart me-2" style="font-size: 1.2rem;"></i>
								<h6 class="mb-0 fw-bold">Grade Distribution</h6>
							</div>
							<small class="opacity-75">Overall performance breakdown</small>
						</div>
						<div class="card-body p-0">
							<div class="table-responsive">
								<table class="table table-hover mb-0">
									<thead class="table-light">
										<tr>
											<th scope="col" class="fw-bold">
												<i class="bi bi-award me-2"></i>Grade
											</th>
											<th scope="col" class="text-center fw-bold">
												<i class="bi bi-people me-2"></i>Count
											</th>
											<th scope="col" class="text-center fw-bold">
												<i class="bi bi-percent me-2"></i>Percentage
											</th>
											<th scope="col" class="text-center fw-bold">
												<i class="bi bi-graph-up me-2"></i>Range
											</th>
										</tr>
									</thead>
									<tbody>
										{#each getGradeDistribution() as gradeData}
											<tr>
												<td class="align-middle">
													<span class="badge {gradeData.color} fs-6 fw-bold">
														{gradeData.grade}
													</span>
												</td>
												<td class="align-middle text-center">
													<span class="fw-bold">{gradeData.count}</span>
												</td>
												<td class="align-middle text-center">
													<span class="fw-bold">
														{studentsWithMarks.length > 0 ? ((gradeData.count / studentsWithMarks.length) * 100).toFixed(1) : '0.0'}%
													</span>
												</td>
												<td class="align-middle text-center">
													<small class="text-muted">
														{gradeData.label.split('(')[1]?.replace(')', '') || 'N/A'}
													</small>
												</td>
											</tr>
										{:else}
											<tr>
												<td colspan="4" class="text-center text-muted py-4">
													<i class="bi bi-info-circle me-2"></i>
													No grades available yet
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else if studentsWithMarks.length === 0 && students.length > 0}
			<div class="row mt-5">
				<div class="col-12">
					<div class="card border-0 shadow-sm">
						<div class="card-body text-center py-4">
							<i class="bi bi-clipboard-x text-muted mb-3" style="font-size: 3rem;"></i>
							<h5 class="text-muted mb-2">No Students with Marks</h5>
							<p class="text-muted mb-0">No students have marks recorded for assessments in this subject yet.</p>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="row">
			<div class="col-12">
    <div class="text-center py-5">
					<div class="card border-0 shadow-sm">
						<div class="card-body py-5">
							<i class="bi bi-clipboard-check text-muted mb-3" style="font-size: 4rem;"></i>
							<h4 class="text-muted mb-3">No assessments created yet</h4>
							<p class="text-muted mb-4 fs-6">Create your first assessment to start organizing feedback and categories.</p>
						</div>
					</div>
				</div>
			</div>
    </div>
  {/if}
</div>

<!-- Custom Delete Confirmation Dialog -->
{#if showDeleteConfirm && assessmentToDelete}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Confirm Deletion
					</h5>
          </div>
          <div class="modal-body">
					<div class="d-flex align-items-center mb-3">
						<i class="bi bi-clipboard-check text-danger me-3" style="font-size: 2rem;"></i>
						<div>
							<h6 class="mb-1">Assessment: <strong>{assessmentToDelete.name}</strong></h6>
							<p class="text-muted mb-0">{assessmentToDelete.categories?.length || 0} categories</p>
						</div>
					</div>
					<div class="alert alert-warning">
						<i class="bi bi-warning me-2"></i>
						<strong>Warning:</strong> This will permanently delete the assessment and all its data. This action cannot be undone.
					</div>
					<p class="mb-0">Are you sure you want to delete this assessment?</p>
          </div>
          <div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={cancelDelete}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-danger" onclick={confirmDelete}>
						<i class="bi bi-trash me-2"></i>Delete Assessment
					</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

<!-- Student Delete Confirmation Dialog -->
{#if showStudentDeleteConfirm && studentToDelete}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Remove Student from Subject
					</h5>
          </div>
          <div class="modal-body">
					<div class="d-flex align-items-center mb-3">
						<i class="bi bi-person-x text-danger me-3" style="font-size: 2rem;"></i>
						<div>
							<h6 class="mb-1">Student: <strong>{studentToDelete.name}</strong></h6>
							<p class="text-muted mb-0">ID: {studentToDelete.studentId}</p>
						</div>
					</div>
					<div class="alert alert-warning">
						<i class="bi bi-warning me-2"></i>
						<strong>Warning:</strong> This will remove the student from this subject and delete all their evaluation data (marks, selections, feedback) for all assessments in this subject. This action cannot be undone.
					</div>
					<div class="alert alert-info">
						<i class="bi bi-info-circle me-2"></i>
						<strong>Note:</strong> The student will remain in the global student list and can be added to other subjects.
					</div>
					<p class="mb-0">Are you sure you want to remove this student from this subject?</p>
          </div>
          <div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={cancelStudentDelete}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-danger" onclick={confirmStudentDelete}>
						<i class="bi bi-person-x me-2"></i>Remove Student
					</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

<!-- Success Notification Toast -->
  {#if showNotification}
	<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;">
		<div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
			<div class="toast-header bg-success text-white">
				<i class="bi bi-check-circle me-2"></i>
				<strong class="me-auto">Success</strong>
				<button type="button" class="btn-close btn-close-white" aria-label="Close notification" onclick={() => showNotification = false}></button>
      </div>
      <div class="toast-body">
        {notificationMessage}
      </div>
    </div>
</div>
{/if}

<!-- CSV Export Confirmation Modal -->
{#if showCSVExportModal}
<div class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header bg-success text-white">
        <h5 class="modal-title">
          <i class="bi bi-download me-2"></i>Export CSV Confirmation
        </h5>
        <button type="button" class="btn-close btn-close-white" aria-label="Close" onclick={cancelCSVExport}></button>
      </div>
      <div class="modal-body">
        <div class="row">
          <div class="col-12">
            <p class="mb-3">Are you sure you want to export marks to CSV?</p>
            
            <div class="alert alert-info mb-3">
              <div class="row">
                <div class="col-6">
                  <strong>Students:</strong> {studentsWithMarks.length}
                </div>
                <div class="col-6">
                  <strong>Assessments:</strong> {assessments.length}
                </div>
              </div>
              <div class="row mt-2">
                <div class="col-12">
                  <strong>Subject:</strong> {subjectName}
                </div>
              </div>
            </div>
            
            <p class="text-muted small mb-0">
              <i class="bi bi-info-circle me-1"></i>
              This will save a CSV file to your Downloads folder for analysis in Excel or other spreadsheet applications.
            </p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick={cancelCSVExport}>
          <i class="bi bi-x-circle me-1"></i>Cancel
        </button>
        <button type="button" class="btn btn-success" onclick={confirmCSVExport}>
          <i class="bi bi-download me-1"></i>Export CSV
        </button>
      </div>
    </div>
  </div>
</div>
{/if}
