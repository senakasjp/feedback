<script>
	import { onMount } from 'svelte';
	
	// Props
	/** @type {any[]} */
	export let subjects = [];
	/** @type {any} */
	export let currentSubject = null;
	/** @type {any} */
	export let currentAssessment = null;
	export let currentView = '';
	export let currentStudentId = '';
	export let studentName = '';
	export let showCalculator = false;
	export let showMobileSidebar = true;
	/** @type {any[]} */
	export let percentageRanges = [];
	/** @type {any} */
	export let categoryMarks = {}; // Used in template for total marks display
	
	// Calculate total marks locally - make it reactive
	let totalMarks = 0
	$: {
		totalMarks = Object.values(categoryMarks).reduce((total, value) => {
			const numMarks = parseFloat(value) || 0
			return total + numMarks
		}, 0)
	}
	
	// Event handlers
	export let onSelectSubject = (subject) => {};
	export let onSelectAssessment = (assessment) => {};
	export let onGoBackToSubjects = () => {};
	export let onGoBackToAssessments = () => {};
	export let onToggleShowAddSubject = () => {};
	export let onToggleShowAddAssessment = () => {};
	export let onToggleMobileSidebar = () => {};
	export let onToggleView = () => {};
	export let onSaveStudentEvaluation = () => {};
	export let onLoadStudentEvaluation = () => {};
	export let onTransferStudentData = () => {};
	export let onSaveAssignmentData = () => {};
	export let onCopyToClipboard = () => {};
	export let onGeneratePDF = () => {};
	export let onAddPercentageRange = (value, color, lowerPercentage, upperPercentage) => {};
	export let onDeletePercentageRange = (id) => {};
	export let onExportAssignmentSettings = () => {};
	
	// Percentage range form state
	let newValue = '';
	let newLowerPercentage = '';
	let newUpperPercentage = '';
	let newColor = 'green';
	
	const colorOptions = [
		{ value: 'green', label: 'Green' },
		{ value: 'lightgreen', label: 'Light Green' },
		{ value: 'yellow', label: 'Yellow' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'red', label: 'Red' }
	];
	
	function getColorStyle(color) {
		const colors = {
			green: 'background-color: #198754; color: white;',
			lightgreen: 'background-color: #20c997; color: white;',
			yellow: 'background-color: #ffc107; color: black;',
			orange: 'background-color: #fd7e14; color: white;',
			red: 'background-color: #dc3545; color: white;'
		};
		return colors[color] || colors.green;
	}
	
	function addPercentageRange() {
		if (newValue && newLowerPercentage && newUpperPercentage) {
			onAddPercentageRange(
				parseFloat(newValue),
				newColor,
				parseFloat(newLowerPercentage),
				parseFloat(newUpperPercentage)
			);
			
			// Reset form
			newValue = '';
			newLowerPercentage = '';
			newUpperPercentage = '';
			newColor = 'blue';
		}
	}
	
	function deletePercentageRange(id) {
		onDeletePercentageRange(id);
	}
	
	function toggleView() {
		onToggleView();
	}
</script>

