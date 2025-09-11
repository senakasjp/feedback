<script>
	import { onMount, onDestroy } from 'svelte'
	
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
	
	// Floating sidebar state
	let sidebarElement = $state(null)
	let isFloating = $state(false)
	let originalTop = $state(0)
	let scrollHandler = null
	
	// Floating percentage calculator state
	let percentageElement = $state(null)
	let isPercentageFloating = $state(false)
	let isPercentageLocked = $state(false)
	let percentageOriginalTop = $state(0)
	let percentageScrollHandler = null
	
	// State for toggling between navigator and calculator
	let showCalculator = $state(false)
	
	// Reactive statement to check when percentage element becomes available
	$effect(() => {
		if (percentageElement && currentView === 'feedback') {
			// Reset floating state when element becomes available
			isPercentageFloating = false
		}
	})
	
	// Reactive effect to monitor lock state
	$effect(() => {
		if (isPercentageLocked) {
			// Force stop floating when locked
			isPercentageFloating = false
		}
	})

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
	
	// Toggle floating function
	function toggleFloating() {
		isPercentageFloating = !isPercentageFloating
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
	
	// Scroll handler for floating sidebar - disabled for now to prevent layout issues
	function handleScroll() {
		// Disabled floating behavior to prevent layout issues
		// if (!sidebarElement) return
		
		// const rect = sidebarElement.getBoundingClientRect()
		// const scrollTop = window.pageYOffset || document.documentElement.scrollTop
		
		// // Check if sidebar has reached the top of viewport
		// if (rect.top <= 20 && !isFloating) {
		// 	isFloating = true
		// 	originalTop = scrollTop
		// } else if (scrollTop <= originalTop - 50 && isFloating) {
		// 	isFloating = false
		// }
	}
	
	// Scroll handler for floating percentage calculator
	function handlePercentageScroll() {
		// Only run if we're on feedback page and element exists
		if (currentView !== 'feedback' || !percentageElement) {
			return
		}
		
		// If locked, completely ignore scroll events
		if (isPercentageLocked) {
			return
		}
		
		const rect = percentageElement.getBoundingClientRect()
		
		// Check if percentage calculator has reached the top of viewport
		if (rect.top <= 20 && !isPercentageFloating) {
			isPercentageFloating = true
		} else if (rect.top > 20 && isPercentageFloating) {
			isPercentageFloating = false
		}
	}
	
	// Toggle lock function
	function togglePercentageLock() {
		isPercentageLocked = !isPercentageLocked
		// If locking, stop floating immediately
		if (isPercentageLocked) {
			isPercentageFloating = false
		}
	}
	
	
	// Toggle between navigator and calculator
	function toggleView() {
		showCalculator = !showCalculator
	}
	
	// Lifecycle functions
	onMount(() => {
		scrollHandler = handleScroll
		percentageScrollHandler = handlePercentageScroll
		window.addEventListener('scroll', scrollHandler)
		window.addEventListener('scroll', percentageScrollHandler)
		window.addEventListener('resize', scrollHandler)
		window.addEventListener('resize', percentageScrollHandler)
	})
	
	// Reactive effect to manage scroll listeners based on lock state
	$effect(() => {
		// Always keep the scroll listener active, just check lock state inside
	})
	
	onDestroy(() => {
		if (scrollHandler) {
			window.removeEventListener('scroll', scrollHandler)
			window.removeEventListener('resize', scrollHandler)
		}
		if (percentageScrollHandler) {
			window.removeEventListener('scroll', percentageScrollHandler)
			window.removeEventListener('resize', percentageScrollHandler)
		}
	})
</script>

<div 
	class="card position-sticky d-lg-block" 
	style="top: 20px; margin: 0; width: 100%; box-sizing: border-box;"
	bind:this={sidebarElement}
>
	<div class="card-header bg-primary text-white">
		<div class="d-flex justify-content-between align-items-center">
			<h5 class="card-title mb-0">
				<i class="bi bi-{showCalculator ? 'calculator' : 'list'} me-2"></i>
				{showCalculator ? 'Calculator' : 'Navigation'}
			</h5>
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
	
	<div class="card-body">
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
						<div class="card bg-light">
							<div class="card-body p-3">
								<h6 class="card-title text-primary mb-3">
									<i class="bi bi-info-circle me-2"></i>Current Session
								</h6>
								<div class="small">
									{#if currentSubject}
										<div class="mb-2">
											<strong>Subject:</strong> {currentSubject.name}
										</div>
									{/if}
									{#if currentAssessment}
										<div class="mb-2">
											<strong>Assessment:</strong> {currentAssessment.name}
										</div>
									{/if}
									{#if currentStudentId && studentName}
										<div class="mb-2">
											<strong>Student:</strong> {studentName}
										</div>
									{:else if currentStudentId}
										<div class="mb-2 text-muted">
											<strong>Student:</strong> Loading...
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
							{/if}
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
		{/if}
	</div>
</div>

{#if showCalculator}
<!-- Percentage Range Card - Only show on feedback page -->
{#if currentView === 'feedback'}
<div 
	class="card mt-3" 
	class:floating-percentage={isPercentageFloating}
	class:locked={isPercentageLocked}
	style="margin: 0; width: 100%; box-sizing: border-box;"
	bind:this={percentageElement}
>
	<div class="card-header bg-info text-white">
		<div class="d-flex justify-content-between align-items-center">
			<h5 class="card-title mb-0">
				<i class="bi bi-percent me-2"></i>Percentage Ranges
			</h5>
			<button 
				class="btn btn-sm btn-outline-light" 
				onclick={togglePercentageLock}
				title={isPercentageLocked ? 'Unlock floating' : 'Lock floating'}
			>
				{isPercentageLocked ? '🔒' : '🔓'}
			</button>
		</div>
	</div>
	
	<div class="card-body py-2">
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


<!-- Floating Percentage Calculator Overlay -->
{#if currentView === 'feedback' && isPercentageFloating && !isPercentageLocked}
<div class="position-fixed top-0 start-0 p-3" style="z-index: 1051; width: 300px; max-height: calc(100vh - 40px); overflow-y: auto;">
	<div class="card shadow-lg border-info">
		<div class="card-header bg-info text-white">
			<div class="d-flex justify-content-between align-items-center">
				<h5 class="card-title mb-0">
					<i class="bi bi-percent me-2"></i>Percentage Ranges
				</h5>
				<button 
					class="btn btn-sm btn-outline-light" 
					onclick={togglePercentageLock}
					title={isPercentageLocked ? 'Unlock floating' : 'Lock floating'}
				>
					{isPercentageLocked ? '🔒' : '🔓'}
				</button>
			</div>
		</div>
		
		<div class="card-body py-2">
			<!-- Add new range form -->
			<div class="mb-2">
				<!-- First row: Value and Percentage inputs -->
				<div class="d-flex align-items-end gap-1 mb-2 justify-content-center">
					<div class="flex-shrink-0" style="width: 60px;">
						<label for="newValueFloat" class="form-label small fw-bold mb-1">Value:</label>
						<input 
							type="text" 
							id="newValueFloat"
							class="form-control form-control-sm" 
							placeholder="Value"
							bind:value={newValue}
							inputmode="decimal"
						>
					</div>
					<div class="flex-shrink-0" style="width: 60px;">
						<label for="newLowerPercentageFloat" class="form-label small fw-bold mb-1">Lower %:</label>
						<input 
							type="text" 
							id="newLowerPercentageFloat"
							class="form-control form-control-sm" 
							placeholder="0"
							bind:value={newLowerPercentage}
							inputmode="decimal"
						>
					</div>
					<div class="flex-shrink-0" style="width: 60px;">
						<label for="newUpperPercentageFloat" class="form-label small fw-bold mb-1">Upper %:</label>
						<input 
							type="text" 
							id="newUpperPercentageFloat"
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
						<label for="newColorFloat" class="form-label small fw-bold mb-1">Color:</label>
						<select id="newColorFloat" class="form-select form-select-sm" bind:value={newColor}>
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
</div>
{/if}
{/if}
{/if}

<style>
	
	
	
	
	
	
	/* Hide original percentage calculator when floating */
	.floating-percentage {
		opacity: 0.3 !important;
		pointer-events: none !important;
		background-color: rgba(255, 255, 255, 0.5) !important;
	}
	
	/* Locked state styling */
	.locked {
		border: 2px solid #dc3545 !important;
		background-color: #fff5f5 !important;
	}
	
	.locked .card-header {
		background-color: #dc3545 !important;
	}
	
	/* Ensure floating percentage calculator doesn't interfere with mobile layout */
	@media (max-width: 991.98px) {
		.floating-percentage {
			opacity: 1 !important;
			pointer-events: auto !important;
		}
		
		.position-fixed {
			display: none !important;
		}
	}
</style>
