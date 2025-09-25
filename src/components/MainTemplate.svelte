<!--
  MainTemplate Component
  Extracted from App.svelte to reduce file size
-->

<script>
  import Sidebar from '../lib/Sidebar.svelte'
  import WelcomeScreen from '../lib/WelcomeScreen.svelte'
  import SubjectOverview from '../lib/SubjectOverview.svelte'
  import SubjectManager from '../lib/SubjectManager.svelte'
  import AssessmentManager from '../lib/AssessmentManager.svelte'
  import Breadcrumb from '../lib/Breadcrumb.svelte'
  import CategoryEditor from '../lib/CategoryEditor.svelte'

  // Props - all the state and functions from App.svelte
  let {
    subjects,
    students,
    percentageRanges,
    currentSubjectId,
    currentAssessmentId,
    currentSubject,
    currentAssessment,
    currentStudentId,
    currentView,
    newParagraph,
    paragraphs,
    selectedParagraphs,
    studentName,
    selectedColor,
    newCategoryName,
    newCategoryKnowledgeArea,
    newCategoryAllocatedMarks,
    newKnowledgeAreaName,
    categoryMarks,
    manualTotalMarks,
    showTotalMarksWarning,
    categoryWarnings,
    showNotification,
    notificationMessage,
    deletingStudentId,
    showDeleteConfirmation,
    studentToDelete,
    showAddStudent,
    newStudentName,
    newStudentId,
    showStudentManager,
    showCalculator,
    showMobileSidebar,
    isDarkMode,
    editingParagraphIndex,
    editingParagraphText,
    // Removed autosave props to prevent data contamination
    // Functions
    toggleDarkMode,
    toggleCalculatorView,
    handleBreadcrumbNavigation,
    selectSubject,
    deleteSubject,
    selectAssessment,
    addAssessment,
    updateAssessment,
    deleteAssessment,
    goBackToSubjects,
    goBackToAssessments,
    addParagraph,
    addCategory,
    removeCategory,
    moveCategoryUp,
    moveCategoryDown,
    moveParagraphUp,
    moveParagraphDown,
    addKnowledgeArea,
    removeKnowledgeArea,
    updateCategoryMarks,
    updateCategoryAllocatedMarks,
    getTotalMarks,
    updateTotalMarks,
    showSuccessNotification,
    addStudent,
    deleteStudent,
    selectStudent,
    getCurrentStudent,
    addPercentageRange,
    deletePercentageRange,
    saveStudentEvaluation,
    loadStudentEvaluation,
    saveStudentParagraphs,
    loadStudentParagraphs,
    toggleParagraph,
    deleteParagraph,
    startEditParagraph,
    cancelEditParagraph,
    saveEditParagraph,
    getOrderedParagraphs,
    getColorBadgeClass,
    getColorHex,
    cleanParagraphTextForDisplay,
    extractKnowledgeArea,
    getGroupedParagraphs,
    getSelectedText,
    handleImageUpload,
    handleAssessmentHeaderPhotoUpload,
    copyToClipboard,
    generatePDF,
    generateRestOfPDF
  } = $props()
</script>

