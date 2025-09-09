<script>
	// Props
	let { 
		subjects = [],
		currentSubject = null,
		currentAssessment = null,
		currentView = 'subjects',
		showAddSubject = false,
		showAddAssessment = false,
		newSubjectName = '',
		newAssessmentName = '',
		showMobileSidebar = false,
		percentageRanges = [],
		onSelectSubject,
		onSelectAssessment,
		onAddSubject,
		onAddAssessment,
		onGoBackToSubjects,
		onGoBackToAssessments,
		onToggleMobileSidebar,
		onToggleShowAddSubject,
		onToggleShowAddAssessment,
		onCopyToClipboard,
		onGeneratePDF,
		onSaveStudentEvaluation,
		onLoadStudentEvaluation,
		onAddPercentageRange,
		onDeletePercentageRange,
		currentStudentId,
		studentName = ''
	} = $props()

	// Percentage range form state
	let newValue = $state('')
	let newColor = $state('red')
	let newLowerPercentage = $state('')
	let newUpperPercentage = $state('')

	const colorOptions = [
		{ value: 'red', label: 'Red', class: 'bg-danger' },
		{ value: 'orange', label: 'Orange', class: 'bg-warning' },
		{ value: 'yellow', label: 'Yellow', class: 'bg-warning' },
		{ value: 'light-green', label: 'Light Green', class: 'bg-success' },
		{ value: 'green', label: 'Green', class: 'bg-success' }
	]

	function addPercentageRange() {
		if (newValue !== '' && newLowerPercentage !== '' && newUpperPercentage !== '') {
			const value = parseFloat(newValue)
			const lowerPct = parseFloat(newLowerPercentage)
			const upperPct = parseFloat(newUpperPercentage)
			
			if (!isNaN(value) && !isNaN(lowerPct) && !isNaN(upperPct) && lowerPct >= 0 && upperPct <= 100 && lowerPct <= upperPct) {
				onAddPercentageRange(value, newColor, lowerPct, upperPct)
				
				// Reset form
				newValue = ''
				newLowerPercentage = ''
				newUpperPercentage = ''
			}
		}
	}

	function deletePercentageRange(id) {
		onDeletePercentageRange(id)
	}

	function getColorClass(color) {
		const colorMap = {
			'red': 'bg-danger',
			'orange': 'bg-warning',
			'yellow': 'bg-warning',
			'light-green': 'bg-success',
			'green': 'bg-success'
		}
		return colorMap[color] || 'bg-secondary'
	}

	function getColorStyle(color) {
		const colorMap = {
			'red': 'background-color: #dc3545 !important;',
			'orange': 'background-color: #fd7e14 !important;',
			'yellow': 'background-color: #ffc107 !important; color: #000 !important;',
			'light-green': 'background-color: #20c997 !important;',
			'green': 'background-color: #198754 !important;'
		}
		return colorMap[color] || 'background-color: #6c757d !important;'
	}
</script>

