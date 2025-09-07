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
		onUpdateSubjects 
	}: {
		subjects?: Subject[];
		onSelectSubject: (subject: Subject) => void;
		onUpdateSubjects: (subjects: Subject[]) => void;
	} = $props()

	// Local state
	let newSubjectName = $state('');
	let showAddForm = $state(false);
	let clickCount = $state(0);
	let lastClickedSubject = $state('');
	let buttonClicked = $state(false);

	// Functions
	function addSubject() {
		if (newSubjectName.trim()) {
			const newSubject: Subject = {
				id: Date.now().toString(),
				name: newSubjectName.trim(),
				assessments: []
			};
			const updatedSubjects = [...subjects, newSubject];
			subjects = updatedSubjects;
			onUpdateSubjects(updatedSubjects);
			newSubjectName = '';
			showAddForm = false;
		}
	}

	function removeSubject(subjectId: string) {
		console.log('=== DELETE FUNCTION CALLED ===');
		console.log('Subject ID to delete:', subjectId);
		console.log('Current subjects:', subjects);
		
		const subjectToDelete = subjects.find(s => s.id === subjectId);
		console.log('Found subject to delete:', subjectToDelete);
		
		if (!subjectToDelete) {
			console.log('ERROR: Subject not found!');
			return;
		}
		
		// Direct deletion without confirmation for now
		const updatedSubjects = subjects.filter(s => s.id !== subjectId);
		console.log('Updated subjects after deletion:', updatedSubjects);
		
		subjects = updatedSubjects;
		onUpdateSubjects(updatedSubjects);
		
		console.log('Subject deleted successfully!');
		console.log('=== DELETE FUNCTION COMPLETED ===');
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
</script>

<div class="content-area">
	<div class="page-header">
		<div class="header-content">
			<h1 class="page-title">Subjects</h1>
			<p class="page-subtitle">Create and manage your subjects</p>
		</div>
		<button 
			class="btn btn-primary add-btn"
			onclick={() => showAddForm = !showAddForm}
		>
			<span class="btn-icon">+</span>
			{showAddForm ? 'Cancel' : 'Add Subject'}
		</button>
	</div>

	{#if showAddForm}
		<div class="add-form-card">
			<div class="form-header">
				<h3>Add New Subject</h3>
			</div>
			<div class="form-body">
				<div class="input-group">
					<input
						type="text"
						class="form-control"
						placeholder="Enter subject name (e.g., Mathematics, Science, English)"
						bind:value={newSubjectName}
						onkeydown={handleKeydown}
					>
					<button 
						class="btn btn-success"
						onclick={addSubject}
						disabled={!newSubjectName.trim()}
					>
						Add Subject
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if subjects.length > 0}
		<div class="d-flex flex-wrap gap-3">
			{#each subjects as subject}
				<div class="card border-0 shadow-sm" style="min-width: 300px; max-width: 350px;">
					<div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
						<div class="d-flex align-items-center">
							<i class="bi bi-book text-primary me-2" style="font-size: 1.5rem;"></i>
							<span class="fw-bold text-dark">{subject.name}</span>
						</div>
						<button 
							class="btn btn-sm btn-danger rounded-circle"
							style="width: 32px; height: 32px; padding: 0;"
							onclick={() => {
								console.log('DELETE CLICKED FOR:', subject.name, subject.id);
								handleDeleteClick(subject.id);
							}}
							title="Delete subject"
						>
							<i class="bi bi-x"></i>
						</button>
					</div>
					<div class="card-body d-flex flex-column">
						<div class="mt-auto">
							<div class="d-flex justify-content-between align-items-center mb-3">
								<span class="text-muted small">Assessments:</span>
								<span class="badge bg-primary">{subject.assessments.length}</span>
							</div>
							<button 
								class="btn btn-primary w-100"
								onclick={() => onSelectSubject(subject)}
							>
								<i class="bi bi-gear me-2"></i>Manage Subject
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-5">
			<div class="card border-0 shadow-sm">
				<div class="card-body py-5">
					<i class="bi bi-book text-muted mb-3" style="font-size: 3rem;"></i>
					<h5 class="text-muted mb-3">No subjects created yet</h5>
					<p class="text-muted mb-4">Create your first subject to get started with managing assessments and feedback.</p>
					<button 
						class="btn btn-primary btn-lg"
						onclick={() => showAddForm = true}
					>
						<i class="bi bi-plus-circle me-2"></i>Create Your First Subject
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Styles are now in components.css -->