<div class="card border-0 shadow-sm h-100 d-flex flex-column" style="position: sticky; top: 0; z-index: 1020; max-height: 100vh;">
	<!-- Header -->
	<div class="card-header bg-primary text-white py-3">
		<div class="d-flex justify-content-between align-items-center">
			<div class="d-flex align-items-center">
				<i class="bi bi-{showCalculator ? 'calculator' : 'list'} me-2"></i>
				<h6 class="mb-0">{showCalculator ? 'Calculator' : 'Navigation'}</h6>
			</div>
			<button 
				class="btn btn-outline-light btn-sm" 
				onclick={toggleView}
				title={showCalculator ? 'Show Navigator' : 'Show Calculator'}
				aria-label={showCalculator ? 'Show Navigator' : 'Show Calculator'}
			>
				<i class="bi bi-{showCalculator ? 'list' : 'calculator'}"></i>
			</button>
		</div>
	</div>
	
	<div class="card-body flex-grow-1" style="overflow-y: auto; padding-top: 1rem;">
		{#if !showCalculator}
			<!-- Mobile toggle button -->
			<div class="d-lg-none mb-3">
				<button class="btn btn-outline-primary w-100" onclick={() => onToggleMobileSidebar()}>
					<i class="bi bi-chevron-down me-2"></i>
					{showMobileSidebar ? 'Hide Navigation' : 'Show Navigation'}
				</button>
			</div>
			
			<div class="{showMobileSidebar ? 'd-block' : 'd-none'} d-lg-block">
				{#if !currentSubject}
					<!-- Subject List -->
					<div class="mb-3">
						<!-- Header -->
						<div class="d-flex justify-content-between align-items-center mb-3">
							<h6 class="mb-0 text-primary">
								<i class="bi bi-book me-2"></i>Subjects
							</h6>
							<button 
								class="btn btn-primary btn-sm" 
								onclick={() => onToggleShowAddSubject()}
							>
								<i class="bi bi-plus-circle me-1"></i>Add
							</button>
						</div>
						
						{#each subjects as subject}
							<button 
								class="btn btn-outline-primary w-100 mb-2 text-start" 
								onclick={() => onSelectSubject(subject)}
							>
								<div class="d-flex justify-content-between align-items-center">
									<div>
										<i class="bi bi-book me-2"></i>
										{subject.name}
									</div>
									<span class="badge bg-primary ms-2">{subject.assessments.length}</span>
								</div>
							</button>
						{/each}
						
						{#if subjects.length === 0}
							<div class="text-start py-3">
								<i class="bi bi-book text-muted me-2" style="font-size: 1.5rem;"></i>
								<span class="text-muted small">No subjects yet. Add your first subject above.</span>
							</div>
						{/if}
					</div>
				{:else if !currentAssessment}
					<!-- Assessment List -->
					<div class="mb-3">
						<!-- Navigation -->
						<button class="btn btn-secondary btn-sm mb-3 w-100" onclick={onGoBackToSubjects}>
							<i class="bi bi-arrow-left me-2"></i>Back to Subjects
						</button>
						
						<!-- Header -->
						<div class="d-flex justify-content-between align-items-center mb-3">
							<h6 class="mb-0 text-success">
								<i class="bi bi-clipboard-check me-2"></i>Assessments
							</h6>
							<button 
								class="btn btn-success btn-sm" 
								onclick={() => onToggleShowAddAssessment()}
							>
								<i class="bi bi-plus-circle me-1"></i>Add
							</button>
						</div>
						
						<!-- Context Info -->
						<div class="mb-3">
							<small class="text-muted">
								<i class="bi bi-book me-1"></i>Subject: {currentSubject?.name}
							</small>
						</div>
						
						{#each currentSubject?.assessments || [] as assessment}
							<button 
								class="btn btn-outline-success w-100 mb-2 text-start" 
								onclick={() => onSelectAssessment(assessment)}
							>
								<div class="d-flex align-items-center">
									<i class="bi bi-clipboard-check me-2"></i>
									{assessment.name}
								</div>
							</button>
						{/each}
						
						{#if (currentSubject?.assessments?.length || 0) === 0}
							<div class="text-start py-3">
								<i class="bi bi-clipboard-check text-muted me-2" style="font-size: 1.5rem;"></i>
								<span class="text-muted small">No assessments yet. Add your first assessment above.</span>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Feedback Mode Navigation -->
					<div class="mb-3">
						<!-- Navigation -->
						<button class="btn btn-secondary btn-sm mb-2 w-100" onclick={onGoBackToAssessments}>
							<i class="bi bi-arrow-left me-2"></i>Back to Assessments
						</button>
						<button class="btn btn-outline-secondary btn-sm w-100" onclick={onGoBackToSubjects}>
							<i class="bi bi-arrow-left me-2"></i>Back to Subjects
						</button>
						
						<!-- Current Session Info - Only show in feedback page (3rd level) -->
						{#if currentView === 'feedback' && currentAssessment}
							<div class="mt-4 mb-4">
								<div class="card bg-light">
									<div class="card-body p-3">
										<h6 class="card-title text-primary mb-3">
											<i class="bi bi-info-circle me-2"></i>Current Session
										</h6>
										<div class="small">
											{#if currentSubject}
												<div class="mb-2">
													Subject: {currentSubject.name}
												</div>
											{/if}
											{#if currentAssessment}
												<div class="mb-2">
													Assessment: {currentAssessment.name}
												</div>
											{/if}
											{#if currentStudentId && studentName}
												<div class="mb-2">
													Student: {studentName}
												</div>
											{:else if currentStudentId}
												<div class="mb-2 text-muted">
													Student: Loading...
												</div>
											{/if}
											{#if totalMarks > 0}
												<div class="mb-0">
													<strong class="text-danger">Total Marks: {totalMarks}</strong>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/if}

						<!-- Action Buttons - Only show in feedback page (3rd level) -->
						{#if currentView === 'feedback' && currentAssessment}
							<div class="mt-3">
								<div class="d-grid gap-3">
									{#if currentStudentId}
										<button class="btn btn-success btn-sm w-100 mb-2" onclick={onSaveStudentEvaluation}>
											<i class="bi bi-save me-2"></i>Save Student Data
										</button>
										<button class="btn btn-primary btn-sm w-100 mb-2" onclick={onLoadStudentEvaluation}>
											<i class="bi bi-upload me-2"></i>Load Student Data
										</button>
										<button class="btn btn-warning btn-sm w-100 mb-2" onclick={onTransferStudentData}>
											<i class="bi bi-arrow-left-right me-2"></i>Transfer to Another Student
										</button>
									{/if}
									<button class="btn btn-outline-primary btn-sm w-100 mb-2" onclick={onSaveAssignmentData}>
										<i class="bi bi-save me-2"></i>Save Assignment
									</button>
									<button class="btn btn-outline-info btn-sm w-100 mb-2" onclick={onExportAssignmentSettings}>
										<i class="bi bi-upload me-2"></i>Export Assignment Settings
									</button>
									<button class="btn btn-outline-success btn-sm w-100 mb-2" onclick={onCopyToClipboard}>
										<i class="bi bi-clipboard me-2"></i>Copy to Clipboard
									</button>
									<button class="btn btn-outline-danger btn-sm w-100 mb-2" onclick={onGeneratePDF}>
										<i class="bi bi-download me-2"></i>Print to Download
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<!-- Calculator View -->
			{#if currentView === 'feedback' && currentAssessment}
				<div class="mb-3">
					<h6 class="text-info mb-3">
						<i class="bi bi-percent me-2"></i>Percentage Ranges
					</h6>
					<div>
						<!-- Add new range form -->
						<div class="mb-2">
							<!-- First row: Value and Percentage inputs -->
							<div class="d-flex align-items-end gap-1 mb-2 justify-content-center">
								<div class="flex-shrink-0" style="width: 60px;">
									<label for="newValue" class="form-label small fw-bold mb-1">Value:</label>
									<input 
										type="text" 
										id="newValue"
										class="form-control form-control-sm" 
										placeholder="Value"
										bind:value={newValue}
										inputmode="decimal"
									>
								</div>
								<div class="flex-shrink-0" style="width: 60px;">
									<label for="newLowerPercentage" class="form-label small fw-bold mb-1">Lower %:</label>
									<input 
										type="text" 
										id="newLowerPercentage"
										class="form-control form-control-sm" 
										placeholder="0"
										bind:value={newLowerPercentage}
										inputmode="decimal"
									>
								</div>
								<div class="flex-shrink-0" style="width: 60px;">
									<label for="newUpperPercentage" class="form-label small fw-bold mb-1">Upper %:</label>
									<input 
										type="text" 
										id="newUpperPercentage"
										class="form-control form-control-sm" 
										placeholder="100"
										bind:value={newUpperPercentage}
										inputmode="decimal"
									>
								</div>
							</div>
							<!-- Second row: Color dropdown and Add button -->
							<div class="d-flex align-items-end gap-2 mb-2 justify-content-center">
								<div class="flex-shrink-0" style="width: 80px;">
									<label for="newColor" class="form-label small fw-bold mb-1">Color:</label>
									<select id="newColor" class="form-select form-select-sm" bind:value={newColor}>
										{#each colorOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
								<button 
									class="btn btn-primary btn-sm" 
									onclick={addPercentageRange}
									disabled={newValue === '' || newLowerPercentage === '' || newUpperPercentage === ''}
								>
									<i class="bi bi-plus-circle me-1"></i>Add Range
								</button>
							</div>
						</div>

						<!-- Display existing ranges -->
						{#if percentageRanges.length > 0}
							<div class="mt-2">
								<h6 class="small fw-bold text-muted mb-1">Calculated Ranges:</h6>
								<div class="list-group list-group-flush">
									{#each percentageRanges as range}
										<div class="list-group-item px-0 py-1 border-0">
											<div class="d-flex align-items-center justify-content-between">
												<div class="d-flex align-items-center">
													<div class="badge me-2 d-flex align-items-center justify-content-center" style="width: 20px; height: 20px; border-radius: 4px; font-size: 0.7rem; {getColorStyle(range.color)}">
														{range.color.charAt(0).toUpperCase()}
													</div>
													<div class="d-flex align-items-center gap-2">
														<span class="small fw-bold">{range.value}</span>
														<span class="small text-muted">
															{range.calculatedLower} - {range.calculatedUpper}
														</span>
													</div>
												</div>
												<i 
													class="bi bi-trash text-danger" 
													onclick={() => deletePercentageRange(range.id)}
													onkeydown={(e) => e.key === 'Enter' && deletePercentageRange(range.id)}
													title="Delete range"
													aria-label="Delete percentage range"
													style="cursor: pointer; font-size: 0.8rem;"
													role="button"
													tabindex="0"
												></i>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<div class="text-center py-3">
								<i class="bi bi-percent text-muted me-2" style="font-size: 1.2rem;"></i>
								<span class="text-muted small">No percentage ranges yet. Add your first range above.</span>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-center py-4">
					<i class="bi bi-calculator text-muted mb-3" style="font-size: 3rem;"></i>
					<h6 class="text-muted mb-2">Calculator</h6>
					<p class="text-muted small mb-0">Percentage ranges calculator is available when you're in feedback mode.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>


<style>
	
	
	
	
	
	
</style>