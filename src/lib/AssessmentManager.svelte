<script lang="ts">
	import { invoke } from '@tauri-apps/api/core'
	import { getDynamicColor, getGradeColor } from './colorUtils.js'

	// Types
	type Assessment = {
		id: string;
		name: string;
		topics?: Topic[];
		categories?: Category[];
		weight?: number;
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
		onAddAssessment
	}: {
		assessments?: Assessment[];
		students?: any[];
		subjectName?: string;
		onSelectAssessment: (assessment: Assessment) => void;
		onUpdateAssessments: (assessments: Assessment[]) => void;
		showAddAssessment?: boolean;
		newAssessmentName?: string;
		onAddAssessment?: (name: string) => void;
	} = $props()

	// Sort assessments alphabetically by name
	let sortedAssessments = $derived(
		[...assessments].sort((a, b) => a.name.localeCompare(b.name))
	)

	// Local state
	let showDeleteConfirm = $state(false);
	let assessmentToDelete = $state(null);
	let localNewAssessmentName = $state('');
	let studentEvaluations = $state({}); // Store student evaluation data
	let studentsWithMarks = $state([]); // Students who have marks for this subject
	let editingWeight = $state({}); // Track which weight is being edited
	let tempWeightValue = $state(''); // Temporary value while editing
	
	// Student reordering state
	let isReordering = $state(false);

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

		for (const assessment of assessments) {
			const weighted = getWeightedMarks(studentId, assessment.id);
			if (weighted) {
				totalWeightedMarks += weighted.weightedMarks;
				hasAnyMarks = true;
			}
			
			// Sum up the total weight percentage
			if (assessment.weight) {
				totalWeight += assessment.weight;
			}
		}

		if (!hasAnyMarks || totalWeight === 0) {
			return "N/A";
		}

		// Calculate percentage: (actual weighted marks / total weight) * 100
		// This gives us the percentage out of the total possible weighted marks
		const finalPercentage = (totalWeightedMarks / totalWeight) * 100;
		
		// Debug logging
		console.log(`Final grade calculation for student ${studentId}:`, {
			totalWeightedMarks,
			totalWeight,
			finalPercentage: Math.round(finalPercentage * 100) / 100,
			grade: getGrade(finalPercentage)
		});
		
		return getGrade(finalPercentage);
	}

	// Export marks to CSV
	function exportToCSV() {
		if (studentsWithMarks.length === 0 || assessments.length === 0) return;

		// Create CSV headers
		const headers = ['Student Name', 'Student ID'];
		assessments.forEach(assessment => {
			headers.push(`${assessment.name} (Marks)`);
			headers.push(`${assessment.name} (Weight % & Weighted)`);
		});
		headers.push('Grade');

		// Create CSV rows
		const rows = [headers.join(',')];
		
		studentsWithMarks.forEach(student => {
			const row = [
				`"${student.name}"`,
				`"${student.studentId}"`
			];
			
			assessments.forEach(assessment => {
				const marks = getStudentMarks(student.id, assessment.id);
				if (marks && marks.hasMarks) {
					row.push(String(marks.total));
				} else {
					row.push('No marks');
				}
				
				// Add weight percentage and weighted marks combined
				const weightPercent = assessment.weight ? `${assessment.weight}%` : 'N/A';
				const weighted = getWeightedMarks(student.id, assessment.id);
				const weightedValue = weighted ? weighted.displayValue : 'N/A';
				row.push(`${weightPercent} (${weightedValue})`);
			});
			
			// Add final grade
			const finalGrade = getFinalGrade(student.id);
			row.push(finalGrade);
			
			rows.push(row.join(','));
		});

		// Create CSV content
		const csvContent = rows.join('\n');
		
		// Create and download file
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		
		// Generate filename with current date
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
		const safeSubjectName = subjectName.replace(/[^a-zA-Z0-9]/g, '-'); // Replace special chars with dashes
		link.setAttribute('download', `student-marks-${safeSubjectName}-${dateStr}.csv`);
		
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
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

	// Helper function to get grade distribution
	function getGradeDistribution() {
		const gradeCounts = {};
		
		studentsWithMarks.forEach(student => {
			const grade = getFinalGrade(student.id);
			gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
		});

		const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'N/A'];
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
			'E': 'E (0-39%)',
			'N/A': 'N/A (No marks)'
		};

		return gradeOrder
			.filter(grade => gradeCounts[grade] > 0)
			.map(grade => ({
				grade,
				label: gradeLabels[grade] || grade,
				count: gradeCounts[grade],
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
							<button 
								class="btn btn-outline-success btn-sm"
								onclick={exportToCSV}
								disabled={studentsWithMarks.length === 0}
								title="Export marks to CSV for Excel"
							>
								<i class="bi bi-download me-1"></i>Export CSV
							</button>
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
																<div class="d-flex flex-column gap-1">
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
					
					<!-- Summary Section -->
					<div class="card mt-4 border-0 shadow-sm">
						<div class="card-header bg-gradient text-white" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
							<h6 class="card-title mb-0 fw-bold">
								<i class="bi bi-graph-up me-2"></i>Performance Summary
							</h6>
						</div>
						<div class="card-body p-4">
							<div class="row g-4">
								<!-- Top, Medium, Lowest Performers -->
								<div class="col-lg-6">
									<div class="border rounded p-3 h-100" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
										<h6 class="text-primary mb-3 fw-semibold">
											<i class="bi bi-trophy me-2"></i>Performance Highlights
										</h6>
										{#if getPerformanceHighlights().topPerformer}
											<div class="d-flex align-items-center mb-3 p-2 rounded" style="background: rgba(25, 135, 84, 0.1);">
												<i class="bi bi-trophy-fill text-success me-2"></i>
												<div class="flex-grow-1">
													<strong class="text-success">Highest Performer</strong>
													<div class="text-dark">{getPerformanceHighlights().topPerformer.student.name}</div>
												</div>
												<span class="badge bg-success fs-6 px-3 py-2">
													{getPerformanceHighlights().topPerformer.finalGrade} ({getPerformanceHighlights().topPerformer.percentage.toFixed(1)}%)
												</span>
											</div>
										{/if}
										{#if getPerformanceHighlights().mediumPerformer}
											<div class="d-flex align-items-center mb-3 p-2 rounded" style="background: rgba(255, 193, 7, 0.1);">
												<i class="bi bi-award text-warning me-2"></i>
												<div class="flex-grow-1">
													<strong class="text-warning">Medium Performer</strong>
													<div class="text-dark">{getPerformanceHighlights().mediumPerformer.student.name}</div>
												</div>
												<span class="badge bg-warning text-dark fs-6 px-3 py-2">
													{getPerformanceHighlights().mediumPerformer.finalGrade} ({getPerformanceHighlights().mediumPerformer.percentage.toFixed(1)}%)
												</span>
											</div>
										{/if}
										{#if getPerformanceHighlights().lowestPerformer}
											<div class="d-flex align-items-center mb-3 p-2 rounded" style="background: rgba(220, 53, 69, 0.1);">
												<i class="bi bi-exclamation-triangle text-danger me-2"></i>
												<div class="flex-grow-1">
													<strong class="text-danger">Needs Support</strong>
													<div class="text-dark">{getPerformanceHighlights().lowestPerformer.student.name}</div>
												</div>
												<span class="badge bg-danger fs-6 px-3 py-2">
													{getPerformanceHighlights().lowestPerformer.finalGrade} ({getPerformanceHighlights().lowestPerformer.percentage.toFixed(1)}%)
												</span>
											</div>
										{/if}
									</div>
								</div>
								
								<!-- Grade Distribution -->
								<div class="col-lg-6">
									<div class="border rounded p-3 h-100" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
										<h6 class="text-primary mb-3 fw-semibold">
											<i class="bi bi-pie-chart me-2"></i>Grade Distribution
										</h6>
										<div class="row g-2">
											{#each getGradeDistribution() as gradeInfo}
												<div class="col-6">
													<div class="d-flex justify-content-between align-items-center p-2 rounded" 
														 style="background: white; border-left: 4px solid {gradeInfo.grade.startsWith('A') ? '#198754' : gradeInfo.grade.startsWith('B') ? '#0d6efd' : gradeInfo.grade.startsWith('C') ? '#ffc107' : gradeInfo.grade.startsWith('D') ? '#fd7e14' : '#6c757d'};">
														<span class="fw-medium text-dark">{gradeInfo.grade}:</span>
														<span class="badge fs-6 px-2 py-1 {gradeInfo.color}">
															{gradeInfo.count}
														</span>
													</div>
												</div>
											{/each}
										</div>
										<div class="mt-3 pt-3 border-top">
											<small class="text-muted">
												<i class="bi bi-info-circle me-1"></i>
												Total students with marks: <strong>{studentsWithMarks.length}</strong>
											</small>
										</div>
									</div>
								</div>
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
