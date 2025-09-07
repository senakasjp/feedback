<script lang="ts">
	import CategoryEditor from './CategoryEditor.svelte';

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
		onUpdateAssessments 
	}: {
		assessments?: Assessment[];
		onSelectAssessment: (assessment: Assessment) => void;
		onUpdateAssessments: (assessments: Assessment[]) => void;
	} = $props()

	// Local state
	let newAssessmentName = $state('');
	let showAddForm = $state(false);

	// Functions
	function addAssessment() {
		if (newAssessmentName.trim()) {
			const newAssessment: Assessment = {
				id: Date.now().toString(),
				name: newAssessmentName.trim(),
				topics: [],
				categories: []
			};
			const updatedAssessments = [...assessments, newAssessment];
			assessments = updatedAssessments;
			onUpdateAssessments(updatedAssessments);
			newAssessmentName = '';
			showAddForm = false;
		}
	}

	// Ensure all assessments have categories array initialized
	$effect(() => {
		assessments.forEach(assessment => {
			if (!assessment.categories) {
				assessment.categories = [];
			}
		});
	});

	function removeAssessment(assessmentId: string) {
		if (confirm('Are you sure you want to delete this assessment and all its data?')) {
			const updatedAssessments = assessments.filter(a => a.id !== assessmentId);
			assessments = updatedAssessments;
			onUpdateAssessments(updatedAssessments);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			addAssessment();
		}
	}
</script>

<div class="content-area">
	<div class="page-header">
		<div class="header-content">
			<h1 class="page-title">Assessments</h1>
			<p class="page-subtitle">Create and manage assessments for this subject</p>
		</div>
		<button 
			class="btn btn-primary add-btn"
			onclick={() => showAddForm = !showAddForm}
		>
			<span class="btn-icon">+</span>
			{showAddForm ? 'Cancel' : 'Add Assessment'}
		</button>
	</div>

	{#if showAddForm}
		<div class="add-form-card">
			<div class="form-header">
				<h3>Add New Assessment</h3>
			</div>
			<div class="form-body">
				<div class="input-group">
					<input
						type="text"
						class="form-control"
						placeholder="Enter assessment name (e.g., Mid-Term, Final Exam, Quiz)"
						bind:value={newAssessmentName}
						onkeydown={handleKeydown}
					>
					<button 
						class="btn btn-success"
						onclick={addAssessment}
						disabled={!newAssessmentName.trim()}
					>
						Add Assessment
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if assessments.length > 0}
		<div class="assessments-grid">
			{#each assessments as assessment}
				<div class="assessment-card">
					<div class="card-header">
						<div class="assessment-icon">📝</div>
						<button 
							class="btn btn-sm btn-outline-danger delete-btn"
							onclick={() => removeAssessment(assessment.id)}
							title="Delete assessment"
						>
							×
						</button>
					</div>
					<div class="card-body">
						<h3 class="assessment-name">{assessment.name}</h3>
						<div class="assessment-stats">
							<span class="stat-badge topics">
								{assessment.topics?.length || 0} topics
							</span>
							<span class="stat-badge categories">
								{assessment.categories?.length || 0} categories
							</span>
						</div>
					</div>
					<div class="card-footer">
						<div class="categories-preview">
							<h6>Categories:</h6>
							{#if !assessment.categories}
								{@const categories = []}
								{assessment.categories = categories}
							{/if}
							<CategoryEditor 
								bind:categories={assessment.categories}
								onUpdateCategories={() => onUpdateAssessments(assessments)}
							/>
						</div>
						<button 
							class="btn btn-success w-100"
							onclick={() => onSelectAssessment(assessment)}
						>
							Open Feedback
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-5">
			<p class="text-muted">No assessments created yet.</p>
			<button 
				class="btn btn-primary"
				onclick={() => showAddForm = true}
			>
				Create Your First Assessment
			</button>
		</div>
	{/if}
</div>

<!-- Styles are now in components.css -->
