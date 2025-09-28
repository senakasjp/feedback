<!--
  AppTemplate Component
  Extracted from App.svelte to reduce file size
  Contains the entire template section from App.svelte
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
					{categoryMarks}
					{getTotalMarks}
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
					currentStudentId={currentStudentId}
					{studentName}
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

<!-- Total Marks Warning Modal -->
{#if showTotalMarksWarning}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-warning text-dark">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Total Marks Warning
					</h5>
				</div>
				<div class="modal-body">
					<div class="alert alert-warning">
						<i class="bi bi-warning me-2"></i>
						<strong>Warning:</strong> You have entered marks for individual categories (Total: {getTotalMarks()}) but the total marks field is empty or zero.
					</div>
					<p>Please either:</p>
					<ul>
						<li>Enter a total marks value that matches your category marks, or</li>
						<li>Clear the category marks if you want to use a different marking system</li>
					</ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-warning" onclick={() => showTotalMarksWarning = false}>
						<i class="bi bi-check me-1"></i>I Understand
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Add Student Modal -->
{#if showAddStudent}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-primary text-white">
					<h5 class="modal-title">
						<i class="bi bi-person-plus me-2"></i>Add New Student
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => showAddStudent = false}></button>
				</div>
				<div class="modal-body">
					<form onsubmit={addStudent}>
						<div class="mb-3">
							<label for="newStudentName" class="form-label">Student Name:</label>
							<input 
								type="text" 
								class="form-control" 
								id="newStudentName" 
								bind:value={newStudentName}
								placeholder="Enter student name"
								required
							>
						</div>
						<div class="mb-3">
							<label for="newStudentId" class="form-label">Student ID:</label>
							<input 
								type="text" 
								class="form-control" 
								id="newStudentId" 
								bind:value={newStudentId}
								placeholder="Enter student ID"
								required
							>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-secondary" onclick={() => showAddStudent = false}>
								<i class="bi bi-x me-1"></i>Cancel
							</button>
							<button type="submit" class="btn btn-primary">
								<i class="bi bi-plus me-1"></i>Add Student
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Student Manager Modal -->
{#if showStudentManager}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header bg-info text-white">
					<h5 class="modal-title">
						<i class="bi bi-people me-2"></i>Student Manager
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => showStudentManager = false}></button>
				</div>
				<div class="modal-body">
					<div class="table-responsive">
						<table class="table table-striped table-hover">
							<thead class="table-dark">
								<tr>
									<th>Name</th>
									<th>ID</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each students as student}
									<tr>
										<td>{student.displayName}</td>
										<td>{student.id}</td>
										<td>
											<button 
												class="btn btn-sm btn-outline-danger" 
												onclick={() => {
													studentToDelete = student
													showDeleteConfirmation = true
												}}
												title="Delete student"
											>
												<i class="bi bi-trash"></i>
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => showStudentManager = false}>
						<i class="bi bi-x me-1"></i>Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Student Confirmation Modal -->
{#if showDeleteConfirmation}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Delete Student
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => showDeleteConfirmation = false}></button>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger">
						<i class="bi bi-warning me-2"></i>
						<strong>Warning:</strong> This action cannot be undone!
					</div>
					<p>Are you sure you want to delete <strong>{studentToDelete?.displayName}</strong>?</p>
					<p class="text-muted small">This will also delete all associated student data, including evaluations and paragraphs.</p>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => showDeleteConfirmation = false}>
						<i class="bi bi-x me-1"></i>Cancel
					</button>
					<button 
						type="button" 
						class="btn btn-danger" 
						onclick={() => {
							deleteStudent(studentToDelete.id)
							showDeleteConfirmation = false
						}}
					>
						<i class="bi bi-trash me-1"></i>Delete Student
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Success Notification -->
{#if showNotification}
	<div class="toast-container position-fixed top-0 end-0 p-3">
		<div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
			<div class="toast-header bg-success text-white">
				<i class="bi bi-check-circle me-2"></i>
				<strong class="me-auto">Success</strong>
				<button type="button" class="btn-close btn-close-white" onclick={() => showNotification = false}></button>
			</div>
			<div class="toast-body">
				{notificationMessage}
			</div>
		</div>
	</div>
{/if}
