<script lang="ts">
	// Types
	type Subject = {
		id: string;
		name: string;
		assessments: Assessment[];
	}

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
		subjects = [], 
		onSelectSubject, 
		onUpdateSubjects,
		showAddSubject = false,
		newSubjectName = '',
		onAddSubject
	}: {
		subjects?: Subject[];
		onSelectSubject: (subject: Subject) => void;
		onUpdateSubjects: (subjects: Subject[]) => void;
		showAddSubject?: boolean;
		newSubjectName?: string;
		onAddSubject?: (name: string) => void;
	} = $props()

	// Local state
	let showDeleteConfirm = $state(false);
	let subjectToDelete = $state(null);
	let localNewSubjectName = $state('');
	let clickCount = $state(0);
	let lastClickedSubject = $state('');

	// Functions

	function removeSubject(subjectId: string) {
		console.log('=== DELETE FUNCTION CALLED ===');
		console.log('Subject ID to delete:', subjectId);
		console.log('Current subjects:', subjects);
		
		const subject = subjects.find(s => s.id === subjectId);
		console.log('Found subject to delete:', subject);
		
		if (!subject) {
			console.log('ERROR: Subject not found!');
			return;
		}
		
		// Show custom confirmation dialog
		subjectToDelete = subject;
		showDeleteConfirm = true;
		
		console.log('=== DELETE FUNCTION COMPLETED ===');
	}

	function confirmDelete() {
		if (subjectToDelete) {
			const updatedSubjects = subjects.filter(s => s.id !== subjectToDelete.id);
			console.log('Updated subjects after deletion:', updatedSubjects);
			
			subjects = updatedSubjects;
			onUpdateSubjects(updatedSubjects);
			
			console.log('Subject deleted successfully!');
		}
		
		// Close dialog
		showDeleteConfirm = false;
		subjectToDelete = null;
	}

	function cancelDelete() {
		console.log('Deletion cancelled by user');
		showDeleteConfirm = false;
		subjectToDelete = null;
	}

	function handleDeleteClick(subjectId: string) {
		console.log('Delete button clicked for subject ID:', subjectId);
		removeSubject(subjectId);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			addSubject();
		}
	}

	function handleSubjectClick(subject: Subject, event: MouseEvent) {
		event.preventDefault();
		clickCount++;
		lastClickedSubject = subject.name;
		console.log('Subject clicked:', subject.name);
		onSelectSubject(subject);
	}

	function handleSubjectKeydown(subject: Subject, event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		clickCount++;
		lastClickedSubject = subject.name;
		console.log('Subject activated from keyboard:', subject.name);
		onSelectSubject(subject);
	}

	function addSubject() {
		if (localNewSubjectName.trim()) {
			const newSubject = {
				id: Date.now().toString(),
				name: localNewSubjectName.trim(),
				assessments: []
			};
			
			const updatedSubjects = [...subjects, newSubject];
			subjects = updatedSubjects;
			onUpdateSubjects(updatedSubjects);
			
			// Reset form
			localNewSubjectName = '';
			
			// Call parent add function if provided
			if (onAddSubject) {
				onAddSubject(newSubject.name);
			}
		}
	}
</script>

<div class="container-fluid">

	<!-- Add Subject Form -->
	{#if showAddSubject}
		<div class="row mb-4">
			<div class="col-12">
				<div class="card border-success">
					<div class="card-header bg-success text-white py-2">
						<h5 class="card-title mb-0">
							<i class="bi bi-plus-circle me-2"></i>Add New Subject
						</h5>
					</div>
					<div class="card-body">
						<label for="subjectName" class="form-label">Subject Name:</label>
						<div class="input-group">
							<input
								id="subjectName"
								type="text"
								class="form-control form-control-sm"
								placeholder="Enter subject name..."
								bind:value={localNewSubjectName}
								onkeydown={handleKeydown}
							>
							<button 
								class="btn btn-outline-success"
								onclick={addSubject}
								disabled={!localNewSubjectName.trim()}
							>
								<i class="bi bi-plus-circle me-1"></i>Add
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if subjects.length > 0}
		<div class="d-flex flex-wrap gap-3">
			{#each subjects as subject}
				<div
					class="card border-0 shadow-sm d-flex flex-column subject-card-clickable"
					style="min-width: 300px; max-width: 350px; aspect-ratio: 1; height: 300px;"
					role="button"
					tabindex="0"
					aria-label={`Open subject ${subject.name}`}
					onclick={(event) => handleSubjectClick(subject, event)}
					onkeydown={(event) => handleSubjectKeydown(subject, event)}
				>
					<div class="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-shrink-0">
						<div class="d-flex align-items-center">
							<i class="bi bi-book text-primary me-2 fs-4"></i>
							<span class="fw-bold text-dark">{subject.name}</span>
						</div>
						<button 
							type="button"
							class="btn btn-sm btn-outline-danger border-0"
							onclick={(event) => {
								event.stopPropagation();
								console.log('DELETE CLICKED FOR:', subject.name, subject.id);
								handleDeleteClick(subject.id);
							}}
							title="Delete subject"
							aria-label="Delete subject"
						>
							<i class="bi bi-x"></i>
						</button>
					</div>
					<div class="card-body d-flex flex-column justify-content-center align-items-center flex-grow-1">
						<div class="text-center">
							<div class="d-flex justify-content-between align-items-center mb-4">
								<span class="text-muted small">Assessments:</span>
								<span class="badge bg-primary">{subject.assessments.length}</span>
							</div>
							<button 
								type="button"
								class="btn btn-primary w-100"
								onclick={(event) => handleSubjectClick(subject, event)}
							>
								<i class="bi bi-gear me-2"></i>Manage Subject
							</button>
						</div>
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
							<i class="bi bi-book text-muted mb-3" style="font-size: 4rem;"></i>
							<h4 class="text-muted mb-3">No subjects created yet</h4>
							<p class="text-muted mb-4 fs-6">Create your first subject to get started with managing assessments and feedback.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Custom Delete Confirmation Dialog -->
{#if showDeleteConfirm && subjectToDelete}
	<div class="modal show d-block bg-dark bg-opacity-50" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Confirm Deletion
					</h5>
				</div>
				<div class="modal-body">
					<div class="d-flex align-items-center mb-3">
						<i class="bi bi-book text-danger me-3 fs-2"></i>
						<div>
							<h6 class="mb-1">Subject: <strong>{subjectToDelete.name}</strong></h6>
							<p class="text-muted mb-0">{subjectToDelete.assessments.length} assessment{subjectToDelete.assessments.length !== 1 ? 's' : ''}</p>
						</div>
					</div>
					<div class="alert alert-warning">
						<i class="bi bi-warning me-2"></i>
						<strong>Warning:</strong> This will permanently delete the subject and all its assessments. This action cannot be undone.
					</div>
					<p class="mb-0">Are you sure you want to delete this subject?</p>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={cancelDelete}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-danger" onclick={confirmDelete}>
						<i class="bi bi-trash me-2"></i>Delete Subject
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Styles are now in components.css -->
<style>
	.subject-card-clickable {
		cursor: pointer;
	}

	.subject-card-clickable:focus-visible {
		outline: 3px solid rgba(13, 110, 253, 0.35);
		outline-offset: 2px;
	}
 </style>
