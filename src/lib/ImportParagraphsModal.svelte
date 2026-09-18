<!-- Import Paragraphs Modal Component -->
<!-- This component allows users to import paragraphs from other assignments -->

<script>
	import { createEventDispatcher } from 'svelte'
	import { assessmentDataService } from '../services/dataService.js'
	import { generateId } from '../utils/helpers.js'

	const dispatch = createEventDispatcher()

	// Props
	export let show = false
	export let subjects = []
	export let currentSubjectId = ''
	export let currentAssessmentId = ''

	// State
	let availableAssignments = []
	let selectedAssignment = ''
	let assignmentParagraphs = []
	let selectedParagraphs = new Set()
	let loading = false
	let error = ''

	// Computed values
	$: filteredAssignments = availableAssignments.filter(assignment => 
		assignment.subjectId !== currentSubjectId || assignment.assessmentId !== currentAssessmentId
	)

	// Load available assignments when modal opens
	$: if (show) {
		loadAvailableAssignments()
	}

	/**
	 * Load all available assignments from subjects
	 */
	async function loadAvailableAssignments() {
		loading = true
		error = ''
		availableAssignments = []

		try {
			for (const subject of subjects) {
				for (const assessment of subject.assessments || []) {
					availableAssignments.push({
						subjectId: subject.id,
						subjectName: subject.name,
						assessmentId: assessment.id,
						assessmentName: assessment.name,
						displayName: `${subject.name} - ${assessment.name}`
					})
				}
			}
		} catch (err) {
			error = 'Failed to load available assignments'
			console.error('Error loading assignments:', err)
		} finally {
			loading = false
		}
	}

	/**
	 * Load paragraphs from selected assignment
	 */
	async function loadAssignmentParagraphs() {
		if (!selectedAssignment) return

		loading = true
		error = ''
		assignmentParagraphs = []
		selectedParagraphs = new Set()

		try {
			const assignment = availableAssignments.find(a => 
				`${a.subjectId}-${a.assessmentId}` === selectedAssignment
			)

			if (!assignment) {
				error = 'Selected assignment not found'
				return
			}

			const data = await assessmentDataService.loadAssessmentData(
				assignment.subjectId, 
				assignment.assessmentId
			)

			if (data && data.paragraphs) {
				// Ensure paragraphs have IDs for proper tracking
				assignmentParagraphs = data.paragraphs.map(para => {
					if (typeof para === 'string') {
						return {
							id: generateId(),
							text: para,
							color: undefined
						}
					} else if (para && !para.id) {
						return {
							...para,
							id: generateId()
						}
					}
					return para
				})
			}
		} catch (err) {
			error = 'Failed to load paragraphs from assignment'
			console.error('Error loading assignment paragraphs:', err)
		} finally {
			loading = false
		}
	}

	/**
	 * Toggle paragraph selection
	 */
	function toggleParagraph(paragraphId) {
		if (selectedParagraphs.has(paragraphId)) {
			selectedParagraphs.delete(paragraphId)
		} else {
			selectedParagraphs.add(paragraphId)
		}
		selectedParagraphs = new Set(selectedParagraphs) // Trigger reactivity
	}

	/**
	 * Import selected paragraphs
	 */
	function importParagraphs() {
		if (selectedParagraphs.size === 0) {
			error = 'Please select at least one paragraph to import'
			return
		}

		const paragraphsToImport = assignmentParagraphs.filter(para => 
			selectedParagraphs.has(para.id)
		).map(para => ({
			...para,
			id: generateId(), // Generate new ID to avoid conflicts
			subjectId: currentSubjectId,
			assessmentId: currentAssessmentId
		}))

		dispatch('import', { paragraphs: paragraphsToImport })
		closeModal()
	}

	/**
	 * Close modal and reset state
	 */
	function closeModal() {
		show = false
		selectedAssignment = ''
		assignmentParagraphs = []
		selectedParagraphs = new Set()
		error = ''
		dispatch('close')
	}

	/**
	 * Handle assignment selection change
	 */
	function handleAssignmentChange() {
		loadAssignmentParagraphs()
	}
</script>

