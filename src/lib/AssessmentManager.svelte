<script lang="ts">

	// Types
	type Assessment = {
		id: string;
		name: string;
		topics?: Topic[];
		categories?: Category[];
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
		onSelectAssessment, 
		onUpdateAssessments,
		showAddAssessment = false,
		newAssessmentName = '',
		onAddAssessment
	}: {
		assessments?: Assessment[];
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

	// Functions
	// Ensure all assessments have categories array initialized
	$effect(() => {
		assessments.forEach(assessment => {
			if (!assessment.categories) {
				assessment.categories = [];
			}
		});
	});

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
</script>

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
						<label for="assessmentName" class="form-label">Assessment Name:</label>
						<div class="input-group">
							<input
								id="assessmentName"
								type="text"
								class="form-control"
								placeholder="Enter assessment name..."
								bind:value={localNewAssessmentName}
								onkeydown={handleKeydown}
							>
							<button 
								class="btn btn-outline-success"
								onclick={addAssessment}
								disabled={!localNewAssessmentName.trim()}
							>
								<i class="bi bi-plus-circle me-1"></i>Add
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
							<h6 class="mb-0 fw-bold">Assessment</h6>
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
						<h5 class="mb-3">{assessment.name}</h5>
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
	{:else}
		<div class="row">
			<div class="col-12">
				<div class="text-center py-5">
					<div class="card border-0 shadow-sm">
						<div class="card-body py-5">
							<i class="bi bi-clipboard-check text-muted mb-3" style="font-size: 4rem;"></i>
							<h4 class="text-muted mb-3">No assessments created yet</h4>
							<p class="text-muted mb-4 fs-5">Create your first assessment to start organizing feedback and categories.</p>
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
