<script>
	// Props
	export let show = false;
	export let students = [];
	export let currentStudentId = '';
	export let currentStudentName = '';
	export let onClose = () => {};
	export let onTransfer = (targetStudentId) => {};
	
	// Local state
	let selectedTargetStudentId = '';
	let showConfirmation = false;
	
	// Filter out current student from the list
	$: availableStudents = students.filter(student => student.id !== currentStudentId);
	
	// Reset state when modal opens/closes
	$: if (show) {
		selectedTargetStudentId = '';
		showConfirmation = false;
	}
	
	function handleTransfer() {
		if (selectedTargetStudentId) {
			onTransfer(selectedTargetStudentId);
			onClose();
		}
	}
	
	function handleCancel() {
		onClose();
	}
	
	function getSelectedStudentName() {
		const student = students.find(s => s.id === selectedTargetStudentId);
		return student ? student.name : '';
	}
</script>

<!-- Transfer Student Data Modal -->
{#if show}
	<div class="modal fade show" tabindex="-1" style="display: block; background-color: rgba(0,0,0,0.5);" role="dialog">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-warning text-dark">
					<h5 class="modal-title">
						<i class="bi bi-arrow-left-right me-2"></i>Transfer Student Data
					</h5>
					<button type="button" class="btn-close btn-close-dark" onclick={handleCancel} aria-label="Close modal"></button>
				</div>
				<div class="modal-body">
					{#if !showConfirmation}
						<!-- Step 1: Select Target Student -->
						<div class="mb-3">
							<p class="text-muted mb-3">
								<i class="bi bi-info-circle me-2"></i>
								Transfer all selections and marks from <strong>{currentStudentName}</strong> to another student for the same assessment.
							</p>
							
							<label for="targetStudentSelect" class="form-label fw-bold">Select Target Student:</label>
							<select 
								id="targetStudentSelect" 
								class="form-select" 
								bind:value={selectedTargetStudentId}
							>
								<option value="">Choose a student...</option>
								{#each availableStudents as student}
									<option value={student.id}>{student.name}</option>
								{/each}
							</select>
							
							{#if selectedTargetStudentId}
								<div class="mt-3 p-3 bg-light rounded">
									<h6 class="mb-2">
										<i class="bi bi-arrow-right me-2"></i>Transfer Summary
									</h6>
									<div class="row">
										<div class="col-6">
											<small class="text-muted d-block">From:</small>
											<strong>{currentStudentName}</strong>
										</div>
										<div class="col-6">
											<small class="text-muted d-block">To:</small>
											<strong>{getSelectedStudentName()}</strong>
										</div>
									</div>
									<div class="mt-2">
										<small class="text-muted">
											<i class="bi bi-list-check me-1"></i>
											This will transfer: selected paragraphs, category marks, and manual total marks
										</small>
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Step 2: Confirmation -->
						<div class="text-center">
							<div class="mb-4">
								<i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
							</div>
							<h5 class="mb-3">Confirm Transfer</h5>
							<p class="text-muted mb-4">
								Are you sure you want to transfer all data from <strong>{currentStudentName}</strong> to <strong>{getSelectedStudentName()}</strong>?
							</p>
							<div class="alert alert-warning">
								<i class="bi bi-warning me-2"></i>
								<strong>Warning:</strong> This will overwrite any existing data for the target student in this assessment.
							</div>
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					{#if !showConfirmation}
						<button type="button" class="btn btn-secondary" onclick={handleCancel}>
							<i class="bi bi-x-circle me-1"></i>Cancel
						</button>
						<button 
							type="button" 
							class="btn btn-warning" 
							onclick={() => showConfirmation = true}
							disabled={!selectedTargetStudentId}
						>
							<i class="bi bi-arrow-right me-1"></i>Continue
						</button>
					{:else}
						<button type="button" class="btn btn-secondary" onclick={() => showConfirmation = false}>
							<i class="bi bi-arrow-left me-1"></i>Back
						</button>
						<button type="button" class="btn btn-danger" onclick={handleTransfer}>
							<i class="bi bi-check-circle me-1"></i>Confirm Transfer
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
