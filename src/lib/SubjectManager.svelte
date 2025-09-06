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
		if (confirm('Are you sure you want to delete this subject and all its assessments?')) {
			const updatedSubjects = subjects.filter(s => s.id !== subjectId);
			subjects = updatedSubjects;
			onUpdateSubjects(updatedSubjects);
		}
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
		<div class="subjects-grid">
			{#each subjects as subject}
				<div class="subject-card">
					<div class="card-header">
						<div class="subject-icon">📚</div>
						<button 
							class="btn btn-sm btn-outline-danger delete-btn"
							onclick={() => removeSubject(subject.id)}
							title="Delete subject"
						>
							×
						</button>
					</div>
					<div class="card-body">
						<h3 class="subject-name">{subject.name}</h3>
						<div class="subject-stats">
							<span class="stat-badge">
								{subject.assessments.length} assessment{subject.assessments.length !== 1 ? 's' : ''}
							</span>
						</div>
					</div>
					<div class="card-footer">
						<button 
							class="btn btn-primary w-100"
							onclick={() => onSelectSubject(subject)}
						>
							Manage Subject
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-5">
			<p class="text-muted">No subjects created yet.</p>
			<button 
				class="btn btn-primary"
				onclick={() => showAddForm = true}
			>
				Create Your First Subject
			</button>
		</div>
	{/if}
</div>

<!-- Styles are now in components.css -->
