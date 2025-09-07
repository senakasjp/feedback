<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount } from 'svelte'
	import jsPDF from 'jspdf'
	import Sidebar from './lib/Sidebar.svelte'
	import WelcomeScreen from './lib/WelcomeScreen.svelte'
	import SubjectOverview from './lib/SubjectOverview.svelte'
	import SelectedTextSection from './lib/SelectedTextSection.svelte'
	import SubjectManager from './lib/SubjectManager.svelte'
	import AssessmentManager from './lib/AssessmentManager.svelte'
	import Breadcrumb from './lib/Breadcrumb.svelte'
	
	// Import CSS
	import './styles/reset.css'
	import './styles/design-system.css'
	import './styles/fixed-components.css'
	import './styles/subject-manager.css'
	import './styles/assessment-manager.css'

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
	let selectedColor = $state('red')
	let newCategoryName = $state('')

	// UI state
	let showAddSubject = $state(false)
	let showAddAssessment = $state(false)
	let newSubjectName = $state('')
	let newAssessmentName = $state('')
	let showMobileSidebar = $state(false)
	let currentView = $state('subjects') // 'subjects', 'assessments', 'feedback'
	
	// Force reactivity for debugging
	$effect(() => {
		console.log('Current view changed to:', currentView)
	})
	
	// Function to update view
	function updateView(newView) {
		currentView = newView
	}

	// Breadcrumb navigation handler
	function handleBreadcrumbNavigation(view, subject, assessment) {
		currentView = view
		if (subject) {
			currentSubject = subject
			currentSubjectId = subject.id
		}
		if (assessment) {
			currentAssessment = assessment
			currentAssessmentId = assessment.id
		}
	}

	// Category and topic selection
	let selectedCategory = $state('')
	let selectedTopic = $state('')
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

	// Category selection for Studio 5 PDR assessments
	let studio5Categories = [
		'Sub Objective 1.1',
		'Sub Objective 1.2',
		'Sub Objective 2.1',
		'Sub Objective 3.1',
		'Sub Objective 3.2',
		'Sub Objective 3.3',
		'Report',
		'Decision'
	]

	// Generate unique ID
	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2)
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
			
			paragraphs.push({
				text: paragraphText,
				color: selectedColor
			})
			newParagraph = ''
			saveAssessmentData()
		}
	}

	function addCategory() {
		if (newCategoryName.trim() && currentAssessment) {
			// Ensure categories array exists
			if (!currentAssessment.categories) {
				currentAssessment.categories = []
			}
			
			const newCategory = {
				id: Date.now().toString(),
				name: newCategoryName.trim()
			}
			
			currentAssessment.categories = [...currentAssessment.categories, newCategory]
			newCategoryName = ''
			
			// Update the current subject's assessments
			if (currentSubject) {
				const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
				if (subjectIndex !== -1) {
					const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
					if (assessmentIndex !== -1) {
						subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
						console.log('Saving category to assessment:', newCategory.name, 'Total categories:', currentAssessment.categories.length)
						saveSubjects()
					}
				}
			}
		}
	}

	function removeCategory(categoryId) {
		if (currentAssessment && currentAssessment.categories) {
			const categoryToRemove = currentAssessment.categories.find(cat => cat.id === categoryId)
			currentAssessment.categories = currentAssessment.categories.filter(cat => cat.id !== categoryId)
			
			// Update the current subject's assessments
			if (currentSubject) {
				const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
				if (subjectIndex !== -1) {
					const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
					if (assessmentIndex !== -1) {
						subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
						console.log('Removing category from assessment:', categoryToRemove?.name, 'Remaining categories:', currentAssessment.categories.length)
						saveSubjects()
					}
				}
			}
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

	// Helper function to check if current assessment is Studio 5 PDR
	function isStudio5PDR() {
		const result = currentSubject?.name === "Studio 5" && 
		       (currentAssessment?.name === "Mid-PDR" || currentAssessment?.name === "Final PDR")
		
		// Debug logging
		console.log('isStudio5PDR check:', {
			currentSubject: currentSubject?.name,
			currentAssessment: currentAssessment?.name,
			result: result
		})
		
		return result
	}

	// Helper function to check if current assessment needs category selection
	function needsCategorySelection() {
		return isStudio6PDR() || isStudio4PDR() || isStudio5PDR()
	}

	// Helper function to get the appropriate categories for current assessment
	function getCurrentCategories() {
		if (isStudio6PDR()) {
			return pdrCategories
		} else if (isStudio4PDR()) {
			return studio4Categories
		} else if (isStudio5PDR()) {
			return studio5Categories
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
		// Check for Sub Objective patterns (Studio 6 and Studio 5) and extract numbers
		const subObjectiveMatch = paragraph.match(/^Sub Objective (\d)\.(\d):/i)
		if (subObjectiveMatch) {
			const major = parseInt(subObjectiveMatch[1])
			const minor = parseInt(subObjectiveMatch[2])
			// Create numeric order: 1.1=11, 1.2=12, 2.1=21, 2.2=22, 3.1=31, 3.2=32, 3.3=33
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
			.map((paragraph, originalIndex) => {
				// Handle both string and object formats
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				const paragraphColor = typeof paragraph === 'object' ? paragraph.color : undefined
				return { 
					paragraph: paragraphText, 
					color: paragraphColor,
					originalIndex 
				}
			})
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

	function getColorBadgeClass(color) {
		switch(color) {
			case 'red': return 'bg-danger'
			case 'orange': return 'bg-warning'
			case 'yellow': return 'bg-warning text-dark'
			case 'lightgreen': return 'bg-light text-success border border-success'
			case 'green': return 'bg-success'
			default: return 'bg-secondary'
		}
	}

	function getColorHex(color) {
		switch(color) {
			case 'red': return '#dc3545'
			case 'orange': return '#fd7e14'
			case 'yellow': return '#ffc107'
			case 'lightgreen': return '#ADF527'
			case 'green': return '#198754'
			default: return '#6c757d'
		}
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
			.map(index => {
				const paragraph = paragraphs[index]
				// Handle both string and object formats
				return typeof paragraph === 'string' ? paragraph : paragraph.text
			})
		
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
			'Sub Objective 1.1', 'Sub Objective 1.2', 'Sub Objective 2.1', 'Sub Objective 2.2', 'Sub Objective 3.1', 'Sub Objective 3.2', 'Sub Objective 3.3',
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
					
					// Use full width with margins (not edge to edge)
					let imageWidth = pageWidth - (margin * 2)
					let imageHeight = imageWidth / aspectRatio
					
					// Position with margin from top and sides
					const xPosition = margin
					const yPosition = margin
					
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

<main class="mt-4">
	<div class="container-fluid mb-4">
		<div class="row">
			<!-- Sidebar -->
			<div class="col-lg-3 col-md-4 col-12 mb-4">
				<Sidebar 
					{subjects}
					{currentSubject}
					{currentAssessment}
					{showAddSubject}
					{showAddAssessment}
					{newSubjectName}
					{newAssessmentName}
					{showMobileSidebar}
					onSelectSubject={selectSubject}
					onSelectAssessment={selectAssessment}
					onAddSubject={addSubject}
					onAddAssessment={addAssessment}
					onGoBackToSubjects={goBackToSubjects}
					onGoBackToAssessments={goBackToAssessments}
					onToggleMobileSidebar={() => showMobileSidebar = !showMobileSidebar}
					onToggleShowAddSubject={() => showAddSubject = !showAddSubject}
					onToggleShowAddAssessment={() => showAddAssessment = !showAddAssessment}
				/>
			</div>

			<!-- Main Content -->
			<div class="col-lg-9 col-md-8 col-12 d-flex flex-column">
				<!-- Breadcrumb Navigation -->
				<Breadcrumb 
					{currentView}
						{currentSubject}
						{currentAssessment}
					onNavigate={handleBreadcrumbNavigation}
				/>

				{#if currentView === 'subjects'}
					<div class="row">
						<div class="col-12">
							<div class="d-flex justify-content-between align-items-center mb-4">
								<div>
									<h1 class="display-6 mb-2">Subjects</h1>
									<p class="lead text-muted">Manage your subjects and assessments</p>
			</div>
								<button 
									class="btn btn-primary btn-lg"
									onclick={() => showAddSubject = true}
								>
									<i class="bi bi-plus-circle me-2"></i>Add Subject
								</button>
		</div>
							<SubjectManager 
								{subjects}
								onSelectSubject={(subject) => {
									currentSubject = subject
									currentSubjectId = subject.id
									currentView = 'assessments'
								}}
								onUpdateSubjects={(updatedSubjects) => {
									subjects = updatedSubjects;
									saveSubjects();
								}}
							/>
	</div>
					</div>
				{:else if currentView === 'assessments'}
					<div class="row">
						<div class="col-12">
							<div class="d-flex justify-content-between align-items-center mb-4">
								<div>
									<h1 class="display-6 mb-2">{currentSubject?.name}</h1>
									<p class="lead text-muted">Manage assessments and categories</p>
								</div>
								<div class="btn-group" role="group">
									<button 
										class="btn btn-outline-secondary"
										onclick={() => updateView('subjects')}
									>
										<i class="bi bi-arrow-left me-2"></i>Back to Subjects
									</button>
									<button 
										class="btn btn-primary"
										onclick={() => showAddAssessment = true}
									>
										<i class="bi bi-plus-circle me-2"></i>Add Assessment
									</button>
								</div>
							</div>
							<AssessmentManager 
								assessments={currentSubject?.assessments || []}
								onSelectAssessment={(assessment) => {
									currentAssessment = assessment
									currentAssessmentId = assessment.id
									console.log('Selected assessment:', assessment.name, 'Categories:', assessment.categories?.length || 0, assessment.categories)
									updateView('feedback')
									loadAssessmentData(currentSubjectId, currentAssessmentId)
								}}
								onUpdateAssessments={(updatedAssessments) => {
									if (currentSubject) {
										currentSubject.assessments = updatedAssessments;
										saveSubjects();
									}
								}}
							/>
						</div>
					</div>
				{:else if currentView === 'feedback'}
					<div class="d-flex flex-column">
						<div class="row">
							<div class="col-12">
								<div class="d-flex justify-content-between align-items-center mb-4">
									<div>
										<h1 class="display-6 mb-2">Feedback for {currentAssessment?.name}</h1>
										<p class="lead text-muted">Subject: {currentSubject?.name}</p>
									</div>
									<button 
										class="btn btn-outline-secondary btn-lg"
										onclick={() => updateView('assessments')}
									>
										<i class="bi bi-arrow-left me-2"></i>Back to Assessments
									</button>
								</div>
							</div>
						</div>
					
					
					<!-- Student Info Section -->
					<div class="row mb-2">
						<div class="col-12">
							<div class="card border-info">
								<div class="card-header bg-info text-white py-2">
									<h5 class="card-title mb-0">
										<i class="bi bi-person-circle me-2"></i>Student Information
									</h5>
								</div>
								<div class="card-body py-2">
									<div class="row g-2">
										<div class="col-md-6">
											<label for="studentNameInput" class="form-label fw-bold">Student Name:</label>
											<input 
												id="studentNameInput" 
												type="text" 
												class="form-control form-control-lg" 
												bind:value={studentName} 
												placeholder="Enter student name"
												onchange={saveAssessmentData}
											>
										</div>
										<div class="col-md-6">
											<label for="studentImageInput" class="form-label fw-bold">Student Photo:</label>
											<div class="input-group input-group-lg">
												<input 
													id="studentImageInput" 
													type="file" 
													class="form-control" 
													accept="image/*"
													onchange={handleImageUpload}
												>
												{#if studentImage}
													<span class="input-group-text">
														<img 
															src={studentImage} 
															alt="Student" 
															class="rounded"
															style="width: 40px; height: 40px; object-fit: cover;"
														>
													</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					
					<!-- Add Paragraph Form -->
					<div class="row mb-3">
						<div class="col-12">
							<div class="card border-success">
								<div class="card-header bg-success text-white py-2">
									<h5 class="card-title mb-0">
										<i class="bi bi-plus-circle me-2"></i>Add Paragraph
									</h5>
								</div>
								<div class="card-body">
									<div class="mb-3">
										<label for="paragraphInput" class="form-label fw-bold">New paragraph:</label>
										<div class="input-group input-group-lg">
											<textarea 
												id="paragraphInput" 
												class="form-control" 
												rows="4" 
												bind:value={newParagraph} 
												placeholder="Type your paragraph here..."
											></textarea>
											<button class="btn btn-primary btn-lg" type="button" onclick={addParagraph}>
												<i class="bi bi-plus-circle me-2"></i>Add Paragraph
											</button>
										</div>
									</div>
									
									<!-- Color Selection -->
									<div class="mb-3">
										<label for="colorSelect" class="form-label fw-bold">Paragraph Color:</label>
										<select id="colorSelect" class="form-select" bind:value={selectedColor}>
											<option value="red">🔴 Red</option>
											<option value="orange">🟠 Orange</option>
											<option value="yellow">🟡 Yellow</option>
											<option value="lightgreen">🟢 Light Green</option>
											<option value="green">🟢 Green</option>
										</select>
										<small class="text-muted">Selected: {selectedColor} ({getColorHex(selectedColor)})</small>
									</div>
									
									<!-- Category Management -->
									<div class="mb-3">
										<div class="d-flex justify-content-between align-items-center mb-2">
											<label class="form-label fw-bold mb-0">Categories:</label>
											<small class="text-muted">{currentAssessment?.categories?.length || 0} categories</small>
										</div>
										
										<!-- Add Category Form -->
										<div class="mb-3">
											<div class="input-group">
												<input
													type="text"
													class="form-control"
													placeholder="Enter category name..."
													bind:value={newCategoryName}
													onkeydown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															addCategory();
														}
													}}
												>
												<button 
													class="btn btn-outline-primary"
													onclick={addCategory}
													disabled={!newCategoryName.trim()}
												>
													<i class="bi bi-plus-circle me-1"></i>Add
												</button>
											</div>
										</div>
										
										<!-- Categories List -->
										{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
											<div class="mb-3">
												<div class="row g-2">
													{#each currentAssessment.categories as category}
														<div class="col-md-6">
															<div class="d-flex align-items-center justify-content-between p-2 border rounded">
																<span class="fw-medium">{category.name}</span>
																<button 
																	class="btn btn-sm btn-outline-danger"
																	onclick={() => removeCategory(category.id)}
																	title="Delete category"
																>
																	<i class="bi bi-x"></i>
																</button>
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/if}
										
										<!-- Category Selection -->
										{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
											<div class="mb-3">
												<label for="categorySelect" class="form-label fw-bold">Select Category:</label>
												<select 
													id="categorySelect" 
													class="form-select" 
													bind:value={selectedCategory}
												>
													<option value="">Choose a category...</option>
													{#each currentAssessment.categories as category}
														<option value={category.name}>{category.name}</option>
													{/each}
												</select>
											</div>
										{/if}
									</div>
									
									{#if needsCategorySelection() && !selectedCategory}
										<div class="alert alert-warning d-flex align-items-center mt-3" role="alert">
											<i class="bi bi-exclamation-triangle-fill me-2"></i>
											<strong>Warning:</strong> Please select a category first to properly organize this paragraph.
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<!-- Student Photo Display (if uploaded) -->
					{#if studentImage}
						<div class="row mb-3">
							<div class="col-12">
								<div class="card border-warning">
									<div class="card-header bg-warning text-dark py-2">
										<h5 class="card-title mb-0">
											<i class="bi bi-image me-2"></i>Student Photo
										</h5>
									</div>
									<div class="card-body p-0">
										<div class="text-center">
											<img 
												src={studentImage} 
												alt="Student" 
												class="rounded-bottom"
												style="width: 100%; max-height: 600px; object-fit: contain;"
											>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Display Paragraphs -->
					<div class="row">
						<div class="col-12">
							<div class="card border-secondary">
								<div class="card-header bg-secondary text-white py-2">
									<h5 class="card-title mb-0">
										<i class="bi bi-list-ul me-2"></i>Paragraphs
									</h5>
								</div>
								<div class="card-body p-0">
									{#if paragraphs.length === 0}
										<div class="text-center py-4 px-3">
											<i class="bi bi-journal-text display-1 text-muted mb-3"></i>
											<h5 class="text-muted">No paragraphs added yet</h5>
											<p class="text-muted">Use the form above to add your first paragraph.</p>
										</div>
									{:else}
										<div class="p-3">
											{#each getOrderedParagraphs() as {paragraph, color, originalIndex}}
												<div class="card mb-2 border-start border-primary border-4">
													<div class="card-body py-2">
														<div class="d-flex align-items-start">
															<div class="form-check me-3">
																<input 
																	class="form-check-input form-check-input-lg" 
																	type="checkbox" 
																	id="paragraph-{originalIndex}"
																	checked={selectedParagraphs.has(originalIndex)}
																	onchange={() => toggleParagraph(originalIndex)}
																>
																<label class="form-check-label fw-bold" for="paragraph-{originalIndex}">
																</label>
															</div>
															<!-- Color indicator between checkbox and text -->
															{#if color}
																<div class="me-3 d-flex align-items-center">
																	<div class="color-indicator" style="width: 16px; height: 16px; background-color: {getColorHex(color)}; border-radius: 3px; border: 1px solid #dee2e6;" title="Color: {color} ({getColorHex(color)})"></div>
																</div>
															{/if}
															<div class="flex-grow-1 me-3">
																<p class="mb-0 fs-5 lh-base">{paragraph}</p>
															</div>
															<button 
																class="btn btn-outline-danger btn-sm" 
																onclick={() => deleteParagraph(originalIndex)}
																title="Delete paragraph"
																aria-label="Delete paragraph"
															>
																<i class="bi bi-trash"></i>
															</button>
														</div>
													</div>
												</div>
											{/each}
											
											<!-- Selection Info -->
											{#if selectedParagraphs.size > 0}
												<div class="alert alert-info d-flex align-items-center mt-3 mb-0" role="alert">
													<i class="bi bi-info-circle-fill me-2"></i>
													<div>
														<strong>{selectedParagraphs.size}</strong> paragraph{selectedParagraphs.size !== 1 ? 's' : ''} selected
													</div>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
					</div>
					
				{/if}
			</div>
		</div>
	</div>
</main>

{#if currentView === 'feedback'}
	<SelectedTextSection 
		{currentAssessment}
		{selectedParagraphs}
		onCopyToClipboard={copyToClipboard}
		onGeneratePDF={generatePDF}
		onGetSelectedText={getSelectedText}
	/>
{/if}


<style>
	/* App-specific styles - most styles moved to design-system.css and components.css */
	
	/* Layout */
	:global(main) {
		width: 100%;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}
	
	:global(.col-lg-3, .col-lg-9, .col-md-4, .col-md-8) {
		display: flex;
		flex-direction: column;
		min-height: calc(100vh - 200px);
	}
	
	:global(.col-lg-9 .row) {
		display: flex;
		flex-direction: column;
	}
	
	:global(.col-lg-9 .col-12) {
		display: flex;
		flex-direction: column;
	}
	
	:global(.col-xl-3, .col-lg-4, .col-md-6, .col-sm-12) {
		display: flex;
		align-items: flex-start;
		margin-bottom: 1rem;
	}
	
	/* Content area adjustments */
	:global(.col-lg-3 .p-3.border.bg-light) {
		min-height: calc(100vh - 160px);
		flex: 1;
		display: flex;
		flex-direction: column;
		margin-top: 1rem;
		margin-bottom: 1rem;
	}
	
	/* Ensure full width for content areas */
	:global(.col-lg-9 .content-area),
	:global(.col-md-8 .content-area) {
		width: 100%;
		max-width: none;
	}
	
	:global(.content-area .row) {
		width: 100%;
		margin: 0 calc(-1 * 0.5rem);
		align-items: flex-start;
		display: flex;
		flex-wrap: wrap;
	}
	
	/* Override any app.css constraints */
	:global(#app) {
		width: 100%;
		max-width: none;
		margin: 0;
		padding: 0;
		text-align: left;
	}
	
	/* Box sizing for all elements */
	:global(*) {
		box-sizing: border-box;
	}
</style>