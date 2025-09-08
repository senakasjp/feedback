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
		currentStudentId
	} = $props()
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
				
				<!-- Context Info -->
				<div class="card border-info mt-3">
					<div class="card-header bg-info text-white py-2">
						<h6 class="card-title mb-0">
							<i class="bi bi-info-circle me-2"></i>Current Session
						</h6>
					</div>
					<div class="card-body p-2">
						<small>
							<div class="mb-1">
								<i class="bi bi-book me-2"></i>
								<strong>Subject:</strong> {currentSubject?.name}
							</div>
							<div>
								<i class="bi bi-clipboard-check me-2"></i>
								<strong>Assessment:</strong> {currentAssessment?.name}
							</div>
						</small>
					</div>
				</div>
				
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

<style>
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
		background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
	}
	
	.save-btn:hover {
		background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
		box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
	}
	
	.load-btn {
		background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%);
	}
	
	.load-btn:hover {
		background: linear-gradient(135deg, #5a32a3 0%, #4c2a8a 100%);
		box-shadow: 0 6px 20px rgba(111, 66, 193, 0.4);
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
</style>
