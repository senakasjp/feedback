<!--
  AssignmentExportModal Component
  Modal for exporting assignment settings to create a new assignment
  Uses Bootstrap 5 styling as per project requirements
-->

<script>
  import { invoke } from '@tauri-apps/api/core'
  import { generateId } from '../utils/helpers.js'

  // Props
  export let showModal = false
  /** @type {any} */
  export let currentSubject = null
  /** @type {any} */
  export let currentAssessment = null
  /** @type {any[]} */
  export let subjects = []
  export let onClose = () => {}
  export let onExportComplete = () => {}

  // Local state
  let selectedSubjectId = ''
  let newSubjectName = ''
  let newAssessmentName = ''
  let isExporting = false
  let exportStatus = ''
  let showSuccessMessage = false
  let createNewSubject = false

  // Get available subjects for dropdown
  $: availableSubjects = subjects || []
  $: selectedSubject = availableSubjects.find(s => s.id === selectedSubjectId)

  // Reset form when modal opens
  $: if (showModal) {
    newSubjectName = (currentSubject && currentSubject.name) ? `${currentSubject.name} (Copy)` : ''
    newAssessmentName = (currentAssessment && currentAssessment.name) ? `${currentAssessment.name} (Copy)` : ''
    selectedSubjectId = ''
    createNewSubject = false
    exportStatus = ''
    showSuccessMessage = false
  }

  /**
   * Export assignment settings to create a new assignment
   */
  async function exportAssignmentSettings() {
    // Validate form inputs
    if (!currentAssessment || !newAssessmentName.trim()) {
      exportStatus = 'Please provide an assessment name.'
      return
    }

    if (!createNewSubject && !selectedSubjectId) {
      exportStatus = 'Please select a subject or choose to create a new one.'
      return
    }

    if (createNewSubject && !newSubjectName.trim()) {
      exportStatus = 'Please provide a name for the new subject.'
      return
    }

    isExporting = true
    exportStatus = 'Exporting assignment settings...'

    try {
      let targetSubject
      
      if (createNewSubject) {
        // Create new subject
        targetSubject = {
          id: generateId(newSubjectName.trim()),
          name: newSubjectName.trim(),
          assessments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        subjects.push(targetSubject)
      } else {
        // Use existing subject
        targetSubject = subjects.find(s => s.id === selectedSubjectId)
        if (!targetSubject) {
          exportStatus = 'Selected subject not found. Please try again.'
          isExporting = false
          return
        }
      }

      // Create new assessment with copied settings
      const newAssessment = {
        id: generateId(newAssessmentName.trim()),
        name: newAssessmentName.trim(),
        totalMarks: currentAssessment.totalMarks || '',
        categories: currentAssessment.categories ? [...currentAssessment.categories] : [],
        knowledgeAreas: currentAssessment.knowledgeAreas ? [...currentAssessment.knowledgeAreas] : [],
        headerPhoto: currentAssessment.headerPhoto || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Add new assessment to target subject
      targetSubject.assessments.push(newAssessment)

      // Save updated subjects data
      const data = { subjects, students: [], percentageRanges: [] }
      
      try {
        // Try Tauri first (desktop app)
        await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
      } catch (error) {
        console.log('Tauri not available, saving to browser storage')
        // Fallback to localStorage for web development
        localStorage.setItem('feedback-subjects', JSON.stringify(data))
      }

      exportStatus = 'Assignment settings exported successfully!'
      showSuccessMessage = true

      // Call completion callback after a short delay
      setTimeout(() => {
        onExportComplete()
        onClose()
      }, 2000)

    } catch (error) {
      console.error('Error exporting assignment settings:', error)
      exportStatus = 'Error exporting assignment settings. Please try again.'
    } finally {
      isExporting = false
    }
  }

  /**
   * Close modal and reset state
   */
  function closeModal() {
    if (!isExporting) {
      onClose()
    }
  }

  /**
   * Handle form submission
   */
  function handleSubmit(event) {
    event.preventDefault()
    exportAssignmentSettings()
  }
</script>

<!-- Bootstrap 5 Modal -->
{#if showModal}
  <div class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <i class="fas fa-download me-2"></i>Export Assignment Settings
          </h5>
          <button 
            type="button" 
            class="btn-close btn-close-white" 
            onclick={closeModal}
            disabled={isExporting}
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body">
          <div class="mb-3">
            <p class="text-muted">
              <i class="fas fa-info-circle me-2"></i>
              Export all settings from the current assignment to create a new assignment with the same configuration.
            </p>
          </div>

          {#if showSuccessMessage}
            <div class="alert alert-success" role="alert">
              <i class="fas fa-check-circle me-2"></i>
              {exportStatus}
            </div>
          {:else}
            <form onsubmit={handleSubmit}>
              <!-- Subject Selection -->
              <div class="mb-3">
                <label for="subjectSelection" class="form-label">
                  <i class="fas fa-book me-2"></i>Target Subject
                </label>
                
                <!-- Radio buttons for selection method -->
                <div class="mb-3">
                  <div class="form-check">
                    <input 
                      class="form-check-input" 
                      type="radio" 
                      id="selectExistingSubject"
                      bind:group={createNewSubject}
                      value={false}
                      disabled={isExporting}
                    >
                    <label class="form-check-label" for="selectExistingSubject">
                      Select existing subject
                    </label>
                  </div>
                  <div class="form-check">
                    <input 
                      class="form-check-input" 
                      type="radio" 
                      id="createNewSubject"
                      bind:group={createNewSubject}
                      value={true}
                      disabled={isExporting}
                    >
                    <label class="form-check-label" for="createNewSubject">
                      Create new subject
                    </label>
                  </div>
                </div>

                <!-- Existing subject dropdown -->
                {#if !createNewSubject}
                  <select 
                    class="form-select" 
                    bind:value={selectedSubjectId}
                    disabled={isExporting}
                  >
                    <option value="">Select a subject...</option>
                    {#each availableSubjects as subject}
                      <option value={subject.id}>{subject.name}</option>
                    {/each}
                  </select>
                  <div class="form-text">Choose an existing subject to add the new assessment to.</div>
                {/if}

                <!-- New subject input -->
                {#if createNewSubject}
                  <input 
                    type="text" 
                    class="form-control" 
                    bind:value={newSubjectName}
                    placeholder="Enter new subject name"
                    disabled={isExporting}
                  >
                  <div class="form-text">Enter a name for the new subject.</div>
                {/if}
              </div>

              <div class="mb-3">
                <label for="newAssessmentName" class="form-label">
                  <i class="fas fa-clipboard-check me-2"></i>New Assessment Name
                </label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="newAssessmentName"
                  bind:value={newAssessmentName}
                  placeholder="Enter assessment name"
                  required
                  disabled={isExporting}
                >
                <div class="form-text">This will be the name of the new assessment.</div>
              </div>

              <!-- Current Assignment Info -->
              <div class="card bg-light mb-3">
                <div class="card-header">
                  <h6 class="mb-0">
                    <i class="fas fa-copy me-2"></i>Exporting from:
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row">
                    <div class="col-6">
                      <strong>Subject:</strong><br>
                      <span class="text-primary">{currentSubject && currentSubject.name ? currentSubject.name : 'Unknown'}</span>
                    </div>
                    <div class="col-6">
                      <strong>Assessment:</strong><br>
                      <span class="text-success">{currentAssessment && currentAssessment.name ? currentAssessment.name : 'Unknown'}</span>
                    </div>
                  </div>
                  {#if currentAssessment && currentAssessment.categories && currentAssessment.categories.length > 0}
                    <div class="mt-2">
                      <strong>Categories:</strong> {currentAssessment.categories.length}
                    </div>
                  {/if}
                  {#if currentAssessment && currentAssessment.knowledgeAreas && currentAssessment.knowledgeAreas.length > 0}
                    <div class="mt-1">
                      <strong>Knowledge Areas:</strong> {currentAssessment.knowledgeAreas.length}
                    </div>
                  {/if}
                </div>
              </div>

              {#if exportStatus}
                <div class="alert alert-info" role="alert">
                  <i class="fas fa-info-circle me-2"></i>
                  {exportStatus}
                </div>
              {/if}
            </form>
          {/if}
        </div>

        <div class="modal-footer">
          {#if !showSuccessMessage}
            <button 
              type="button" 
              class="btn btn-secondary" 
              onclick={closeModal}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button 
              type="button" 
              class="btn btn-primary" 
              onclick={exportAssignmentSettings}
              disabled={isExporting || !newAssessmentName.trim() || (!createNewSubject && !selectedSubjectId) || (createNewSubject && !newSubjectName.trim())}
            >
              {#if isExporting}
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Exporting...
              {:else}
                <i class="fas fa-download me-2"></i>Export Settings
              {/if}
            </button>
          {:else}
            <button 
              type="button" 
              class="btn btn-success" 
              onclick={closeModal}
            >
              <i class="fas fa-check me-2"></i>Done
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Additional custom styles if needed */
  .modal {
    z-index: 1055;
  }
  
  .form-control:focus {
    border-color: #0d6efd;
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }
</style>
