<!--
  FeedbackView Component
  Extracted from App.svelte to reduce file size
-->

<script>
  import Breadcrumb from '../lib/Breadcrumb.svelte'
  import CategoryEditor from '../lib/CategoryEditor.svelte'
  import { getGroupedParagraphs } from '../logic/uiManager.js'
  import { generateId } from '../utils/helpers.js'

  // Props
  let {
    currentView,
    currentSubject,
    currentAssessment,
    currentSubjectId,
    currentAssessmentId,
    currentStudentId,
    assessmentData,
    subjects,
    students,
    percentageRanges,
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
    onHandleAssessmentHeaderPhotoUpload
  } = $props()

  // Reactive statements
  let groupedParagraphs = $derived(getGroupedParagraphs(assessmentData.paragraphs, currentAssessment))

  // Event handlers
  function handleBreadcrumbNavigation(view) {
    storeHelpers.setView(view)
  }

  function handleAssessmentHeaderPhotoUpload(event) {
    onHandleAssessmentHeaderPhotoUpload(event)
  }
</script>

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
  <div class="text-center py-5">
    <h1>Welcome to Feedback Manager v3.0.8</h1>
    <p class="lead">Select a subject to get started</p>
  </div>
{:else if currentView === 'subjects'}
  <div class="text-center py-5">
    <h2>Subjects Overview</h2>
    <p>Select a subject to view its assessments</p>
  </div>
{:else if currentView === 'assessments'}
  <div class="text-center py-5">
    <h2>Assessments</h2>
    <p>Select an assessment to provide feedback</p>
  </div>
{:else if currentView === 'subject-manager'}
  <div class="text-center py-5">
    <h2>Subject Manager</h2>
    <p>Manage your subjects and assessments</p>
  </div>
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
