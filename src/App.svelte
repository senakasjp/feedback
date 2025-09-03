<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount } from 'svelte'
	import jsPDF from 'jspdf'

	// Data structure for hierarchical subjects/assessments
	let subjects = $state([])
	let currentSubjectId = $state(null)
	let currentAssessmentId = $state(null)
	let currentSubject = $state(null)
	let currentAssessment = $state(null)

	// Current assessment data
	let newParagraph = $state('')
	let paragraphs = $state([])
	let selectedParagraphs = $state(new Set())
	let studentName = $state('')
	let studentImage = $state('')

	// UI state
	let showAddSubject = $state(false)
	let showAddAssessment = $state(false)
	let newSubjectName = $state('')
	let newAssessmentName = $state('')

	// Category selection for Studio 6 PDR assessments
	let selectedCategory = $state('')
	let pdrCategories = [
		'Sub Objective 1.1',
		'Sub Objective 1.2', 
		'Sub Objective 2.1',
		'Sub Objective 2.2',
		'Sub Objective 3.1',
		'Sub Objective 3.2',
		'Report',
		'Decision'
	]

	// Category selection for Studio 4 PDR assessments
	let studio4Categories = [
		'Sub Learning Objective 1.1',
		'Sub Learning Objective 1.2',
		'Sub Learning Objective 2.1',
		'Sub Learning Objective 2.2',
		'Report',
		'Decision'
	]

	// Generate unique ID
	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2)
	}

	// Debug function to test if any JS is working
	function testFunction() {
		alert('JavaScript is working!')
		console.log('Test function called successfully')
	}

	async function loadSubjects() {
		try {
			// Try Tauri first (desktop app)
			const data = await invoke('read_portable')
			if (data) {
				const parsed = JSON.parse(data)
				subjects = parsed.subjects || []
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const data = localStorage.getItem('feedback-subjects')
				if (data) {
					const parsed = JSON.parse(data)
					subjects = parsed.subjects || []
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
			}
		}
	}

	async function saveSubjects() {
		const data = { subjects }
		
		try {
			// Try Tauri first (desktop app)
			await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
		} catch (error) {
			console.log('Tauri not available, saving to browser storage')
			// Fallback to localStorage for web development
			try {
				localStorage.setItem('feedback-subjects', JSON.stringify(data))
			} catch (localError) {
				console.error('Failed to save to localStorage:', localError)
			}
		}
	}

	async function loadAssessmentData(subjectId, assessmentId) {
		try {
			// Try Tauri first (desktop app)
			const data = await invoke('read_subject_data', { subjectId: `${subjectId}-${assessmentId}` })
			if (data) {
				const parsed = JSON.parse(data)
				paragraphs = parsed.paragraphs || []
				selectedParagraphs = new Set(parsed.selectedParagraphs || [])
				studentName = parsed.studentName || ''
				studentImage = parsed.studentImage || ''
			} else {
				// Initialize empty data
				paragraphs = []
				selectedParagraphs = new Set()
				studentName = ''
				studentImage = ''
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const key = `feedback-assessment-${subjectId}-${assessmentId}`
				const data = localStorage.getItem(key)
				if (data) {
					const parsed = JSON.parse(data)
					paragraphs = parsed.paragraphs || []
					selectedParagraphs = new Set(parsed.selectedParagraphs || [])
					studentName = parsed.studentName || ''
					studentImage = parsed.studentImage || ''
				} else {
					// Initialize empty data
					paragraphs = []
					selectedParagraphs = new Set()
					studentName = ''
					studentImage = ''
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
			}
		}
	}

	async function saveAssessmentData() {
		if (!currentSubjectId || !currentAssessmentId) return

		const data = {
			paragraphs,
			selectedParagraphs: Array.from(selectedParagraphs),
			studentName,
			studentImage
		}
		
		try {
			// Try Tauri first (desktop app)
			await invoke('write_subject_data', { 
				subjectId: `${currentSubjectId}-${currentAssessmentId}`, 
				data: JSON.stringify(data, null, 2) 
			})
		} catch (error) {
			console.log('Tauri not available, saving to browser storage')
			// Fallback to localStorage for web development
			try {
				const key = `feedback-assessment-${currentSubjectId}-${currentAssessmentId}`
				localStorage.setItem(key, JSON.stringify(data))
			} catch (localError) {
				console.error('Failed to save to localStorage:', localError)
			}
		}
	}

	function addSubject() {
		if (newSubjectName.trim()) {
			const subject = {
				id: generateId(),
				name: newSubjectName.trim(),
				assessments: []
			}
			subjects.push(subject)
			newSubjectName = ''
			showAddSubject = false
			saveSubjects()
		}
	}

	function addAssessment() {
		if (newAssessmentName.trim() && currentSubject) {
			const assessment = {
				id: generateId(),
				name: newAssessmentName.trim()
			}
			currentSubject.assessments.push(assessment)
			newAssessmentName = ''
			showAddAssessment = false
			saveSubjects()
		}
	}

	function selectSubject(subject) {
		currentSubjectId = subject.id
		currentSubject = subject
		currentAssessmentId = null
		currentAssessment = null
		// Clear current assessment data
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		studentImage = ''
	}

	function deleteSubject(subjectToDelete) {
		alert('DELETE FUNCTION CALLED!') // Simple test
		console.log('deleteSubject called with:', subjectToDelete)
		
		// Show confirmation dialog
		const confirmed = confirm(`Are you sure you want to delete "${subjectToDelete.name}" and all its assessments? This action cannot be undone.`)
		console.log('User confirmed deletion:', confirmed)
		
		if (confirmed) {
			console.log('Subjects before deletion:', subjects.length)
			
			// Remove subject from array
			subjects = subjects.filter(subject => subject.id !== subjectToDelete.id)
			console.log('Subjects after deletion:', subjects.length)
			
			// Save updated subjects list
			saveSubjects()
			
			// If we're currently viewing the deleted subject, go back to welcome
			if (currentSubject?.id === subjectToDelete.id) {
				currentSubject = null
				currentAssessment = null
				currentSubjectId = null
				currentAssessmentId = null
				paragraphs = []
				selectedParagraphs = new Set()
				studentName = ''
				studentImage = ''
			}
			
			console.log(`Subject "${subjectToDelete.name}" deleted successfully`)
		}
	}

	function selectAssessment(assessment) {
		currentAssessmentId = assessment.id
		currentAssessment = assessment
		loadAssessmentData(currentSubjectId, currentAssessmentId)
	}

	function goBackToSubjects() {
		currentSubjectId = null
		currentSubject = null
		currentAssessmentId = null
		currentAssessment = null
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		studentImage = ''
	}

	function goBackToAssessments() {
		currentAssessmentId = null
		currentAssessment = null
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		studentImage = ''
	}

	function addParagraph() {
		if (newParagraph.trim()) {
			let paragraphText = newParagraph.trim()
			
			// For Studio 6 or Studio 4 PDR assessments, add category prefix if selected
			if (needsCategorySelection() && selectedCategory) {
				paragraphText = `${selectedCategory}: ${paragraphText}`
			}
			
			paragraphs.push(paragraphText)
			newParagraph = ''
			saveAssessmentData()
		}
	}

	// Helper function to check if current assessment is Studio 6 PDR
	function isStudio6PDR() {
		const result = currentSubject?.name === "Studio 6" && 
		       (currentAssessment?.name === "Mid-PDR" || currentAssessment?.name === "Final PDR")
		
		// Debug logging
		console.log('isStudio6PDR check:', {
			currentSubject: currentSubject?.name,
			currentAssessment: currentAssessment?.name,
			result: result
		})
		
		return result
	}

	// Helper function to check if current assessment is Studio 4 PDR
	function isStudio4PDR() {
		const result = currentSubject?.name === "Studio 4" && 
		       (currentAssessment?.name === "Mid-PDR" || currentAssessment?.name === "Final-PDR")
		
		// Debug logging
		console.log('isStudio4PDR check:', {
			currentSubject: currentSubject?.name,
			currentAssessment: currentAssessment?.name,
			result: result
		})
		
		return result
	}

	// Helper function to check if current assessment needs category selection
	function needsCategorySelection() {
		return isStudio6PDR() || isStudio4PDR()
	}

	// Helper function to get the appropriate categories for current assessment
	function getCurrentCategories() {
		if (isStudio6PDR()) {
			return pdrCategories
		} else if (isStudio4PDR()) {
			return studio4Categories
		}
		return []
	}

	function toggleParagraph(index) {
		if (selectedParagraphs.has(index)) {
			selectedParagraphs.delete(index)
		} else {
			selectedParagraphs.add(index)
		}
		selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
		saveAssessmentData()
	}

	function deleteParagraph(index) {
		// Remove from paragraphs array
		paragraphs.splice(index, 1)
		
		// Update selected paragraphs indices (shift down for indices after deleted one)
		const newSelectedParagraphs = new Set()
		selectedParagraphs.forEach(selectedIndex => {
			if (selectedIndex < index) {
				// Keep indices before deleted paragraph unchanged
				newSelectedParagraphs.add(selectedIndex)
			} else if (selectedIndex > index) {
				// Shift down indices after deleted paragraph
				newSelectedParagraphs.add(selectedIndex - 1)
			}
			// Don't add the deleted index
		})
		selectedParagraphs = newSelectedParagraphs
		
		saveAssessmentData()
	}

	function getSectionOrder(paragraph) {
		// Check for Sub Objective patterns (Studio 6) and extract numbers
		const subObjectiveMatch = paragraph.match(/^Sub Objective (\d)\.(\d):/i)
		if (subObjectiveMatch) {
			const major = parseInt(subObjectiveMatch[1])
			const minor = parseInt(subObjectiveMatch[2])
			// Create numeric order: 1.1=11, 1.2=12, 2.1=21, 2.2=22, 3.1=31, 3.2=32
			return major * 10 + minor
		}

		// Check for Sub Learning Objective patterns (Studio 4) and extract numbers
		const subLearningObjectiveMatch = paragraph.match(/^Sub Learning Objective (\d)\.(\d):/i)
		if (subLearningObjectiveMatch) {
			const major = parseInt(subLearningObjectiveMatch[1])
			const minor = parseInt(subLearningObjectiveMatch[2])
			// Create numeric order: 1.1=11, 1.2=12, 2.1=21, 2.2=22
			return major * 10 + minor
		}
		
		// Check for Report and Decision
		if (paragraph.match(/^Report:/i)) {
			return 100 // After all sub objectives
		}
		if (paragraph.match(/^Decision:/i)) {
			return 101 // After Report
		}
		
		return 999 // Paragraphs without sections go to the end
	}

	function getOrderedParagraphs() {
		const ordered = paragraphs
			.map((paragraph, originalIndex) => ({ paragraph, originalIndex }))
			.sort((a, b) => {
				const orderA = getSectionOrder(a.paragraph)
				const orderB = getSectionOrder(b.paragraph)
				if (orderA !== orderB) {
					return orderA - orderB
				}
				// If same section, maintain original order
				return a.originalIndex - b.originalIndex
			})
		
		// Debug logging to verify order
		console.log('Ordered paragraphs:')
		ordered.forEach(({ paragraph, originalIndex }) => {
			const order = getSectionOrder(paragraph)
			const preview = paragraph.substring(0, 50) + (paragraph.length > 50 ? '...' : '')
			console.log(`Order ${order}: ${preview}`)
		})
		
		return ordered
	}

	function getSelectedText() {
		const orderedParagraphs = getOrderedParagraphs()
		const selectedOrderedParagraphs = Array.from(selectedParagraphs)
			.sort((a, b) => {
				// Find the ordered positions of these indices
				const posA = orderedParagraphs.findIndex(item => item.originalIndex === a)
				const posB = orderedParagraphs.findIndex(item => item.originalIndex === b)
				return posA - posB
			})
			.map(index => paragraphs[index])
		
		// Group paragraphs by section and format for display
		const groupedSections = {}
		selectedOrderedParagraphs.forEach(paragraph => {
			const match = paragraph.match(/^(Sub (?:Objective|Learning Objective) \d\.\d|Report|Decision):\s*(.*)$/i)
			if (match) {
				const section = match[1]
				const content = match[2]
				if (!groupedSections[section]) {
					groupedSections[section] = []
				}
				groupedSections[section].push(content)
			} else {
				// Paragraph without section
				if (!groupedSections['Other']) {
					groupedSections['Other'] = []
				}
				groupedSections['Other'].push(paragraph)
			}
		})
		
		// Format output with section headers in proper numerical order
		const sectionOrder = [
			'Sub Objective 1.1', 'Sub Objective 1.2', 'Sub Objective 2.1', 'Sub Objective 2.2', 'Sub Objective 3.1', 'Sub Objective 3.2',
			'Sub Learning Objective 1.1', 'Sub Learning Objective 1.2', 'Sub Learning Objective 2.1', 'Sub Learning Objective 2.2',
			'Report', 'Decision', 'Other'
		]
		const result = []
		
		sectionOrder.forEach(section => {
			if (groupedSections[section]) {
				result.push(`${section}:`)
				groupedSections[section].forEach(content => {
					result.push(content)
				})
				result.push('') // Add blank line between sections
			}
		})
		
		// Remove trailing empty line
		if (result[result.length - 1] === '') {
			result.pop()
		}
		
		return result.join('\n\n')
	}

	function handleImageUpload(event) {
		const file = event.target.files[0]
		if (file) {
					const reader = new FileReader()
		reader.onload = function(e) {
			if (typeof e.target.result === 'string') {
				studentImage = e.target.result
				saveAssessmentData()
			}
		}
			reader.readAsDataURL(file)
		}
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(getSelectedText())
			.then(() => alert('Copied to clipboard!'))
			.catch(() => alert('Failed to copy to clipboard'))
	}

	function generatePDF() {
		const selectedText = getSelectedText()
		if (!selectedText) {
			alert('No paragraphs selected!')
			return
		}

		const doc = new jsPDF()
		
		// Page dimensions
		const margin = 20
		const pageWidth = doc.internal.pageSize.getWidth()
		const maxLineWidth = pageWidth - (margin * 2)
		let yPosition = 0 // Start at very top of page
		
		// Add full-width student image if available
		if (studentImage) {
			try {
				// Create a temporary image to get dimensions
				const img = new Image()
				img.onload = function() {
					// Calculate dimensions maintaining aspect ratio
					const aspectRatio = img.width / img.height
					
					// Use absolute full width (edge to edge)
					let imageWidth = pageWidth
					let imageHeight = pageWidth / aspectRatio
					
					// Position at absolute top-left (0,0)
					const xPosition = 0
					
					doc.addImage(studentImage, 'JPEG', xPosition, yPosition, imageWidth, imageHeight)
					
					// Continue with the rest of the PDF generation
					let currentY = yPosition + imageHeight + 15
					generateRestOfPDF(doc, currentY, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name)
				}
				img.src = studentImage
				return // Exit here as the rest will be handled in onload
			} catch (error) {
				console.log('Could not add image to PDF:', error)
			}
		}
		
		// If no image, continue with normal PDF generation (with margin)
		generateRestOfPDF(doc, margin, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name)
	}

	function generateRestOfPDF(doc, yPosition, margin, pageWidth, maxLineWidth, selectedText, studentName, subjectName, assessmentName) {
		// Try to set a font that's closer to Oxygen (Arial or Helvetica)
		try {
			doc.setFont('helvetica', 'normal')
		} catch (e) {
			// Fallback to default font if helvetica is not available
			console.log('Helvetica not available, using default font')
		}
		
		// Header info with reduced spacing and bold font
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(10)
		if (subjectName) {
			doc.text(`Subject: ${subjectName}`, margin, yPosition)
			yPosition += 8
		}
		
		if (assessmentName) {
			doc.text(`Assessment: ${assessmentName}`, margin, yPosition)
			yPosition += 6
		}
		
		if (studentName) {
			doc.text(`Student: ${studentName}`, margin, yPosition)
			yPosition += 6
		}
		
		// Reset font to normal for content
		doc.setFont('helvetica', 'normal')
		
		// Add separator line with reduced spacing
		yPosition += 3
		doc.setLineWidth(0.5)
		doc.line(margin, yPosition, pageWidth - margin, yPosition)
		yPosition += 10
		
		// Content with smaller font and bold category names
		doc.setFontSize(10) // Smaller font size
		const lineHeight = 4 // Further reduced line height for tighter spacing
		const pageHeight = doc.internal.pageSize.getHeight()
		
		// Split the text into lines and process each line
		const textLines = selectedText.split('\n')
		
		textLines.forEach((line) => {
			// Check if we need a new page
			if (yPosition > pageHeight - margin) {
				doc.addPage()
				yPosition = margin + 10
			}
			
			// Skip empty lines but add minimal spacing
			if (line.trim() === '') {
				yPosition += lineHeight * 0.3
				return
			}
			
			// Check if this line is a category header (ends with ':')
			if (line.match(/^(Sub (?:Objective|Learning Objective) \d\.\d|Report|Decision):$/i)) {
				// Bold font for category headers
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(10) // Same size as other content
				doc.text(line, margin, yPosition)
				doc.setFont('helvetica', 'normal') // Reset to normal
				doc.setFontSize(10) // Back to small font
				yPosition += lineHeight + 1 // Minimal extra spacing after headers
			} else {
				// Regular content - split long lines
				const wrappedLines = doc.splitTextToSize(line, maxLineWidth)
				wrappedLines.forEach((wrappedLine) => {
					if (yPosition > pageHeight - margin) {
						doc.addPage()
						yPosition = margin + 10
					}
					doc.text(wrappedLine, margin, yPosition)
					yPosition += lineHeight
				})
			}
		})
		
		// Generate filename with subject, assessment, and student name
		let filename = 'Feedback-report'
		if (subjectName) filename += `-${subjectName.replace(/[^a-zA-Z0-9]/g, '-')}`
		if (assessmentName) filename += `-${assessmentName.replace(/[^a-zA-Z0-9]/g, '-')}`
		if (studentName) filename += `-${studentName.replace(/[^a-zA-Z0-9]/g, '-')}`
		filename += '.pdf'
		
		// Save the PDF
		doc.save(filename)
	}

	onMount(() => {
		loadSubjects()
	})
</script>

<!-- Header -->
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
			</ul>
		</div>
	</div>
</nav>

<main>
	<div class="w-100 mt-4" style="padding: 0 16px; margin: 0; display: flex; width: calc(100vw - 32px); gap: 16px;">
		<!-- Sidebar -->
		<div style="width: 280px; min-width: 280px; flex-shrink: 0;">
			<div class="p-3 border bg-light position-sticky" style="top: 20px; height: calc(100vh - 120px); overflow-y: auto; border-radius: 8px;">
				<h5>Navigation</h5>
				
				{#if !currentSubject}
					<!-- Subject List -->
					<div class="mb-3">
						<div class="d-flex justify-content-between align-items-center mb-2">
							<h6 class="mb-0">Subjects</h6>
							<button 
								class="btn btn-primary btn-sm" 
								onclick={() => showAddSubject = true}
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
									onkeydown={(e) => e.key === 'Enter' && addSubject()}
								>
								<div class="btn-group w-100">
									<button class="btn btn-success btn-sm" onclick={addSubject}>Add</button>
									<button class="btn btn-secondary btn-sm" onclick={() => showAddSubject = false}>Cancel</button>
								</div>
							</div>
						{/if}
						
						{#each subjects as subject}
							<button 
								class="btn btn-outline-primary w-100 mb-1 text-start" 
								onclick={() => selectSubject(subject)}
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
						<button class="btn btn-secondary btn-sm mb-3" onclick={goBackToSubjects}>
							← Back to Subjects
						</button>
						
						<div class="d-flex justify-content-between align-items-center mb-2">
							<h6 class="mb-0">Assessments in {currentSubject.name}</h6>
							<button 
								class="btn btn-primary btn-sm" 
								onclick={() => showAddAssessment = true}
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
									onkeydown={(e) => e.key === 'Enter' && addAssessment()}
								>
								<div class="btn-group w-100">
									<button class="btn btn-success btn-sm" onclick={addAssessment}>Add</button>
									<button class="btn btn-secondary btn-sm" onclick={() => showAddAssessment = false}>Cancel</button>
								</div>
							</div>
						{/if}
						
						{#each currentSubject.assessments as assessment}
							<button 
								class="btn btn-outline-success w-100 mb-1 text-start" 
								onclick={() => selectAssessment(assessment)}
							>
								{assessment.name}
							</button>
						{/each}
						
						{#if currentSubject.assessments.length === 0}
							<p class="text-muted small">No assessments yet. Add your first assessment above.</p>
						{/if}
					</div>
				{:else}
					<!-- Feedback Mode Navigation -->
					<div class="mb-3">
						<button class="btn btn-secondary btn-sm mb-2 w-100" onclick={goBackToAssessments}>
							← Back to Assessments
						</button>
						<button class="btn btn-outline-secondary btn-sm w-100" onclick={goBackToSubjects}>
							← Back to Subjects
						</button>
					</div>
					
					<div class="alert alert-info p-2">
						<small>
							<strong>Current:</strong><br>
							Subject: {currentSubject.name}<br>
							Assessment: {currentAssessment.name}
						</small>
					</div>
				{/if}
			</div>
		</div>

		<!-- Main Content -->
		<div style="flex: 1; min-width: 0;">
			{#if !currentSubject}
				<!-- Welcome Screen -->
				<div class="p-3 border bg-light" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px;">
					<h2>Welcome to Feedback Manager</h2>
					<p>Select a subject from the sidebar to get started, or create a new subject.</p>
					
					<!-- DEBUG TEST BUTTONS -->
					<div class="mb-4 p-3 bg-warning bg-opacity-25 rounded">
						<h6>Debug Test Buttons:</h6>
						<button class="btn btn-primary btn-sm me-2" onclick={() => alert('Simple alert works!')}>Test Alert</button>
						<button class="btn btn-success btn-sm me-2" onclick={() => testFunction()}>Test Function</button>
						<button class="btn btn-danger btn-sm" onclick={() => console.log('Console test')}>Test Console</button>
					</div>
					
					{#if subjects.length > 0}
						<div class="row">
							{#each subjects as subject}
								<div class="col-xl-3 col-lg-4 col-md-6 mb-4">
									<div class="card h-100 shadow-sm border-0 subject-card">
										<div class="card-body d-flex flex-column text-center p-4 position-relative">
											<!-- Delete button in top-right corner -->
											<button 
												class="btn btn-outline-danger btn-sm position-absolute top-0 end-0 m-2 delete-subject-btn" 
												onclick={(e) => {
													console.log('Delete button clicked!', subject.name);
													e.stopPropagation(); 
													deleteSubject(subject);
												}}
												title="Delete subject"
											>
												×
											</button>
											
											<div class="subject-icon mb-3">
												📚
											</div>
											<h5 class="card-title mb-3 text-primary fw-bold">{subject.name}</h5>
											<p class="card-text text-muted mb-4 flex-grow-1">
												{subject.assessments.length} assessment{subject.assessments.length !== 1 ? 's' : ''}
											</p>
											<!-- Test delete button (temporary) -->
											<button 
												class="btn btn-danger btn-sm mb-2" 
												onclick={() => alert('TEST BUTTON CLICKED!')}
											>
												Test Click
											</button>
											<button 
												class="btn btn-warning btn-sm mb-2" 
												onclick={() => deleteSubject(subject)}
											>
												Delete {subject.name}
											</button>
											<button class="btn btn-primary w-100 mt-auto subject-btn" onclick={() => selectSubject(subject)}>
												Open
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if !currentAssessment}
				<!-- Subject Overview -->
				<div class="p-3 border bg-light" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px;">
					<h2>{currentSubject.name}</h2>
					<p>Select an assessment to start working on feedback, or create a new assessment.</p>
					
					{#if currentSubject.assessments.length > 0}
						<div class="row">
							{#each currentSubject.assessments as assessment}
								<div class="col-xl-3 col-lg-4 col-md-6 mb-4">
									<div class="card h-100 shadow-sm border-0 assessment-card">
										<div class="card-body d-flex flex-column text-center p-4">
											<div class="assessment-icon mb-3">
												📝
											</div>
											<h5 class="card-title mb-4 text-success fw-bold">{assessment.name}</h5>
											<button class="btn btn-success w-100 mt-auto assessment-btn" onclick={() => selectAssessment(assessment)}>
												Open
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Feedback Editor -->
				<div class="p-3 border bg-light" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px;">
					<h2>Feedback for {currentAssessment.name}</h2>
					<p class="text-muted">Subject: {currentSubject.name}</p>
					
					<!-- Student Info Section -->
					<div class="row mb-3">
						<div class="col-md-6">
							<label for="studentNameInput" class="form-label">Student Name:</label>
							<input 
								id="studentNameInput" 
								type="text" 
								class="form-control" 
								bind:value={studentName} 
								placeholder="Enter student name"
								onchange={saveAssessmentData}
							>
						</div>
						<div class="col-md-6">
							<label for="studentImageInput" class="form-label">Student Photo:</label>
							<div class="d-flex align-items-center gap-3">
								<input 
									id="studentImageInput" 
									type="file" 
									class="form-control" 
									accept="image/*"
									onchange={handleImageUpload}
									style="flex: 1;"
								>
								{#if studentImage}
									<img 
										src={studentImage} 
										alt="Student" 
										class="rounded border"
										style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0;"
									>
								{/if}
							</div>
						</div>
					</div>
					
					<!-- Add Paragraph Form -->
					<div class="mb-3">
						{#if needsCategorySelection()}
							<!-- Category selector for Studio 6 and Studio 4 PDR -->
							<div class="mb-3">
								<label for="categorySelect" class="form-label">Select category:</label>
								<select id="categorySelect" class="form-select form-control" bind:value={selectedCategory}>
									<option value="">No category (optional)</option>
									{#each getCurrentCategories() as category}
										<option value={category}>{category}</option>
									{/each}
								</select>
								{#if selectedCategory}
									<small class="text-muted">Paragraph will be prefixed with: <strong>{selectedCategory}</strong></small>
								{/if}
							</div>
						{/if}
						
						<label for="paragraphInput" class="form-label">Add a new paragraph:</label>
						<div class="input-group">
							<textarea id="paragraphInput" class="form-control" rows="3" bind:value={newParagraph} placeholder="Type your paragraph here..."></textarea>
							<button class="btn btn-primary" type="button" onclick={addParagraph}>Add</button>
						</div>
					</div>

					<!-- Display Paragraphs -->
					<div class="paragraphs">
						{#each getOrderedParagraphs() as { paragraph, originalIndex }}
							<div class="mb-3 p-2 border-start border-primary border-3 bg-white d-flex align-items-start">
								<div class="form-check me-3">
									<input 
										class="form-check-input" 
										type="checkbox" 
										id="paragraph-{originalIndex}"
										checked={selectedParagraphs.has(originalIndex)}
										onchange={() => toggleParagraph(originalIndex)}
									>
									<label class="form-check-label" for="paragraph-{originalIndex}">
										Select
									</label>
								</div>
								<p class="mb-0 flex-grow-1">{paragraph}</p>
								<button 
									class="btn btn-outline-danger btn-sm ms-2 delete-btn" 
									onclick={() => deleteParagraph(originalIndex)}
									title="Delete paragraph"
								>
									×
								</button>
							</div>
						{/each}
						
						{#if paragraphs.length === 0}
							<p class="text-muted">No paragraphs added yet. Use the textbox above to add your first paragraph.</p>
						{/if}
					</div>

					<!-- Selection Info -->
					{#if selectedParagraphs.size > 0}
						<div class="alert alert-info mt-3">
							<strong>{selectedParagraphs.size}</strong> paragraph{selectedParagraphs.size !== 1 ? 's' : ''} selected
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</main>

<!-- Selected Text Section - Only show when in feedback mode with selections -->
{#if currentAssessment && selectedParagraphs.size > 0}
	<div class="container-fluid mt-4 mb-4">
		<div class="row">
			<div class="col-12">
				<div class="card">
					<div class="card-header d-flex justify-content-between align-items-center">
						<h5 class="mb-0">Selected Paragraphs for {currentAssessment.name}</h5>
						<div class="btn-group">
							<button class="btn btn-success btn-sm" onclick={copyToClipboard}>
								📋 Copy to Clipboard
							</button>
							<button class="btn btn-danger btn-sm" onclick={generatePDF}>
								📄 Print to Download
							</button>
						</div>
					</div>
					<div class="card-body">
						<textarea 
							class="form-control" 
							rows="10" 
							readonly 
							value={getSelectedText()}
							style="font-family: 'Roboto', system-ui, sans-serif; font-size: 11px; line-height: 1.3;"
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Footer -->
<footer class="bg-dark text-light text-center py-3 mt-5">
	<div class="container-fluid">
		<p class="mb-0">&copy; 2025 Feedback Manager. All rights reserved.</p>
		<small class="text-muted">Built with Bootstrap and Svelte</small>
	</div>
</footer>

<style>
	/* Google Fonts Import */
	@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700;1,900&display=swap');

	/* Global reset and font setup */
	:global(html, body) {
		width: 100% !important;
		max-width: 100% !important;
		margin: 0 !important;
		padding: 0 !important;
		overflow-x: hidden !important;
		font-family: 'Roboto', system-ui, Helvetica, Arial, sans-serif !important;
	}
	
	/* Base font sizing - larger approach */
	:global(body) {
		font-size: 14px !important;
		line-height: 1.5 !important;
	}
	
	/* Headers */
	:global(h1) { font-size: 28px !important; }
	:global(h2) { font-size: 24px !important; }
	:global(h3) { font-size: 20px !important; }
	:global(h4) { font-size: 18px !important; }
	:global(h5) { font-size: 16px !important; }
	:global(h6) { font-size: 14px !important; }
	
	/* Navigation */
	:global(.navbar) {
		padding: 10px 20px !important;
		font-size: 14px !important;
	}
	
	:global(.navbar-brand) {
		font-size: 20px !important;
		font-weight: 600 !important;
	}
	
	:global(.nav-link) {
		font-size: 13px !important;
		padding: 6px 10px !important;
	}
	
	/* Form elements */
	:global(.form-control) {
		font-family: 'Roboto', system-ui, sans-serif !important;
		font-size: 13px !important;
		padding: 8px 12px !important;
		line-height: 1.4 !important;
	}
	
	:global(.form-label) {
		font-size: 13px !important;
		font-weight: 500 !important;
		margin-bottom: 6px !important;
	}
	
	/* Buttons */
	:global(.btn) {
		font-size: 13px !important;
		padding: 8px 16px !important;
		line-height: 1.3 !important;
	}
	
	:global(.btn-sm) {
		font-size: 12px !important;
		padding: 6px 10px !important;
	}
	
	/* Cards */
	:global(.card) {
		font-size: 13px !important;
	}
	
	:global(.card-header) {
		padding: 12px 18px !important;
		font-size: 14px !important;
	}
	
	:global(.card-body) {
		padding: 18px !important;
	}
	
	:global(.card-title) {
		font-size: 16px !important;
		margin-bottom: 12px !important;
		font-weight: 600 !important;
	}
	
	/* Text and paragraphs */
	:global(p) {
		font-size: 13px !important;
		line-height: 1.5 !important;
		margin-bottom: 10px !important;
	}
	
	/* Layout fixes */
	:global(.container-fluid) {
		width: 100% !important;
		max-width: 100% !important;
		padding-left: 16px !important;
		padding-right: 16px !important;
	}
	
	:global(.row) {
		margin: 0 -8px !important;
		width: calc(100% + 16px) !important;
		max-width: calc(100% + 16px) !important;
	}
	
	:global(.col-12) {
		padding: 0 8px !important;
	}
	
	/* Main layout spacing */
	:global(.w-100) {
		max-width: 100% !important;
	}
	
	/* Flexbox gap fallback for older browsers */
	:global(.flex-gap-16 > *:not(:last-child)) {
		margin-right: 16px;
	}
	
	/* Alerts */
	:global(.alert) {
		font-size: 12px !important;
		padding: 8px 12px !important;
	}
	
	/* Input groups */
	:global(.input-group) {
		font-size: 12px !important;
	}
	
	/* Form checks */
	:global(.form-check) {
		font-size: 12px !important;
	}
	
	:global(.form-check-label) {
		font-size: 12px !important;
	}
	
	/* Utility */
	:global(.text-muted) {
		font-size: 12px !important;
	}
	
	:global(.small) {
		font-size: 11px !important;
	}
	
	/* Box sizing for all elements */
	:global(*) {
		box-sizing: border-box !important;
	}

	/* Small delete button styling */
	:global(.delete-btn) {
		font-size: 16px !important;
		padding: 2px 8px !important;
		line-height: 1 !important;
		min-width: 28px !important;
		height: 28px !important;
		border-radius: 4px !important;
		opacity: 0.6 !important;
		transition: all 0.2s ease !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	:global(.delete-btn:hover) {
		opacity: 1 !important;
		transform: scale(1.1) !important;
	}

	/* Subject Delete Button Styling */
	:global(.delete-subject-btn) {
		width: 28px !important;
		height: 28px !important;
		border-radius: 50% !important;
		font-size: 16px !important;
		font-weight: bold !important;
		line-height: 1 !important;
		padding: 0 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		opacity: 0.7 !important;
		transition: all 0.2s ease !important;
		z-index: 1000 !important;
		position: relative !important;
		pointer-events: auto !important;
		cursor: pointer !important;
	}

	:global(.delete-subject-btn:hover) {
		opacity: 1 !important;
		background-color: #dc3545 !important;
		border-color: #dc3545 !important;
		color: white !important;
		transform: scale(1.1) !important;
	}

	/* Enhanced Card Styling */
	:global(.subject-card, .assessment-card) {
		transition: all 0.3s ease !important;
		border-radius: 18px !important;
		background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
		min-height: 280px !important;
	}

	:global(.subject-card:hover, .assessment-card:hover) {
		transform: translateY(-6px) !important;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15) !important;
	}

	:global(.subject-icon, .assessment-icon) {
		font-size: 48px !important;
		opacity: 0.9;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}

	:global(.subject-card .card-title) {
		font-size: 22px !important;
		font-weight: 700 !important;
		line-height: 1.2 !important;
		min-height: 54px !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	:global(.assessment-card .card-title) {
		font-size: 20px !important;
		font-weight: 700 !important;
		line-height: 1.2 !important;
		min-height: 54px !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	:global(.subject-btn, .assessment-btn) {
		font-weight: 600 !important;
		font-size: 15px !important;
		padding: 14px 28px !important;
		border-radius: 10px !important;
		box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15) !important;
		transition: all 0.2s ease !important;
		border: none !important;
		text-transform: uppercase !important;
		letter-spacing: 0.5px !important;
	}

	:global(.subject-btn:hover, .assessment-btn:hover) {
		transform: translateY(-2px) !important;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25) !important;
	}

	:global(.subject-btn) {
		background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
	}

	:global(.assessment-btn) {
		background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%) !important;
	}

	/* Welcome and Subject Overview improvements */
	:global(.bg-light) {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
		border: 1px solid #dee2e6 !important;
	}
</style>