<!-- Bootstrap 5 Modal -->
{#if show}
	<div class="modal fade show d-block" tabindex="-1" role="dialog" style="background-color: rgba(0,0,0,0.5)">
		<div class="modal-dialog modal-lg" role="document">
			<div class="modal-content">
				<div class="modal-header bg-primary text-white">
					<h5 class="modal-title">
						<i class="bi bi-download me-2"></i>Import Paragraphs to Text Box
					</h5>
					<button type="button" class="btn-close btn-close-white" on:click={closeModal} aria-label="Close modal"></button>
				</div>
				
				<div class="modal-body">
					<div class="alert alert-info mb-3">
						<i class="bi bi-info-circle me-2"></i>
						<strong>Note:</strong> Selected paragraphs will be imported to the text box where you can edit them before adding to your assignment.
					</div>
					
					{#if loading && availableAssignments.length === 0}
						<div class="text-center">
							<div class="spinner-border text-primary" role="status">
								<span class="visually-hidden">Loading...</span>
							</div>
							<p class="mt-2">Loading available assignments...</p>
						</div>
					{:else if error}
						<div class="alert alert-danger">
							<i class="bi bi-exclamation-triangle me-2"></i>{error}
						</div>
					{:else if filteredAssignments.length === 0}
						<div class="alert alert-info">
							<i class="bi bi-info-circle me-2"></i>No other assignments available to import from.
						</div>
					{:else}
						<!-- Assignment Selection -->
						<div class="mb-3">
							<label for="assignmentSelect" class="form-label fw-bold">Select Assignment:</label>
							<select 
								id="assignmentSelect" 
								class="form-select" 
								bind:value={selectedAssignment}
								on:change={handleAssignmentChange}
							>
								<option value="">Choose an assignment...</option>
								{#each filteredAssignments as assignment}
									<option value="{assignment.subjectId}-{assignment.assessmentId}">
										{assignment.displayName}
									</option>
								{/each}
							</select>
						</div>

						<!-- Paragraphs List -->
						{#if selectedAssignment && assignmentParagraphs.length > 0}
							<div class="mb-3">
								<h6 class="fw-bold">Select paragraphs to import:</h6>
								<div class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
									{#each assignmentParagraphs as paragraph, index}
										<div class="form-check mb-2">
											<input 
												class="form-check-input" 
												type="checkbox" 
												id="import-para-{paragraph.id}"
												checked={selectedParagraphs.has(paragraph.id)}
												on:change={() => toggleParagraph(paragraph.id)}
											>
											<label class="form-check-label" for="import-para-{paragraph.id}">
												<div class="d-flex align-items-start">
													<div class="flex-grow-1">
														<p class="mb-1">{paragraph.text}</p>
														{#if paragraph.color}
															<span class="badge bg-secondary">{paragraph.color}</span>
														{/if}
													</div>
												</div>
											</label>
										</div>
									{/each}
								</div>
								
								{#if selectedParagraphs.size > 0}
									<div class="alert alert-success mt-2">
										<i class="bi bi-check-circle me-2"></i>
										{selectedParagraphs.size} paragraph{selectedParagraphs.size !== 1 ? 's' : ''} selected for import
									</div>
								{/if}
							</div>
						{:else if selectedAssignment && assignmentParagraphs.length === 0}
							<div class="alert alert-warning">
								<i class="bi bi-exclamation-triangle me-2"></i>
								No paragraphs found in the selected assignment.
							</div>
						{/if}

						{#if loading && selectedAssignment}
							<div class="text-center">
								<div class="spinner-border spinner-border-sm text-primary" role="status">
									<span class="visually-hidden">Loading paragraphs...</span>
								</div>
								<span class="ms-2">Loading paragraphs...</span>
							</div>
						{/if}
					{/if}
				</div>
				
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" on:click={closeModal}>
						<i class="bi bi-x me-2"></i>Cancel
					</button>
					{#if selectedParagraphs.size > 0}
						<button 
							type="button" 
							class="btn btn-primary" 
							on:click={importParagraphs}
							disabled={loading}
						>
							<i class="bi bi-download me-2"></i>Import {selectedParagraphs.size} Paragraph{selectedParagraphs.size !== 1 ? 's' : ''} to Text Box
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal.show {
		display: block !important;
	}
	
	.form-check-label {
		cursor: pointer;
	}
	
	.badge {
		font-size: 0.75em;
	}
</style>