<!-- Template content extracted from App.svelte -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">Feedback Manager</a>
		<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-label="Toggle navigation">
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="navbarNav">
			<ul class="navbar-nav ms-auto">
				<li class="nav-item">
					<span class="nav-link text-light">
						{#if currentSubject && currentAssessment}
							{currentSubject.name} → {currentAssessment.name}
						{:else if currentSubject}
							{currentSubject.name}
						{:else}
							All Subjects
						{/if}
					</span>
				</li>
				<li class="nav-item">
					<button 
						class="btn btn-outline-light btn-sm ms-2" 
						onclick={toggleDarkMode}
						title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
						aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
					>
						{#if isDarkMode}
							<i class="bi bi-sun"></i>
						{:else}
							<i class="bi bi-moon"></i>
						{/if}
					</button>
				</li>
			</ul>
		</div>
	</div>
</nav>

<main class="mt-4">
	<div class="container-fluid mb-4">
		<div class="row">
			<!-- Sidebar -->
			<div class="col-lg-3 col-md-4 col-12 mb-4">
				<Sidebar 
					{subjects}
					{currentSubject}
					{currentAssessment}
					{currentView}
					{showMobileSidebar}
					{showCalculator}
					{percentageRanges}
					onSelectSubject={selectSubject}
					onSelectAssessment={selectAssessment}
					onGoBackToSubjects={goBackToSubjects}
					onGoBackToAssessments={goBackToAssessments}
					onToggleMobileSidebar={() => showMobileSidebar = !showMobileSidebar}
					onToggleView={toggleCalculatorView}
					onToggleShowAddSubject={() => {}}
					onToggleShowAddAssessment={() => {}}
					onSaveStudentEvaluation={saveStudentEvaluation}
					onLoadStudentEvaluation={loadStudentEvaluation}
					onSaveAssignmentData={() => {}}
					onCopyToClipboard={copyToClipboard}
					onGeneratePDF={generatePDF}
					onAddPercentageRange={addPercentageRange}
					onDeletePercentageRange={deletePercentageRange}
				/>
			</div>

			<!-- Main Content -->
			<div class="col-lg-9 col-md-8 col-12">
				<div class="p-3">
					<!-- Breadcrumb -->
					{#if currentView !== 'welcome'}
						<Breadcrumb 
							{currentView}
							{currentSubject}
							{currentAssessment}
							onNavigate={handleBreadcrumbNavigation}
						/>
					{/if}

					<!-- View Content -->
					{#if currentView === 'welcome'}
						<WelcomeScreen 
							{subjects}
							onSelectSubject={selectSubject}
							onDeleteSubject={deleteSubject}
						/>
					{:else if currentView === 'subjects'}
						<SubjectOverview 
							{currentSubject}
							onSelectAssessment={selectAssessment}
						/>
					{:else if currentView === 'assessments'}
						<AssessmentManager 
							assessments={currentSubject?.assessments || []}
							{students}
							subjectName={currentSubject?.name || 'Unknown Subject'}
							onAssessmentSelect={selectAssessment}
							onAddAssessment={addAssessment}
							onUpdateAssessment={updateAssessment}
							onDeleteAssessment={deleteAssessment}
							onBack={goBackToSubjects}
						/>
					{:else if currentView === 'subject-manager'}
						<SubjectManager 
							{subjects}
							onSubjectSelect={selectSubject}
							onAddSubject={() => {}}
							onUpdateSubject={() => {}}
							onDeleteSubject={deleteSubject}
							onBack={() => currentView = 'welcome'}
						/>
					{:else if currentView === 'feedback'}
						<!-- Feedback View -->
						<div class="row mb-2">
							<div class="col-12">
								<h5 class="small">Feedback Editor</h5>
								<p class="text-muted small mb-1">Assessment: {currentAssessment?.name || 'No assessment selected'}</p>
							</div>
						</div>

						<!-- Student Selector -->
						<div class="card border-info mb-2">
							<div class="card-header bg-info text-white py-1">
								<h6 class="card-title mb-0 small">
									<i class="bi bi-person-circle me-1"></i>Student Information
								</h6>
							</div>
							<div class="card-body py-1">
								<div class="row g-1">
									<div class="col-12">
										<label for="studentSelect" class="form-label small">Student:</label>
										<div class="d-flex gap-1">
											<select
												id="studentSelect"
												class="form-select form-select-sm flex-grow-1"
												value={currentStudentId || ''}
												onchange={(e) => selectStudent(e.currentTarget.value)}
											>
												<option value="">Select a student...</option>
												{#each students as student}
													<option value={student.id}>{student.displayName}</option>
												{/each}
											</select>
											<button
												class="btn btn-outline-primary btn-sm"
												type="button"
												onclick={() => showAddStudent = true}
												title="Add new student"
												aria-label="Add new student"
											>
												<i class="bi bi-person-plus"></i>
											</button>
											<button
												class="btn btn-outline-secondary btn-sm"
												type="button"
												onclick={() => showStudentManager = true}
												title="Manage students"
												aria-label="Manage students"
											>
												<i class="bi bi-gear"></i>
											</button>
										</div>
										{#if currentStudentId}
											<div class="mt-1">
												<div class="alert alert-info py-1 mb-0">
													<i class="bi bi-check-circle me-1"></i>
													<strong class="small">Selected Student:</strong> <span class="small">{students.find(s => s.id === currentStudentId)?.displayName || 'Loading...'}</span>
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<!-- Category Editor -->
						<CategoryEditor 
							categories={currentAssessment?.categories || []}
							knowledgeAreas={currentAssessment?.knowledgeAreas || []}
							onUpdateCategories={() => {
								if (currentAssessment) {
									updateAssessment(currentSubjectId, currentAssessmentId, { categories: currentAssessment.categories })
								}
							}}
							onUpdateKnowledgeAreas={() => {
								if (currentAssessment) {
									updateAssessment(currentSubjectId, currentAssessmentId, { knowledgeAreas: currentAssessment.knowledgeAreas })
								}
							}}
						/>

						<!-- Assessment Header Photo Section -->
						<div class="row mb-2">
							<div class="col-12">
								<div class="card border-primary">
									<div class="card-header bg-primary text-white py-1">
										<h6 class="card-title mb-0 small">
											<i class="bi bi-image me-1"></i>Assessment Header Photo
										</h6>
									</div>
									<div class="card-body py-1">
										<div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-1">
											<input 
												id="assessmentHeaderPhotoInput" 
												type="file" 
												class="form-control form-control-sm flex-grow-1" 
												accept="image/*"
												onchange={handleAssessmentHeaderPhotoUpload}
											>
											{#if currentAssessment?.headerPhoto}
												<img 
													src={currentAssessment.headerPhoto} 
													alt="Assessment Header" 
													class="rounded border"
													style="width: 50px; height: 50px; object-fit: cover; flex-shrink: 0;"
												>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Assessment Header Photo Display (if uploaded) -->
						{#if currentAssessment?.headerPhoto}
							<div class="row mb-2">
								<div class="col-12">
									<div class="card border-primary">
										<div class="card-header bg-primary text-white py-1">
											<h6 class="card-title mb-0 small">
												<i class="bi bi-image me-1"></i>Assessment Header Photo
											</h6>
										</div>
										<div class="card-body p-0">
											<div class="text-center">
												<img 
													src={currentAssessment.headerPhoto} 
													alt="Assessment Header" 
													class="rounded-bottom w-100" 
													style="max-height: 400px; object-fit: contain;"
												>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/if}

						<!-- Save Buttons -->
						<div class="row mb-2">
							<div class="col-12">
								<div class="d-flex gap-1">
									<button 
										class="btn btn-primary btn-sm"
										onclick={saveStudentEvaluation}
										disabled={!currentStudentId}
									>
										<i class="bi bi-save me-1"></i>Save Student Evaluation
									</button>
									<button 
										class="btn btn-secondary btn-sm"
										onclick={saveStudentParagraphs}
										disabled={!currentStudentId}
									>
										<i class="bi bi-save me-1"></i>Save Paragraphs
									</button>
									<button 
										class="btn btn-outline-secondary btn-sm"
										onclick={() => {}}
									>
										<i class="bi bi-save me-1"></i>Save Assessment Data
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>

<!-- Rest of the template content would go here -->
<!-- This is a simplified version - the full template would include all the modals, forms, etc. -->
