<script>
	// Props
	let { 
		subjects = [],
		currentSubject = null,
		currentAssessment = null,
		showAddSubject = false,
		showAddAssessment = false,
		newSubjectName = '',
		newAssessmentName = '',
		showMobileSidebar = false,
		onSelectSubject,
		onSelectAssessment,
		onAddSubject,
		onAddAssessment,
		onGoBackToSubjects,
		onGoBackToAssessments,
		onToggleMobileSidebar,
		onToggleShowAddSubject,
		onToggleShowAddAssessment
	} = $props()
</script>

<div class="p-3 border bg-light position-sticky d-lg-block" style="top: 20px; margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px;">
	<!-- Mobile toggle button -->
	<div class="d-lg-none mb-3">
		<button class="btn btn-outline-primary w-100" onclick={() => onToggleMobileSidebar()}>
			{showMobileSidebar ? '🔼 Hide Navigation' : '🔽 Show Navigation'}
		</button>
	</div>
	
	<div class="{showMobileSidebar ? 'd-block' : 'd-none'} d-lg-block">
		<h5>Navigation</h5>
		
		{#if !currentSubject}
			<!-- Subject List -->
			<div class="mb-3">
				<div class="d-flex justify-content-between align-items-center mb-2">
					<h6 class="mb-0">Subjects</h6>
					<button 
						class="btn btn-primary btn-sm" 
						onclick={() => onToggleShowAddSubject()}
					>
						+ Add
					</button>
				</div>
				
				{#if showAddSubject}
					<div class="mb-2">
						<input 
							type="text" 
							class="form-control form-control-sm mb-2" 
							placeholder="Subject name"
							bind:value={newSubjectName}
							onkeydown={(e) => e.key === 'Enter' && onAddSubject()}
						>
						<div class="btn-group w-100">
							<button class="btn btn-success btn-sm" onclick={onAddSubject}>Add</button>
							<button class="btn btn-secondary btn-sm" onclick={() => onToggleShowAddSubject()}>Cancel</button>
						</div>
					</div>
				{/if}
				
				{#each subjects as subject}
					<button 
						class="btn btn-outline-primary w-100 mb-1 text-start" 
						onclick={() => onSelectSubject(subject)}
					>
						{subject.name} ({subject.assessments.length})
					</button>
				{/each}
				
				{#if subjects.length === 0}
					<p class="text-muted small">No subjects yet. Add your first subject above.</p>
				{/if}
			</div>
		{:else if !currentAssessment}
			<!-- Assessment List -->
			<div class="mb-3">
				<button class="btn btn-secondary btn-sm mb-3" onclick={onGoBackToSubjects}>
					← Back to Subjects
				</button>
				
				<div class="d-flex justify-content-between align-items-center mb-2">
					<h6 class="mb-0">Assessments in {currentSubject?.name}</h6>
					<button 
						class="btn btn-primary btn-sm" 
						onclick={() => onToggleShowAddAssessment()}
					>
						+ Add
					</button>
				</div>
				
				{#if showAddAssessment}
					<div class="mb-2">
						<input 
							type="text" 
							class="form-control form-control-sm mb-2" 
							placeholder="Assessment name"
							bind:value={newAssessmentName}
							onkeydown={(e) => e.key === 'Enter' && onAddAssessment()}
						>
						<div class="btn-group w-100">
							<button class="btn btn-success btn-sm" onclick={onAddAssessment}>Add</button>
							<button class="btn btn-secondary btn-sm" onclick={() => onToggleShowAddAssessment()}>Cancel</button>
						</div>
					</div>
				{/if}
				
				{#each currentSubject?.assessments || [] as assessment}
					<button 
						class="btn btn-outline-success w-100 mb-1 text-start" 
						onclick={() => onSelectAssessment(assessment)}
					>
						{assessment.name}
					</button>
				{/each}
				
				{#if (currentSubject?.assessments?.length || 0) === 0}
					<p class="text-muted small">No assessments yet. Add your first assessment above.</p>
				{/if}
			</div>
		{:else}
			<!-- Feedback Mode Navigation -->
			<div class="mb-3">
				<button class="btn btn-secondary btn-sm mb-2 w-100" onclick={onGoBackToAssessments}>
					← Back to Assessments
				</button>
				<button class="btn btn-outline-secondary btn-sm w-100" onclick={onGoBackToSubjects}>
					← Back to Subjects
				</button>
			</div>
			
			<div class="alert alert-info p-2">
				<small>
									<strong>Current:</strong><br>
				Subject: {currentSubject?.name}<br>
				Assessment: {currentAssessment?.name}
				</small>
			</div>
		{/if}
	</div>
</div>
