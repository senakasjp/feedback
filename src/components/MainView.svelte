<!--
  MainView Component
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

  // Props
  let {
    currentView,
    currentSubject,
    currentAssessment,
    currentSubjectId,
    currentAssessmentId,
    currentStudentId,
    subjects,
    students,
    percentageRanges,
    assessmentData,
    uiState,
    storeHelpers,
    onStudentSelect,
    onSaveStudentEvaluation,
    onLoadStudentEvaluation,
    onSaveStudentParagraphs,
    onSaveAssessmentData,
    onCopyToClipboard,
    onGeneratePDF,
    onAddPercentageRange,
    onDeletePercentageRange,
    onUpdateAssessment,
    onHandleAssessmentHeaderPhotoUpload,
    onSelectSubject,
    onDeleteSubject,
    onSelectAssessment,
    onAddAssessment,
    onUpdateAssessments,
    onDeleteAssessment,
    onBackToSubjects,
    onBackToAssessments,
    onBackToWelcome,
    onToggleAboutModal
  } = $props()

  // Event handlers
  function handleBreadcrumbNavigation(view) {
    storeHelpers.setView(view)
  }

  function handleAssessmentHeaderPhotoUpload(event) {
    onHandleAssessmentHeaderPhotoUpload(event)
  }
</script>

<!-- Header -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary py-1">
  <div class="container-fluid">
    <a class="navbar-brand small" href="/">Feedback Manager v3.0.8</a>
    <button class="navbar-toggler btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item">
          <span class="nav-link text-light small">
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
            class="btn btn-outline-light btn-sm ms-1" 
            onclick={() => storeHelpers.toggleDarkMode()}
            title={uiState.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={uiState.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {#if uiState.isDarkMode}
              <i class="bi bi-sun"></i>
            {:else}
              <i class="bi bi-moon"></i>
            {/if}
          </button>
        </li>
        <li class="nav-item">
          <button
            class="btn btn-outline-light btn-sm ms-1"
            onclick={() => storeHelpers.toggleCalculator()}
            title={uiState.showCalculator ? 'Hide Calculator' : 'Show Calculator'}
            aria-label={uiState.showCalculator ? 'Hide Calculator' : 'Show Calculator'}
          >
            <i class="bi bi-calculator"></i>
          </button>
        </li>
        <li class="nav-item">
          <button
            class="btn btn-outline-light btn-sm ms-1"
            onclick={onToggleAboutModal}
            title="About Feedback Manager"
            aria-label="About Feedback Manager"
          >
            <i class="bi bi-info-circle"></i>
          </button>
        </li>
      </ul>
    </div>
  </div>
</nav>

<main class="mt-2">
  <div class="container-fluid mb-2">
    <div class="row">
      <!-- Sidebar -->
      <div class="col-lg-3 col-md-4 col-12 mb-2">
        <Sidebar 
          subjects={subjects}
          currentSubject={currentSubject}
          currentAssessment={currentAssessment}
          currentView={currentView}
          currentStudentId={currentStudentId}
          studentName={assessmentData.studentName}
          showMobileSidebar={uiState.showMobileSidebar}
          showCalculator={uiState.showCalculator}
          percentageRanges={percentageRanges}
          categoryMarks={assessmentData.categoryMarks}
          getTotalMarks={assessmentData.getTotalMarks}
          onSelectSubject={onSelectSubject}
          onSelectAssessment={onSelectAssessment}
          onGoBackToSubjects={onBackToSubjects}
          onGoBackToAssessments={onBackToAssessments}
          onToggleMobileSidebar={() => storeHelpers.toggleMobileSidebar()}
          onToggleView={() => storeHelpers.toggleCalculator()}
          onToggleShowAddSubject={() => storeHelpers.showAddSubjectModal(true)}
          onToggleShowAddAssessment={() => storeHelpers.showAddAssessmentModal(true)}
          onSaveStudentEvaluation={onSaveStudentEvaluation}
          onLoadStudentEvaluation={onLoadStudentEvaluation}
          onSaveAssignmentData={onSaveAssessmentData}
          onCopyToClipboard={onCopyToClipboard}
          onGeneratePDF={onGeneratePDF}
          onAddPercentageRange={onAddPercentageRange}
          onDeletePercentageRange={onDeletePercentageRange}
        />
      </div>

      <!-- Main Content -->
      <div class="col-lg-9 col-md-8 col-12">
        <div class="p-2">
          <!-- Breadcrumb -->
          {#if currentView !== 'welcome'}
            <Breadcrumb 
              currentView={currentView}
              currentSubject={currentSubject}
              currentAssessment={currentAssessment}
              onNavigate={handleBreadcrumbNavigation}
            />
          {/if}

          <!-- View Content -->
          {#if currentView === 'welcome'}
            <WelcomeScreen 
              subjects={subjects}
              onSelectSubject={onSelectSubject}
              onDeleteSubject={onDeleteSubject}
            />
          {:else if currentView === 'subjects'}
            <SubjectOverview 
              currentSubject={currentSubject}
              onSelectAssessment={onSelectAssessment}
            />
          {:else if currentView === 'assessments'}
            <AssessmentManager 
              assessments={currentSubject?.assessments || []}
              students={students}
              subjectName={currentSubject?.name || 'Unknown Subject'}
              onAssessmentSelect={onSelectAssessment}
              onAddAssessment={onAddAssessment}
              onUpdateAssessment={onUpdateAssessments}
              onDeleteAssessment={onDeleteAssessment}
              onBack={onBackToSubjects}
            />
          {:else if currentView === 'subject-manager'}
            <SubjectManager 
              subjects={subjects}
              onSubjectSelect={onSelectSubject}
              onAddSubject={() => {}}
              onUpdateSubject={() => {}}
              onDeleteSubject={onDeleteSubject}
              onBack={onBackToWelcome}
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
                        onchange={(e) => onStudentSelect(e.currentTarget.value)}
                      >
                        <option value="">Select a student...</option>
                        {#each students as student}
                          <option value={student.id}>{student.displayName}</option>
                        {/each}
                      </select>
                      <button
                        class="btn btn-outline-primary btn-sm"
                        type="button"
                        onclick={() => storeHelpers.showAddStudentModal(true)}
                        title="Add new student"
                        aria-label="Add new student"
                      >
                        <i class="bi bi-person-plus"></i>
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        type="button"
                        onclick={() => storeHelpers.showStudentManagerModal(true)}
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
                          <strong class="small">Selected Student:</strong> <span class="small">{students.find(s => s.id === currentStudentId)?.displayName || 'No student selected'}</span>
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
                  onUpdateAssessment(currentSubjectId, currentAssessmentId, { categories: currentAssessment.categories })
                }
              }}
              onUpdateKnowledgeAreas={() => {
                if (currentAssessment) {
                  onUpdateAssessment(currentSubjectId, currentAssessmentId, { knowledgeAreas: currentAssessment.knowledgeAreas })
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
                    onclick={onSaveStudentEvaluation}
                    disabled={!currentStudentId}
                  >
                    <i class="bi bi-save me-1"></i>Save Student Evaluation
                  </button>
                  <button 
                    class="btn btn-secondary btn-sm"
                    onclick={onSaveStudentParagraphs}
                    disabled={!currentStudentId}
                  >
                    <i class="bi bi-save me-1"></i>Save Paragraphs
                  </button>
                  <button 
                    class="btn btn-outline-secondary btn-sm"
                    onclick={onSaveAssessmentData}
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
