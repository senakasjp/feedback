<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount } from 'svelte'
	import jsPDF from 'jspdf'
	import Sidebar from './lib/Sidebar.svelte'
	import WelcomeScreen from './lib/WelcomeScreen.svelte'
	import SubjectOverview from './lib/SubjectOverview.svelte'
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
	let students = $state([]) // Student management
	let percentageRanges = $state([]) // Percentage ranges for feedback
	let currentSubjectId = $state(null)
	let currentAssessmentId = $state(null)
	let currentSubject = $state(null)
	let currentAssessment = $state(null)
	let currentStudentId = $state(null) // Currently selected student

	// Current assessment data
	let newParagraph = $state('')
	let paragraphs = $state([])
	let selectedParagraphs = $state(new Set())
	let studentName = $state('')
	let studentImage = $state('')
	let selectedColor = $state('red')
	let newCategoryName = $state('')
	let newCategoryKnowledgeArea = $state('')
	let newCategoryAllocatedMarks = $state('')
	let newKnowledgeAreaName = $state('')
	let availableKnowledgeAreas = $state([])
	let categoryMarks = $state({}) // Store marks for each category
	let manualTotalMarks = $state('') // Store manually entered total marks
	let showTotalMarksWarning = $state(false) // Show warning modal
	let categoryWarnings = $state({}) // Store warnings for each category
	let showNotification = $state(false) // Show success notification
	let notificationMessage = $state('') // Notification message

	// UI state
	let showAddSubject = $state(false)
	let showAddAssessment = $state(false)
	let showAddStudent = $state(false)
	let showStudentManager = $state(false)
	let showAddCategoryKnowledgeArea = $state(false)
	let newSubjectName = $state('')
	let newAssessmentName = $state('')
	let newStudentName = $state('')
	let newStudentId = $state('')
	let showMobileSidebar = $state(false)
	let currentView = $state('subjects') // 'subjects', 'assessments', 'feedback'
	
	// Force reactivity for debugging
	$effect(() => {
		console.log('Current view changed to:', currentView)
	})

	// Update student name when currentStudentId changes
	$effect(() => {
		if (currentStudentId) {
			const student = students.find(s => s.id === currentStudentId)
			if (student) {
				studentName = student.displayName
			}
		} else {
			studentName = ''
		}
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
	let selectedKnowledgeArea = $state('')
	
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
				availableKnowledgeAreas = parsed.knowledgeAreas || []
				students = parsed.students || []
				percentageRanges = parsed.percentageRanges || []
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const data = localStorage.getItem('feedback-subjects')
				if (data) {
					const parsed = JSON.parse(data)
					subjects = parsed.subjects || []
					availableKnowledgeAreas = parsed.knowledgeAreas || []
					students = parsed.students || []
					percentageRanges = parsed.percentageRanges || []
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
			}
		}
	}

	async function saveSubjects() {
		const data = { subjects, knowledgeAreas: availableKnowledgeAreas, students, percentageRanges }
		
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
				categoryMarks = parsed.categoryMarks || {}
				manualTotalMarks = parsed.manualTotalMarks || ''
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
			studentImage,
			categoryMarks,
			manualTotalMarks
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
		currentView = 'assessments'
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
		currentView = 'feedback'
		loadAssessmentData(currentSubjectId, currentAssessmentId)
	}

	function goBackToSubjects() {
		currentSubjectId = null
		currentSubject = null
		currentAssessmentId = null
		currentAssessment = null
		currentView = 'subjects'
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		studentImage = ''
	}

	function goBackToAssessments() {
		currentAssessmentId = null
		currentAssessment = null
		currentView = 'assessments'
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
			
			// Add knowledge area prefix if selected
			if (selectedKnowledgeArea) {
				paragraphText = `${paragraphText} - ${selectedKnowledgeArea}`
			}
			
			paragraphs.push({
				text: paragraphText,
				color: selectedColor || undefined
			})
			newParagraph = ''
			selectedKnowledgeArea = '' // Reset knowledge area selection
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
				name: newCategoryName.trim(),
				knowledgeLevel: newCategoryKnowledgeArea.trim() || undefined
			}
			
			currentAssessment.categories = [...currentAssessment.categories, newCategory]
			newCategoryName = ''
			newCategoryKnowledgeArea = ''
			
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

	function addKnowledgeArea() {
		if (newKnowledgeAreaName.trim() && !availableKnowledgeAreas.includes(newKnowledgeAreaName.trim())) {
			availableKnowledgeAreas = [...availableKnowledgeAreas, newKnowledgeAreaName.trim()]
			newKnowledgeAreaName = ''
			saveSubjects()
		}
	}

	function removeKnowledgeArea(knowledgeArea) {
		availableKnowledgeAreas = availableKnowledgeAreas.filter(area => area !== knowledgeArea)
		saveSubjects()
	}

	function checkCategoryHasSelectedParagraphs(category) {
		// Check if any selected paragraphs belong to this category
		for (const selectedIndex of selectedParagraphs) {
			const paragraph = paragraphs[selectedIndex]
			if (paragraph) {
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				
				// Check if paragraph belongs to this category
				if (paragraphText.includes(': ')) {
					const parts = paragraphText.split(': ')
					if (parts.length >= 2 && parts[0].trim() === category) {
						return true
					}
				} else {
					// Check if it's a general feedback paragraph (no category prefix)
					if (category === 'General Feedback') {
						return true
					}
				}
			}
		}
		return false
	}

	function updateCategoryMarks(category, marks) {
		categoryMarks[category] = marks
		categoryMarks = {...categoryMarks} // trigger reactivity
		
		// Check if any paragraphs under this category are selected
		if (marks && marks.trim() !== '') {
			const hasSelectedParagraphs = checkCategoryHasSelectedParagraphs(category)
			categoryWarnings[category] = !hasSelectedParagraphs
			categoryWarnings = {...categoryWarnings} // trigger reactivity
		} else {
			// Clear warning if marks are empty
			categoryWarnings[category] = false
			categoryWarnings = {...categoryWarnings} // trigger reactivity
		}
		
		saveAssessmentData()
	}

	function updateCategoryAllocatedMarks(categoryName, allocatedMarks) {
		if (currentAssessment && currentAssessment.categories) {
			const categoryIndex = currentAssessment.categories.findIndex(cat => cat.name === categoryName)
			if (categoryIndex !== -1) {
				currentAssessment.categories[categoryIndex].allocatedMarks = allocatedMarks ? parseFloat(allocatedMarks) : undefined
				
				// Update the current subject's assessments
				if (currentSubject) {
					const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
					if (subjectIndex !== -1) {
						const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
						if (assessmentIndex !== -1) {
							subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
							saveSubjects()
						}
					}
				}
			}
		}
	}

	function getTotalMarks() {
		return Object.values(categoryMarks).reduce((total, marks) => {
			const numMarks = parseFloat(marks) || 0
			return total + numMarks
		}, 0)
	}

	function updateTotalMarks(totalMarks) {
		manualTotalMarks = totalMarks
		saveAssessmentData()
	}

	// Notification Functions
	function showSuccessNotification(message) {
		notificationMessage = message
		showNotification = true
		setTimeout(() => {
			showNotification = false
		}, 3000) // Auto-hide after 3 seconds
	}

	// Student Management Functions

	async function saveStudents() {
		// Save students to main data file
		const mainData = { subjects, knowledgeAreas: availableKnowledgeAreas, students }
		try {
			await invoke('write_portable', { data: JSON.stringify(mainData) })
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			localStorage.setItem('feedback-subjects', JSON.stringify(mainData))
		}
	}

	function addStudent() {
		if (newStudentName.trim() && newStudentId.trim()) {
			const student = {
				id: generateId(),
				name: newStudentName.trim(),
				studentId: newStudentId.trim(),
				displayName: `${newStudentName.trim()} (${newStudentId.trim()})`,
				createdAt: new Date().toISOString()
			}
			students.push(student)
			saveStudents()
			newStudentName = ''
			newStudentId = ''
			showAddStudent = false
		}
	}

	function deleteStudent(studentId) {
		if (confirm('Are you sure you want to delete this student? This will also delete all their evaluation data.')) {
			students = students.filter(s => s.id !== studentId)
			saveStudents()
			if (currentStudentId === studentId) {
				currentStudentId = null
				studentName = ''
			}
		}
	}

	async function selectStudent(studentId) {
		currentStudentId = studentId
		const student = students.find(s => s.id === studentId)
		if (student) {
			studentName = student.displayName
			// Automatically load student evaluation data if we're on the feedback page
			if (currentView === 'feedback' && currentAssessmentId) {
				await loadStudentEvaluation()
			}
		} else {
			// Clear only student-specific data, keep paragraphs visible
			studentName = ''
			studentImage = ''
			// Don't clear paragraphs, selectedParagraphs, or marks - keep them visible
		}
	}

	function getCurrentStudent() {
		return students.find(s => s.id === currentStudentId)
	}

	// Percentage range management
	function addPercentageRange(value, color, lowerPercentage, upperPercentage) {
		const calculatedLower = (value * lowerPercentage / 100).toFixed(2)
		const calculatedUpper = (value * upperPercentage / 100).toFixed(2)
		
		percentageRanges = [...percentageRanges, {
			id: Date.now().toString(),
			value: value,
			color: color,
			lowerPercentage: lowerPercentage,
			upperPercentage: upperPercentage,
			calculatedLower: parseFloat(calculatedLower),
			calculatedUpper: parseFloat(calculatedUpper)
		}]
		
		saveSubjects()
	}

	function deletePercentageRange(id) {
		percentageRanges = percentageRanges.filter(range => range.id !== id)
		saveSubjects()
	}

	// Sort students alphabetically by display name
	let sortedStudents = $derived(
		[...students].sort((a, b) => a.displayName.localeCompare(b.displayName))
	)

	// Save student evaluation data
	async function saveStudentEvaluation() {
		if (!currentStudentId || !currentAssessmentId) return

		const evaluationData = {
			studentId: currentStudentId,
			assessmentId: currentAssessmentId,
			paragraphs: [...paragraphs],
			selectedParagraphs: [...selectedParagraphs],
			studentName: studentName,
			studentImage: studentImage,
			categoryMarks: { ...categoryMarks },
			manualTotalMarks: manualTotalMarks,
			savedAt: new Date().toISOString()
		}

		try {
			await invoke('write_student_evaluation', { 
				data: JSON.stringify(evaluationData),
				studentId: currentStudentId,
				assessmentId: currentAssessmentId
			})
			showSuccessNotification('Student evaluation data saved successfully!')
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-evaluation-${currentStudentId}-${currentAssessmentId}`
			localStorage.setItem(key, JSON.stringify(evaluationData))
			showSuccessNotification('Student evaluation data saved successfully!')
		}
	}

	// Load student evaluation data
	async function loadStudentEvaluation() {
		if (!currentStudentId || !currentAssessmentId) return

		try {
			const data = await invoke('read_student_evaluation', { 
				studentId: currentStudentId,
				assessmentId: currentAssessmentId
			})
			if (data) {
				const evaluationData = JSON.parse(data)
				paragraphs = evaluationData.paragraphs || []
				selectedParagraphs = new Set(evaluationData.selectedParagraphs || [])
				studentName = evaluationData.studentName || ''
				studentImage = evaluationData.studentImage || ''
				categoryMarks = evaluationData.categoryMarks || {}
				manualTotalMarks = evaluationData.manualTotalMarks || ''
				showSuccessNotification('Student evaluation data loaded successfully!')
			} else {
				showSuccessNotification('No saved data found for this student and assessment.')
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-evaluation-${currentStudentId}-${currentAssessmentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const evaluationData = JSON.parse(data)
				paragraphs = evaluationData.paragraphs || []
				selectedParagraphs = new Set(evaluationData.selectedParagraphs || [])
				studentName = evaluationData.studentName || ''
				studentImage = evaluationData.studentImage || ''
				categoryMarks = evaluationData.categoryMarks || {}
				manualTotalMarks = evaluationData.manualTotalMarks || ''
				showSuccessNotification('Student evaluation data loaded successfully!')
			} else {
				showSuccessNotification('No saved data found for this student and assessment.')
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
		// Return true if current assessment has categories defined
		return currentAssessment?.categories && currentAssessment.categories.length > 0
	}

	// Helper function to get the appropriate categories for current assessment
	function getCurrentCategories() {
		// Use assessment's own categories if available
		if (currentAssessment?.categories && currentAssessment.categories.length > 0) {
			return currentAssessment.categories.map(cat => cat.name)
		}
		
		// Fallback to hardcoded categories for specific PDR assessments
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
		
		// Update warnings for all categories with marks
		Object.keys(categoryMarks).forEach(category => {
			if (categoryMarks[category] && categoryMarks[category].trim() !== '') {
				const hasSelectedParagraphs = checkCategoryHasSelectedParagraphs(category)
				categoryWarnings[category] = !hasSelectedParagraphs
			}
		})
		categoryWarnings = {...categoryWarnings} // trigger reactivity
		
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
		
		// Update warnings for all categories with marks
		Object.keys(categoryMarks).forEach(category => {
			if (categoryMarks[category] && categoryMarks[category].trim() !== '') {
				const hasSelectedParagraphs = checkCategoryHasSelectedParagraphs(category)
				categoryWarnings[category] = !hasSelectedParagraphs
			}
		})
		categoryWarnings = {...categoryWarnings} // trigger reactivity
		
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
					color: paragraphColor || undefined,
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
			case '': return 'bg-light text-muted border'
			default: return 'bg-secondary'
		}
	}

	function getColorHex(color) {
		switch(color) {
			case 'red': return '#dc3545'
			case 'orange': return '#fd7e14'
			case 'yellow': return '#ffc107'
			case 'lightgreen': return '#90EE90'
			case 'green': return '#198754'
			default: return '#6c757d'
		}
	}

	function cleanParagraphTextForDisplay(text) {
		// Remove knowledge area suffix (format: "text - Knowledge Area")
		if (text.includes(' - ')) {
			const parts = text.split(' - ')
			if (parts.length >= 2) {
				// Check if the last part looks like a knowledge area (not a category)
				// Categories have format "Category: text", knowledge areas are just "Knowledge Area"
				const lastPart = parts[parts.length - 1]
				if (!lastPart.includes(':')) {
					return parts.slice(0, -1).join(' - ')
				}
			}
		}
		return text
	}

	function extractKnowledgeArea(text) {
		// Extract knowledge area from paragraph text (format: "text - Knowledge Area")
		if (text.includes(' - ')) {
			const parts = text.split(' - ')
			if (parts.length >= 2) {
				// Check if the last part looks like a knowledge area (not a category)
				const lastPart = parts[parts.length - 1]
				if (!lastPart.includes(':')) {
					return lastPart
				}
			}
		}
		return null
	}

	function getGroupedParagraphs() {
		const ordered = getOrderedParagraphs()
		const grouped = {}
		
		ordered.forEach(({paragraph, color, originalIndex}) => {
			// Extract category and knowledge area from paragraph text
			let category = ''
			let knowledgeArea = ''
			let cleanText = paragraph
			
			// Check if paragraph has category prefix (format: "Category: text")
			if (paragraph.includes(': ')) {
				const parts = paragraph.split(': ')
				if (parts.length >= 2) {
					const firstPart = parts[0]
					const remainingText = parts.slice(1).join(': ')
					
					// Check if first part has "KnowledgeArea - Category" format (old format)
					if (firstPart.includes(' - ')) {
						const oldParts = firstPart.split(' - ')
						if (oldParts.length >= 2) {
							knowledgeArea = oldParts[0].trim()
							category = oldParts[1].trim()
							cleanText = remainingText
						}
					} else {
						// New format: "Category: text"
						category = firstPart
					// Check if remaining text has knowledge area prefix
					knowledgeArea = extractKnowledgeArea(remainingText)
					if (knowledgeArea) {
						cleanText = cleanParagraphTextForDisplay(remainingText)
					} else {
						cleanText = remainingText
						}
					}
				}
			} else {
				// Check if paragraph has only knowledge area prefix (format: "text - KnowledgeArea")
				knowledgeArea = extractKnowledgeArea(paragraph)
				if (knowledgeArea) {
					cleanText = cleanParagraphTextForDisplay(paragraph)
				}
			}
			
			// Create group key - group by category only, knowledge areas will be sub-groups
			const finalCategory = category || 'General Feedback'
			const groupKey = finalCategory
			
			if (!grouped[groupKey]) {
				grouped[groupKey] = {
					category: finalCategory,
					knowledgeAreas: {}
				}
			}
			
			// Add to knowledge area sub-group
			const knowledgeAreaKey = knowledgeArea || 'No Knowledge Area'
			if (!grouped[groupKey].knowledgeAreas[knowledgeAreaKey]) {
				grouped[groupKey].knowledgeAreas[knowledgeAreaKey] = []
			}
			
			grouped[groupKey].knowledgeAreas[knowledgeAreaKey].push({
				text: cleanText,
				color,
				originalIndex,
				fullText: paragraph // Keep original for PDF
			})
		})
		
		return Object.values(grouped)
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
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				// Clean the text for PDF (remove knowledge area prefix)
				return cleanParagraphTextForDisplay(paragraphText)
			})
		
		// Group paragraphs by category only (not by knowledge area)
		const groupedSections = {}
		selectedOrderedParagraphs.forEach(paragraph => {
			// Extract category from paragraph text
			let category = 'Other'
			let content = paragraph
			
			// Check if paragraph has category prefix (format: "Category: text")
			if (paragraph.includes(': ')) {
				const parts = paragraph.split(': ')
				if (parts.length >= 2) {
					category = parts[0]
					content = parts.slice(1).join(': ')
				}
			}
			
			if (!groupedSections[category]) {
				groupedSections[category] = []
			}
			groupedSections[category].push(content)
		})
		
		// Format output with category headers - use all categories dynamically
		const allCategories = Object.keys(groupedSections)
		
		// Define preferred order for known categories, but include all categories
		const preferredOrder = [
			'Sub Objective 1.1', 'Sub Objective 1.2', 'Sub Objective 2.1', 'Sub Objective 2.2', 'Sub Objective 3.1', 'Sub Objective 3.2', 'Sub Objective 3.3',
			'Sub Learning Objective 1.1', 'Sub Learning Objective 1.2', 'Sub Learning Objective 2.1', 'Sub Learning Objective 2.2',
			'Report', 'Decision'
		]
		
		// Create final order: preferred categories first, then any others
		const sectionOrder = []
		preferredOrder.forEach(category => {
			if (allCategories.includes(category)) {
				sectionOrder.push(category)
			}
		})
		allCategories.forEach(category => {
			if (!preferredOrder.includes(category)) {
				sectionOrder.push(category)
			}
		})
		const result = []
		
		sectionOrder.forEach(section => {
			if (groupedSections[section]) {
				// Add marks information to category header
				const categoryMarksValue = categoryMarks[section] || 0
				const marksText = categoryMarksValue > 0 ? ` [${categoryMarksValue} MARKS]` : ''
				result.push(`${section}: ${marksText}`)
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
			.then(() => showSuccessNotification('Copied to clipboard!'))
			.catch(() => showSuccessNotification('Failed to copy to clipboard'))
	}

	function generatePDF() {
		const selectedText = getSelectedText()
		if (!selectedText) {
			showSuccessNotification('No paragraphs selected!')
			return
		}

		// Check for marks warning: category marks > 0 but total marks is 0 or empty
		const calculatedTotal = getTotalMarks()
		if (calculatedTotal > 0 && (!manualTotalMarks || manualTotalMarks === '0' || manualTotalMarks === '')) {
			showTotalMarksWarning = true
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
		
		// Add total marks in red color
		const totalMarks = getTotalMarks()
		if (totalMarks > 0) {
			doc.setTextColor(255, 0, 0) // Red color
			doc.setFontSize(10) // Same font size as name and subject
			const manualTotal = manualTotalMarks ? `/${manualTotalMarks}` : ''
			doc.text(`Total Marks: ${totalMarks}${manualTotal}`, margin, yPosition)
			doc.setTextColor(0, 0, 0) // Reset to black
			yPosition += 8
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
			
			// Check if this line is a category header (contains ':' and optionally marks)
			if (line.includes(':')) {
				// Extract category name (everything before the colon)
				const categoryName = line.split(':')[0].trim()
				
				// Get marks for this category
				const categoryMarksValue = categoryMarks[categoryName] || 0
				const marksText = categoryMarksValue > 0 ? ` [${categoryMarksValue} MARKS]` : ''
				
				// Bold font for category headers and marks
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(10) // Same size as other content
				
				// Draw category name and marks (both will be bold)
				doc.text(`${categoryName}: ${marksText}`, margin, yPosition)
				
				// Reset font to normal for content
				doc.setFont('helvetica', 'normal')
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
		showSuccessNotification('PDF generated and downloaded successfully!')
		
		// Auto-save student evaluation data when generating PDF
		if (currentStudentId) {
			saveStudentEvaluation()
		}
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
					{currentView}
					{showAddSubject}
					{showAddAssessment}
					{newSubjectName}
					{newAssessmentName}
					{showMobileSidebar}
					{percentageRanges}
					onSelectSubject={selectSubject}
					onSelectAssessment={selectAssessment}
					onAddSubject={addSubject}
					onAddAssessment={addAssessment}
					onGoBackToSubjects={goBackToSubjects}
					onGoBackToAssessments={goBackToAssessments}
					onToggleMobileSidebar={() => showMobileSidebar = !showMobileSidebar}
					onToggleShowAddSubject={() => showAddSubject = !showAddSubject}
					onToggleShowAddAssessment={() => showAddAssessment = !showAddAssessment}
					onCopyToClipboard={copyToClipboard}
					onGeneratePDF={generatePDF}
					onSaveStudentEvaluation={saveStudentEvaluation}
					onLoadStudentEvaluation={loadStudentEvaluation}
					onAddPercentageRange={addPercentageRange}
					onDeletePercentageRange={deletePercentageRange}
					currentStudentId={currentStudentId}
					{studentName}
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
								showAddSubject={showAddSubject}
								newSubjectName={newSubjectName}
								onAddSubject={addSubject}
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
								showAddAssessment={showAddAssessment}
								newAssessmentName={newAssessmentName}
								onAddAssessment={addAssessment}
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
									<div class="row g-3">
										<div class="col-12">
											<label for="studentSelect" class="form-label fw-bold">Student:</label>
											<div class="d-flex gap-2">
												<select 
													id="studentSelect" 
													class="form-select flex-grow-1" 
													bind:value={currentStudentId}
													onchange={async (e) => await selectStudent(e.currentTarget.value)}
												>
													<option value="">Select a student...</option>
													{#each sortedStudents as student}
														<option value={student.id}>{student.displayName}</option>
													{/each}
												</select>
												<button 
													class="btn btn-outline-primary" 
													type="button"
													onclick={() => showAddStudent = true}
													title="Add new student"
												>
													<i class="bi bi-person-plus"></i>
												</button>
												<button 
													class="btn btn-outline-secondary" 
													type="button"
													onclick={() => showStudentManager = true}
													title="Manage students"
												>
													<i class="bi bi-gear"></i>
												</button>
											</div>
											{#if currentStudentId}
												<div class="mt-2">
													<div class="alert alert-info py-2 mb-0">
														<i class="bi bi-person-check me-2"></i>
														<strong>Selected Student:</strong> {studentName || 'Loading...'}
													</div>
												</div>
											{/if}
										</div>
										<div class="col-12">
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
											<option value="">⚪ No Color</option>
											<option value="red">🔴 Red</option>
											<option value="orange">🟠 Orange</option>
											<option value="yellow">🟡 Yellow</option>
											<option value="lightgreen">🟢 Light Green</option>
											<option value="green">🟢 Green</option>
										</select>
										<small class="text-muted">Selected: {selectedColor || 'No Color'} ({selectedColor ? getColorHex(selectedColor) : 'None'})</small>
									</div>
									
									<!-- Knowledge Area Management -->
									<div class="mb-3">
										<div class="d-flex justify-content-between align-items-center mb-2">
											<label class="form-label fw-bold mb-0">Knowledge Areas:</label>
											<div class="d-flex align-items-center gap-2">
												<small class="text-muted">{availableKnowledgeAreas.length} areas</small>
												<button 
													class="btn btn-outline-secondary btn-sm"
													onclick={() => showAddCategoryKnowledgeArea = !showAddCategoryKnowledgeArea}
												>
													<i class="bi bi-plus-circle me-1"></i>Add Category or Knowledge Area
												</button>
											</div>
										</div>
										
										{#if showAddCategoryKnowledgeArea}
											<!-- Add Knowledge Area Form -->
											<div class="mb-3">
												<label for="knowledgeAreaName" class="form-label">Knowledge Area Name:</label>
												<div class="input-group">
													<input
														id="knowledgeAreaName"
														type="text"
														class="form-control"
														placeholder="Enter knowledge area name..."
														bind:value={newKnowledgeAreaName}
														onkeydown={(e) => {
															if (e.key === 'Enter') {
																e.preventDefault();
																addKnowledgeArea();
															}
														}}
													>
													<button 
														class="btn btn-outline-success"
														onclick={addKnowledgeArea}
														disabled={!newKnowledgeAreaName.trim()}
													>
														<i class="bi bi-plus-circle me-1"></i>Add
													</button>
												</div>
											</div>
										{/if}
										
										<!-- Knowledge Areas List - Compact Horizontal -->
										{#if availableKnowledgeAreas.length > 0}
											<div class="mb-2">
												<div class="d-flex flex-wrap gap-1">
													{#each availableKnowledgeAreas as area}
														<div class="d-flex align-items-center bg-light border rounded px-1 py-0" style="font-size: 0.6rem;">
															<span class="text-muted me-1">{area}</span>
																<button 
																class="btn btn-sm p-0 border-0 text-danger" 
																style="font-size: 0.5rem; line-height: 0.8; padding: 0.05rem 0.1rem;"
																	onclick={() => removeKnowledgeArea(area)}
																	title="Delete knowledge area"
																>
																×
																</button>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									</div>

									<!-- Category Management -->
									<div class="mb-3">
										<div class="d-flex justify-content-between align-items-center mb-2">
											<label class="form-label fw-bold mb-0">Categories:</label>
											<small class="text-muted">{currentAssessment?.categories?.length || 0} categories</small>
										</div>
										
										{#if showAddCategoryKnowledgeArea}
											<!-- Add Category Form -->
											<div class="mb-3">
												<div class="input-group">
													<input
														id="categoryName"
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
										{/if}
										
										<!-- Categories List - Compact Horizontal -->
										{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
											<div class="mb-2">
												<div class="d-flex flex-wrap gap-1">
													{#each currentAssessment.categories as category}
														<div class="d-flex align-items-center bg-light border rounded px-1 py-0" style="font-size: 0.6rem;">
															<span class="text-muted me-1">
																{category.name}
																{#if category.allocatedMarks}
																	<span class="text-primary fw-bold">({category.allocatedMarks})</span>
																{/if}
															</span>
																	<button 
																class="btn btn-sm p-0 border-0 text-danger" 
																style="font-size: 0.5rem; line-height: 0.8; padding: 0.05rem 0.1rem;"
																		onclick={() => removeCategory(category.id)}
																		title="Delete category"
																	>
																×
																	</button>
														</div>
													{/each}
												</div>
											</div>
										{/if}
										
										<!-- Category and Knowledge Area Selection -->
										{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
											<div class="mb-3">
												<div class="row g-2">
													<div class="col-12">
														<label for="knowledgeAreaSelect" class="form-label fw-bold">Select Knowledge Area:</label>
														<select 
															id="knowledgeAreaSelect" 
															class="form-select" 
															bind:value={selectedKnowledgeArea}
														>
															<option value="">Choose a knowledge area...</option>
															{#each availableKnowledgeAreas as area}
																<option value={area}>{area}</option>
															{/each}
														</select>
													</div>
													<div class="col-12">
														<div class="d-flex align-items-end gap-3">
															<div class="flex-grow-1">
																<label for="categorySelect" class="form-label fw-bold mb-1">Select Category:</label>
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
																{#if selectedKnowledgeArea}
																	<small class="text-muted">
																		<i class="bi bi-info-circle me-1"></i>
																		Selected: {selectedKnowledgeArea}
																	</small>
																{/if}
															</div>
															<div class="flex-shrink-0">
																<label for="allocatedMarksInput" class="form-label fw-bold mb-1">Allocated Marks:</label>
																<input 
																	type="number" 
																	id="allocatedMarksInput" 
																	class="form-control" 
																	placeholder="Marks"
																	min="0"
																	step="0.5"
																	style="width: 80px;"
																	value={currentAssessment.categories.find(cat => cat.name === selectedCategory)?.allocatedMarks || ''}
																	oninput={(e) => updateCategoryAllocatedMarks(selectedCategory, e.currentTarget.value)}
																>
															</div>
														</div>
													</div>
												</div>
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
									<div class="d-flex align-items-center w-100">
										<div class="flex-grow-1">
									<h5 class="card-title mb-0">
										<i class="bi bi-list-ul me-2"></i>Paragraphs
									</h5>
										</div>
										<div class="d-flex align-items-center gap-2">
											<label for="total-marks-input" class="form-label text-white mb-0 fw-bold" style="color: white !important; font-weight: bold !important;">Total Marks:</label>
											<input
												type="number"
												class="form-control form-control-sm"
												id="total-marks-input"
												style="width: 80px;"
												placeholder="0"
												value={manualTotalMarks || ''}
												oninput={(e) => updateTotalMarks(e.currentTarget.value)}
												min="0"
												step="0.5"
											>
										</div>
									</div>
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
											{#each getGroupedParagraphs() as group}
												<div class="card mb-3 border-start border-info border-4">
													<div class="card-header bg-info text-white py-2">
														<div class="d-flex align-items-center w-100">
															<div class="flex-grow-1">
																<h6 class="mb-0 fw-bold">
																	{#if group.category && group.category !== 'No Knowledge Area'}
																		{group.category}
																	{/if}
																</h6>
															</div>
															{#if group.category}
																<div class="d-flex align-items-center gap-2">
																	<input 
																		type="number" 
																		class="form-control form-control-sm" 
																		id="marks-{group.category}"
																		style="width: 80px;"
																		placeholder="0"
																		value={categoryMarks[group.category] || ''}
																		oninput={(e) => updateCategoryMarks(group.category, e.currentTarget.value)}
																		min="0"
																		step="0.5"
																	>
																	{#if currentAssessment.categories.find(cat => cat.name === group.category)?.allocatedMarks}
																		<span class="text-white fw-bold" style="font-size: 0.9rem;">
																			{currentAssessment.categories.find(cat => cat.name === group.category).allocatedMarks}
																		</span>
																	{/if}
																</div>
															{/if}
														</div>
													</div>
													{#if categoryWarnings[group.category]}
														<div class="alert alert-warning alert-sm m-0 rounded-0 border-0" style="border-top: 1px solid #ffc107 !important;">
															<div class="d-flex align-items-center">
																<i class="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
																<small class="mb-0 fw-bold">
																	Warning: No paragraphs selected for this category. Marks entered will not be included in the final report.
																</small>
															</div>
														</div>
													{/if}
													<div class="card-body p-0">
														{#each Object.entries(group.knowledgeAreas) as [knowledgeArea, paragraphs]}
															{#if knowledgeArea !== 'No Knowledge Area'}
																<div class="bg-light border-bottom px-3 py-2">
																	<small class="text-muted fw-bold">
																		<i class="bi bi-bookmark me-1"></i>{knowledgeArea}
																	</small>
																</div>
															{/if}
															{#each paragraphs as {text, color, originalIndex, fullText}}
																<div class="border-bottom p-3 {originalIndex === paragraphs[paragraphs.length - 1].originalIndex ? '' : 'border-bottom'}">
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
																		{:else}
																			<div class="me-3 d-flex align-items-center">
																				<div class="color-indicator" style="width: 16px; height: 16px; background-color: #f8f9fa; border-radius: 3px; border: 1px solid #dee2e6;" title="No Color"></div>
																			</div>
																		{/if}
																		<div class="flex-grow-1 me-3">
																			<p class="mb-0 fs-5 lh-base">{text}</p>
																		</div>
																		<div class="d-flex gap-1">
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
														{/each}
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

{#if currentView === 'feedback' && selectedParagraphs.size > 0}
	<div class="container-fluid mt-4 mb-4">
		<div class="row">
			<div class="col-12">
				<div class="card">
					<div class="card-header bg-primary text-white">
						<h5 class="mb-0">
							<i class="bi bi-check-square me-2"></i>Selected Paragraphs for {currentAssessment?.name}
						</h5>
					</div>
					<div class="card-body">
						{#if getTotalMarks() > 0}
							<div class="alert alert-danger mb-3" role="alert">
								<i class="bi bi-trophy me-2"></i>
								<strong>Total Marks: {getTotalMarks()}</strong>
							</div>
						{/if}
						<textarea 
							class="form-control" 
							rows="10" 
							readonly 
							value={getSelectedText()}
							style="font-family: 'Roboto', system-ui, sans-serif; font-size: 13px; line-height: 1.3;"
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
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
					<p class="mb-0">Please enter the total marks in the "Total Marks" field to ensure proper PDF generation with the slash format (e.g., "Total Marks: {getTotalMarks()}/100").</p>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-warning" onclick={() => showTotalMarksWarning = false}>
						<i class="bi bi-check-circle me-2"></i>I Understand
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
					<div class="mb-3">
						<label for="newStudentName" class="form-label fw-bold">Student Name:</label>
						<input 
							id="newStudentName"
							type="text" 
							class="form-control" 
							bind:value={newStudentName}
							placeholder="Enter student name"
						>
					</div>
					<div class="mb-3">
						<label for="newStudentId" class="form-label fw-bold">Student ID:</label>
						<input 
							id="newStudentId"
							type="text" 
							class="form-control" 
							bind:value={newStudentId}
							placeholder="Enter student ID"
						>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => showAddStudent = false}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-primary" onclick={addStudent}>
						<i class="bi bi-person-plus me-2"></i>Add Student
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Student Manager Modal -->
{#if showStudentManager}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-lg modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-primary text-white">
					<h5 class="modal-title">
						<i class="bi bi-people me-2"></i>Student Management
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => showStudentManager = false}></button>
				</div>
				<div class="modal-body">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h6 class="mb-0">Registered Students ({students.length})</h6>
						<button class="btn btn-primary btn-sm" onclick={() => { showStudentManager = false; showAddStudent = true; }}>
							<i class="bi bi-person-plus me-1"></i>Add Student
						</button>
					</div>
					
					{#if students.length === 0}
						<div class="text-center py-4">
							<i class="bi bi-people text-muted" style="font-size: 3rem;"></i>
							<p class="text-muted mt-2">No students registered yet.</p>
							<button class="btn btn-primary" onclick={() => { showStudentManager = false; showAddStudent = true; }}>
								<i class="bi bi-person-plus me-2"></i>Add First Student
							</button>
						</div>
					{:else}
						<div class="list-group">
							{#each sortedStudents as student}
								<div class="list-group-item d-flex justify-content-between align-items-center">
									<div>
										<h6 class="mb-1">{student.name}</h6>
										<small class="text-muted">ID: {student.studentId}</small>
									</div>
									<div class="btn-group" role="group">
										<button 
											class="btn btn-outline-primary btn-sm"
											onclick={async () => { await selectStudent(student.id); showStudentManager = false; }}
											title="Select this student"
										>
											<i class="bi bi-check-circle"></i>
										</button>
										<button 
											class="btn btn-outline-danger btn-sm"
											onclick={() => deleteStudent(student.id)}
											title="Delete this student"
										>
											<i class="bi bi-trash"></i>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => showStudentManager = false}>
						<i class="bi bi-x-circle me-2"></i>Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Success Notification Toast -->
{#if showNotification}
	<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;">
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