<div class="card position-sticky d-lg-block" style="top: 20px; margin: 0; width: 100%; box-sizing: border-box;">
	<div class="card-header bg-primary text-white">
		<h5 class="card-title mb-0">
			<i class="bi bi-list me-2"></i>Navigation
		</h5>
	</div>
	
	<div class="card-body">
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
								<strong>{subject.name}</strong>
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
						<i class="bi bi-book me-1"></i>Subject: <strong>{currentSubject?.name}</strong>
					</small>
				</div>
				
				
				{#each currentSubject?.assessments || [] as assessment}
					<button 
						class="btn btn-outline-success w-100 mb-2 text-start" 
						onclick={() => onSelectAssessment(assessment)}
					>
						<div class="d-flex align-items-center">
							<i class="bi bi-clipboard-check me-2"></i>
							<strong>{assessment.name}</strong>
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
						<div class="session-info">
							<h6 class="session-title mb-3">
								<i class="bi bi-info-circle me-2"></i>Current Session
							</h6>
							<div class="session-details">
								{#if currentSubject}
									<div class="session-item">
										<strong>Subject:</strong> {currentSubject.name}
									</div>
								{/if}
								{#if currentAssessment}
									<div class="session-item">
										<strong>Assessment:</strong> {currentAssessment.name}
									</div>
								{/if}
								{#if currentStudentId && studentName}
									<div class="session-item">
										<strong>Student:</strong> {studentName}
									</div>
								{:else if currentStudentId}
									<div class="session-item text-muted">
										<strong>Student:</strong> Loading...
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Action Buttons - Only show in feedback page (3rd level) -->
				{#if currentView === 'feedback' && currentAssessment}
					<div class="mt-3">
						<div class="d-grid gap-3">
							{#if currentStudentId}
								<button class="action-btn save-btn" onclick={onSaveStudentEvaluation}>
									<i class="bi bi-save me-2"></i>Save Student Data
								</button>
								<button class="action-btn load-btn" onclick={onLoadStudentEvaluation}>
									<i class="bi bi-upload me-2"></i>Load Student Data
								</button>
							{/if}
							<button class="action-btn copy-btn" onclick={onCopyToClipboard}>
								<i class="bi bi-clipboard me-2"></i>Copy to Clipboard
							</button>
							<button class="action-btn download-btn" onclick={onGeneratePDF}>
								<i class="bi bi-download me-2"></i>Print to Download
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
		</div>
	</div>
</div>

<!-- Percentage Range Card - Universal across all views -->
<div class="card mt-3" style="margin: 0; width: 100%; box-sizing: border-box;">
	<div class="card-header bg-info text-white">
		<h5 class="card-title mb-0">
			<i class="bi bi-percent me-2"></i>Percentage Ranges
		</h5>
	</div>
	
	<div class="card-body py-2">
		<!-- Add new range form -->
		<div class="mb-2">
			<!-- First row: Value and Percentage inputs -->
			<div class="d-flex align-items-end gap-1 mb-2 justify-content-center">
				<div class="flex-shrink-0" style="width: 60px;">
					<label for="newValue" class="form-label small fw-bold mb-1 compact-label">Value:</label>
					<input 
						type="text" 
						id="newValue"
						class="form-control form-control-sm compact-input" 
						placeholder="Value"
						bind:value={newValue}
						inputmode="decimal"
					>
				</div>
				<div class="flex-shrink-0" style="width: 60px;">
					<label for="newLowerPercentage" class="form-label small fw-bold mb-1 compact-label">Lower %:</label>
					<input 
						type="text" 
						id="newLowerPercentage"
						class="form-control form-control-sm compact-input" 
						placeholder="0"
						bind:value={newLowerPercentage}
						inputmode="decimal"
					>
				</div>
				<div class="flex-shrink-0" style="width: 60px;">
					<label for="newUpperPercentage" class="form-label small fw-bold mb-1 compact-label">Upper %:</label>
					<input 
						type="text" 
						id="newUpperPercentage"
						class="form-control form-control-sm compact-input" 
						placeholder="100"
						bind:value={newUpperPercentage}
						inputmode="decimal"
					>
				</div>
			</div>
			<!-- Second row: Color dropdown and Add button -->
			<div class="d-flex align-items-end gap-2 mb-2 justify-content-center">
				<div class="flex-shrink-0" style="width: 80px;">
					<label for="newColor" class="form-label small fw-bold mb-1 compact-label">Color:</label>
					<select id="newColor" class="form-select form-select-sm compact-input" bind:value={newColor}>
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

<style>
.compact-label { font-size: 0.5rem; }
.compact-input { padding-top: 0.05rem; padding-bottom: 0.05rem; height: 24px; font-size: 0.65rem; }
.compact-input.form-select { padding-top: 0.05rem; padding-bottom: 0.05rem; height: 24px; font-size: 0.8rem; }
	.action-btn {
		border: none;
		border-radius: 12px;
		padding: 12px 16px;
		font-weight: 600;
		font-size: 14px;
		color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
		text-align: left;
		display: flex;
		align-items: center;
		width: 100%;
	}
	
	.action-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
	}
	
	.action-btn:active {
		transform: translateY(0);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	}
	
	.copy-btn {
		background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
	}
	
	.copy-btn:hover {
		background: linear-gradient(135deg, #218838 0%, #1ea085 100%);
		box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
	}
	
	.download-btn {
		background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%);
	}
	
	.download-btn:hover {
		background: linear-gradient(135deg, #c82333 0%, #d63384 100%);
		box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
	}
	
	.save-btn {
		background: linear-gradient(135deg, #198754 0%, #146c43 100%);
	}
	
	.save-btn:hover {
		background: linear-gradient(135deg, #146c43 0%, #0f5132 100%);
		box-shadow: 0 6px 20px rgba(25, 135, 84, 0.4);
	}
	
	.load-btn {
		background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
	}
	
	.load-btn:hover {
		background: linear-gradient(135deg, #0b5ed7 0%, #0a58ca 100%);
		box-shadow: 0 6px 20px rgba(13, 110, 253, 0.4);
	}
	
	.action-btn i {
		font-size: 16px;
	}
	
	/* Sidebar button styles */
	.btn-outline-primary,
	.btn-outline-success {
		background-color: transparent !important;
		border: 1px solid currentColor !important;
		text-align: left !important;
		color: #333 !important;
		justify-content: flex-start !important;
	}
	
	.btn-outline-primary:hover,
	.btn-outline-success:hover {
		background-color: rgba(0, 0, 0, 0.05) !important;
		color: #333 !important;
	}
	
	.btn-outline-primary strong,
	.btn-outline-success strong {
		color: #333 !important;
		text-align: left !important;
	}
	
	.btn-outline-primary .d-flex,
	.btn-outline-success .d-flex {
		justify-content: flex-start !important;
		text-align: left !important;
	}
	
	/* Spacing between buttons in groups */
	.btn-group .btn + .btn {
		margin-left: 0.25rem !important;
	}
	
	/* Session Info Styles */
	.session-info {
		padding: 0;
	}
	
	.session-title {
		color: #495057;
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}
	
	.session-details {
		font-size: 0.9rem;
		line-height: 1.5;
	}
	
	.session-item {
		margin-bottom: 0.4rem;
		color: #6c757d;
	}
	
	.session-item:last-child {
		margin-bottom: 0;
	}
	
	.session-item strong {
		color: #495057;
		font-weight: 600;
	}
</style>
