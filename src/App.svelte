<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount } from 'svelte'
	import jsPDF from 'jspdf'
	import html2canvas from 'html2canvas'
	import Sidebar from './lib/Sidebar.svelte'
	import WelcomeScreen from './lib/WelcomeScreen.svelte'
	import SubjectOverview from './lib/SubjectOverview.svelte'
	import SubjectManager from './lib/SubjectManager.svelte'
	import AssessmentManager from './lib/AssessmentManager.svelte'
	import Breadcrumb from './lib/Breadcrumb.svelte'
	import RichTextEditor from './lib/RichTextEditor.svelte'
	import StudentTransferModal from './lib/StudentTransferModal.svelte'
	import ImportParagraphsModal from './lib/ImportParagraphsModal.svelte'
	import AssignmentExportModal from './lib/AssignmentExportModal.svelte'
	import AboutModal from './lib/AboutModal.svelte'
	
	// Import utility functions
	import { getColorBadgeClass, getColorHex, cleanParagraphTextForDisplay, extractKnowledgeArea, getSectionOrder, generateId, ensureParagraphsHaveIds, ensureCategoriesHaveOrder, extractMainTextFromParagraph, reconstructParagraphText, stripHtmlTags } from './utils/helpers.js'
	import { getMotivationalMessage } from './utils/motivationalMessages.js'
	
	// Import data services
	import { studentsService } from './services/dataService.js'
	import { buildImproveEnglishPromptPreview, improveEnglish, isOpenAIConfigured } from './services/openaiService.js'
	import { buildAssessmentVectorIndex, buildImproveFeedbackWithRagPromptPreview, generateEvidenceCheckReport, generateStructuredMarkingDraft, findCriterionByName, improveFeedbackWithRag, isAssessmentVectorIndexCurrent } from './services/aiMarkingService.js'
	import { createUploadedDocumentRecord, extractTextFromFile, getSupportedUploadLabel } from './services/documentTextExtractor.js'
	
	// Import constants
	import { PDR_CATEGORIES, STUDIO4_CATEGORIES, STUDIO5_CATEGORIES } from './utils/constants.js'
	
	// Import CSS
	import './styles/reset.css'
	import './styles/design-system.css'
	import './styles/fixed-components.css'
	import './styles/subject-manager.css'
	import './styles/assessment-manager.css'
	import './styles/dark-mode.css'

	const NAVIGATION_STATE_KEY = 'feedback-navigation-state-v1'
	const TABLE_HTML_SPACER_SNIPPET = '<div style="margin-top: 20px;"></div>'

	const ASSESSMENT_DOCUMENT_TYPES = [
		{ value: 'assignment-brief', label: 'Assignment Brief' },
		{ value: 'rubric-support', label: 'Rubric Support' },
		{ value: 'model-answer', label: 'Model Answer' },
		{ value: 'exemplar-high', label: 'Strong Exemplar' },
		{ value: 'exemplar-mid', label: 'Medium Exemplar' },
		{ value: 'exemplar-low', label: 'Weak Exemplar' },
		{ value: 'sample-feedback', label: 'Sample Feedback' },
		{ value: 'moderation', label: 'Moderation Note' },
		{ value: 'course-note', label: 'Course Note' }
	]

	const STUDENT_DOCUMENT_TYPES = [
		{ value: 'submission', label: 'Submission' },
		{ value: 'report', label: 'Report' },
		{ value: 'appendix', label: 'Appendix' },
		{ value: 'evidence', label: 'Evidence' }
	]

	// Data structure for hierarchical subjects/assessments
	let subjects = $state([])
	let students = $state([]) // Student management
	let percentageRanges = $state([]) // Percentage ranges for feedback
	let globalAiSystemInstructions = $state('')
	let currentSubjectId = $state(null)
	let currentAssessmentId = $state(null)
	let currentSubject = $state(null)
	
	let currentAssessment = $state(null)
	let currentStudentId = $state(null) // Currently selected student
	let showStudentPicker = $state(false)
	let studentPickerSearch = $state('')
	let studentPickerContainer = $state(null)

	// Current assessment data
	let newParagraph = $state('')
	let paragraphs = $state([])
	let selectedParagraphs = $state(new Set())
	let studentName = $state('')
	let studentPhoto = $state('')
	// No studentImage - only header photo for assessment
	let selectedColor = $state('')
	let selectedColorMark = $state('') // Mark for the selected color (fixed mode)
	let currentCategoryMarkingMode = $state('none')
	let lastColorSelectionSignature = ''
	let newCategoryName = $state('')
	let newCategoryKnowledgeArea = $state('')
	let newCategoryMarkingMode = $state('none')
	let newCategoryAllocatedMarks = $state('')
	let newKnowledgeAreaName = $state('')
	// Note: knowledgeAreas are now stored as assignment properties (currentAssessment.knowledgeAreas)
	let categoryMarks = $state({}) // Store marks for each category
	let manualTotalMarks = $state('') // Store manually entered total marks
	let assessmentHtml = $state('') // Custom HTML snippet stored on the assessment
	let showAssessmentHtml = $state(false)
	let showTotalMarksWarning = $state(false) // Show warning modal
	let categoryWarnings = $state({}) // Store per-category warning state (missing paragraphs/marks)
	let showNotification = $state(false) // Show success notification
	let notificationMessage = $state('') // Notification message
	let notificationVariant = $state('success') // success | danger
	let deletingStudentId = $state(null) // Track which student is being deleted
	let showStudentTransferModal = $state(false) // Show student transfer modal
	let showImportModal = $state(false) // Show import paragraphs modal
	let showExportModal = $state(false) // Show export assignment settings modal
	let tableRowCategoryMap = $state({}) // Manual mapping: table row label -> category name
	let tableColumnMarkMap = $state({}) // Manual mapping: column index -> mark value (for rubric highlighting)
	let quickAddKnowledgeArea = $state({}) // Store quick-add knowledge area selection per category
	let quickAddText = $state({}) // Store quick-add paragraph text per category
	let quickAddAiInstructions = $state({}) // Store per-answer AI instructions per category
	let quickAddInstructionAssessmentKey = $state('')
	let quickAddInstructionExpanded = $state({})
	const quickAddInstructionSaveTimers = {}
	let quickAddColorPicker = $state({})
	let quickAddToAssessmentWhenStudentSelected = $state(false) // Override to save quick-add to assessment even when a student is selected
	let showAboutModal = $state(false) // Show about modal
	let improvingText = $state({}) // Track which category text is being improved by AI
	let improvingTextWithRag = $state({}) // Track which category text is being expanded with RAG
	let evidenceCheckingText = $state({}) // Track which category is running evidence check
	let aiImprovedText = $state({}) // Track which category text was AI-improved (for styling)
	let studentSubmissionText = $state('') // Per-student submission or evidence text for AI marking
	let studentSubmissionDocuments = $state([])
	let assessmentReferenceDocuments = $state([])
	let selectedAssessmentDocumentType = $state('assignment-brief')
	let selectedStudentDocumentType = $state('submission')
	let uploadingAssessmentDocument = $state(false)
	let uploadingStudentDocument = $state(false)
	let aiDraftingFeedback = $state(false)
	let aiDraftOverallFeedback = $state('')
	let aiDraftRetrievedContext = $state([])
	let assessmentVectorIndex = $state(null)
	let buildingAssessmentVectorIndex = $state(false)
	let aiRetrievalMode = $state('')
	let showAiDraftReviewModal = $state(false)
	let aiDraftReviewItems = $state([])
	let showPromptPreviewModal = $state(false)
	let promptPreviewTitle = $state('')
	let promptPreviewMessages = $state([])
	let activeFeedbackTab = $state('enter-data')
	let lastStudentEffectAssessmentId = $state(null)
	let lastStudentEffectStudentId = $state(null)
	
	// Visual debug for checkbox issue
	let showCheckboxDebug = $state(false)
	let checkboxDebugInfo = $state([])
	
	// Function to add debug messages
	function addCheckboxDebug(message) {
		checkboxDebugInfo = [...checkboxDebugInfo, `${new Date().toLocaleTimeString()}: ${message}`]
		console.log('🔍 DEBUG:', message)
	}
	
	// Debug function to test selection state
	function debugSelectionState() {
		console.log('🔍 DEBUG Selection State:', {
			selectedParagraphs: Array.from(selectedParagraphs),
			selectedCount: selectedParagraphs.size,
			totalParagraphs: paragraphs.length,
			paragraphIds: paragraphs.map(p => p.id),
			selectedTextResult: getSelectedText(),
			selectedTextLength: getSelectedText().length
		})
		
		// Debug paragraph order
		console.log('🔍 DEBUG Paragraph Order:')
		paragraphs.forEach((para, index) => {
			const isSelected = selectedParagraphs.has(para.id)
			const text = typeof para === 'string' ? para : para.text
			console.log(`${index}: [${isSelected ? 'SELECTED' : 'NOT SELECTED'}] ID: ${para.id}, Text: "${text?.substring(0, 50)}..."`)
		})
		
		console.log('🔍 DEBUG Visual Order from getGroupedParagraphs:')
		const grouped = getGroupedParagraphs()
		grouped.forEach((group, groupIndex) => {
			console.log(`Group ${groupIndex}: ${group.category}`)
			Object.keys(group.knowledgeAreas).forEach(knowledgeArea => {
				const paragraphsInArea = group.knowledgeAreas[knowledgeArea]
				paragraphsInArea.forEach((paraObj, paraIndex) => {
					const isSelected = selectedParagraphs.has(paraObj.id)
					console.log(`  ${groupIndex}.${paraIndex}: [${isSelected ? 'SELECTED' : 'NOT SELECTED'}] ID: ${paraObj.id}, Text: "${paraObj.fullText?.substring(0, 50)}..."`)
				})
			})
		})
		
		// Test if selectedParagraphs Set is working
		console.log('🔍 Testing Set operations:')
		paragraphs.forEach((para, index) => {
			const isSelected = selectedParagraphs.has(para.id)
			console.log(`  Paragraph ${index} (${para.id}): ${isSelected ? 'SELECTED' : 'not selected'}`)
		})
		
		// Test direct paragraph lookup
		console.log('🔍 Testing paragraph lookup:')
		Array.from(selectedParagraphs).forEach(paraId => {
			const para = paragraphs.find(p => p.id === paraId)
			console.log(`  Selected ID ${paraId}: ${para ? 'FOUND' : 'NOT FOUND'}`, para?.text?.substring(0, 50))
		})
	}

	// Function to check for duplicate IDs
	function checkForDuplicateIds() {
		const allIds = paragraphs.map(p => p.id)
		const uniqueIds = [...new Set(allIds)]
		const duplicateIds = allIds.filter((id, index, arr) => arr.indexOf(id) !== index)
		
		console.log('🔍 ID Check:', {
			totalParagraphs: paragraphs.length,
			uniqueIds: uniqueIds.length,
			duplicateIds: duplicateIds.length,
			duplicateIdsList: [...new Set(duplicateIds)]
		})
		
		if (duplicateIds.length > 0) {
			addCheckboxDebug(`⚠️ Found ${duplicateIds.length} duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`)
			return true
		} else {
			addCheckboxDebug(`✅ All ${paragraphs.length} IDs are unique`)
			return false
		}
	}

	// Function to regenerate unique IDs for all paragraphs
	function regenerateParagraphIds() {
		addCheckboxDebug(`🔄 Regenerating IDs for ${paragraphs.length} paragraphs`)
		
		const beforeIds = paragraphs.map(p => p.id)
		const duplicateIds = beforeIds.filter((id, index, arr) => arr.indexOf(id) !== index)
		
		if (duplicateIds.length > 0) {
			addCheckboxDebug(`⚠️ Found ${duplicateIds.length} duplicate IDs before regeneration`)
			console.log('🔧 Duplicate IDs found:', [...new Set(duplicateIds)])
		}
		
		// Store current selections before regeneration
		const currentSelections = Array.from(selectedParagraphs)
		
		paragraphs = paragraphs.map((para, index) => ({
			...para,
			id: generateId(para.text || para, index)
		}))
		
		const afterIds = paragraphs.map(p => p.id)
		const afterDuplicateIds = afterIds.filter((id, index, arr) => arr.indexOf(id) !== index)
		
		if (afterDuplicateIds.length === 0) {
			addCheckboxDebug(`✅ All IDs are now unique!`)
			console.log('✅ ID regeneration successful - all IDs are now unique')
		} else {
			addCheckboxDebug(`❌ Still have ${afterDuplicateIds.length} duplicate IDs after regeneration`)
			console.log('❌ ID regeneration failed - still have duplicates:', afterDuplicateIds)
		}
		
		// Clear selections since IDs have changed
		selectedParagraphs = new Set()
		addCheckboxDebug(`🧹 Cleared selections due to ID regeneration`)
		console.log('🧹 Cleared selections due to ID regeneration. Previous selections:', currentSelections)
		
		// Save the updated paragraphs
		saveAssessmentData()
		if (currentStudentId) {
			saveStudentParagraphs()
		}
	}
	let showDeleteConfirmation = $state(false) // Show delete confirmation modal
	let studentToDelete = $state(null) // Student to be deleted
	let editingParagraphIndex = $state(null) // Track which paragraph is being edited
	let editingParagraphText = $state('') // Store text being edited

	// Removed autosave functionality to prevent data contamination

	// UI state
	let showAddSubject = $state(false)
	let showAddAssessment = $state(false)
	let showAddStudent = $state(false)
	let showStudentManager = $state(false)
	let showAddCategoryKnowledgeArea = $state(false)
	let showCategoriesKnowledgeSection = $state(true) // Collapsible section for categories and knowledge areas
	let showCategoryEditModal = $state(false)
	let editingCategory = $state(null)
	let newSubjectName = $state('')
	let newAssessmentName = $state('')
	let newStudentName = $state('')
	let newStudentId = $state('')
	let showMobileSidebar = $state(false)
	let showCalculator = $state(false) // Calculator toggle state
	let currentView = $state('subjects') // 'subjects', 'assessments', 'feedback'
	let lastNonHelpView = $state('subjects')
	let isDarkMode = $state(false) // Dark mode toggle state
	
	// Force reactivity for debugging
	$effect(() => {
		console.log('Current view changed to:', currentView)
	})

	$effect(() => {
		if (currentView && currentView !== 'help') {
			lastNonHelpView = currentView
		}
	})

	$effect(() => {
		persistNavigationState()
	})

	// Dark mode functionality
	$effect(() => {
		// Apply dark mode to document
		if (isDarkMode) {
			document.documentElement.setAttribute('data-bs-theme', 'dark')
		} else {
			document.documentElement.setAttribute('data-bs-theme', 'light')
		}
		
		// Save preference to localStorage
		localStorage.setItem('darkMode', isDarkMode.toString())
	})

	// Initialize dark mode from localStorage or system preference
	function initializeDarkMode() {
		const savedDarkMode = localStorage.getItem('darkMode')
		if (savedDarkMode !== null) {
			isDarkMode = savedDarkMode === 'true'
		} else {
			// Check system preference
			isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
		}
	}

	// Toggle dark mode
	function toggleDarkMode() {
		isDarkMode = !isDarkMode
	}

	function getStudentPhoto(student) {
		if (!student || typeof student !== 'object') return ''
		const photoFields = [
			'photo',
			'photoUrl',
			'photoURL',
			'avatar',
			'avatarUrl',
			'avatarURL',
			'image',
			'imageUrl',
			'imageURL',
			'studentImage',
			'profileImage',
			'profilePhoto'
		]
		for (const field of photoFields) {
			const value = student[field]
			if (typeof value === 'string' && value.trim()) {
				return value
			}
		}
		const nestedPhoto = student?.profile?.photo || student?.profile?.image || student?.profile?.avatar
		if (typeof nestedPhoto === 'string' && nestedPhoto.trim()) {
			return nestedPhoto
		}
		return ''
	}

	function getDisplayedStudentPhoto(student) {
		if (!student || typeof student !== 'object') return ''
		if (student.id === currentStudentId && typeof studentPhoto === 'string' && studentPhoto.trim()) {
			return studentPhoto
		}
		return getStudentPhoto(student)
	}

	function getStudentInitials(student) {
		const label = student?.displayName || student?.name || ''
		const words = label.split(/\s+/).filter(Boolean)
		if (words.length === 0) return 'S'
		return words.slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('')
	}

	function getFilteredStudents() {
		const query = studentPickerSearch.trim().toLowerCase()
		if (!query) return sortedStudents

		return sortedStudents.filter(student => {
			const haystack = [student.displayName, student.name, student.studentId]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
			return haystack.includes(query)
		})
	}

	function toggleStudentPicker() {
		showStudentPicker = !showStudentPicker
		if (!showStudentPicker) {
			studentPickerSearch = ''
		}
	}

	async function chooseStudentFromPicker(studentId) {
		await selectStudent(studentId)
		showStudentPicker = false
		studentPickerSearch = ''
	}

	function closeStudentPicker() {
		showStudentPicker = false
		studentPickerSearch = ''
	}

	// Removed debouncedAutosave function to prevent data contamination

	// Removed autosave effect to prevent data contamination

	// Removed autosave effect for subject/student data to prevent data contamination

	// Handle student selection changes
	$effect(() => {
		if (currentView !== 'feedback' || !currentAssessmentId) {
			lastStudentEffectAssessmentId = currentAssessmentId || null
			lastStudentEffectStudentId = currentStudentId || null
			return
		}

		const normalizedStudentId = currentStudentId || null
		const assessmentChanged = lastStudentEffectAssessmentId !== currentAssessmentId
		const studentChanged = lastStudentEffectStudentId !== normalizedStudentId

		if (!assessmentChanged && !studentChanged) {
			return
		}

		const previousStudentId = lastStudentEffectStudentId
		lastStudentEffectAssessmentId = currentAssessmentId
		lastStudentEffectStudentId = normalizedStudentId

		if (currentStudentId) {
			const student = students.find(s => s.id === currentStudentId)
			if (student) {
				studentName = student.displayName
				studentPhoto = getStudentPhoto(student)
			}
		} else if (previousStudentId) {
			// STRICT DATA SEPARATION RULE 1: Student deselected - ensure we show assignment-only data
			console.log('STRICT DATA SEPARATION: Student deselected via reactive effect - loading assignment-only data')
			studentName = ''
			studentSubmissionText = ''
			studentSubmissionDocuments = []
			studentPhoto = ''
			// No studentImage - only header photo for assessment
			selectedParagraphs = new Set()
			categoryMarks = {}
			quickAddText = {}
			quickAddToAssessmentWhenStudentSelected = false

			// Reload assignment paragraphs only (no student data)
			loadAssessmentData(currentSubjectId, currentAssessmentId, false)
		}
		})

	// Auto-save quickAddText per student (debounced)
	let quickAddTextAutoSaveTimer = null
	$effect(() => {
		// Read quickAddText to subscribe to changes
		const currentQuickAddText = JSON.stringify(quickAddText)
		
		// Only auto-save if student is selected and we're in feedback view
		if (!currentStudentId || !currentAssessmentId || currentView !== 'feedback') {
			return
		}

		// Debounce: save after 1 second of inactivity
		if (quickAddTextAutoSaveTimer) {
			clearTimeout(quickAddTextAutoSaveTimer)
		}
		quickAddTextAutoSaveTimer = setTimeout(() => {
			persistCurrentStudentEvaluationData()
			console.log('AUTO-SAVE: quickAddText saved for student', currentStudentId)
		}, 1000)
	})	
	// Function to update view
	function updateView(newView) {
		currentView = newView
	}

	function openHelpPage() {
		if (currentView !== 'help') {
			lastNonHelpView = currentView
		}
		currentView = 'help'
	}

	function closeHelpPage() {
		if (lastNonHelpView && lastNonHelpView !== 'help') {
			currentView = lastNonHelpView
			return
		}

		if (currentAssessmentId) {
			currentView = 'feedback'
		} else if (currentSubjectId) {
			currentView = 'assessments'
		} else {
			currentView = 'subjects'
		}
	}

	async function insertTableHtmlSpacerSnippet() {
		const snippet = TABLE_HTML_SPACER_SNIPPET
		const currentHtml = String(assessmentHtml || '')

		if (currentHtml.includes(snippet)) {
			showSuccessNotification('ℹ️ Spacer snippet already exists in Assessment HTML.')
			return
		}

		const updatedHtml = currentHtml.trim() ? `${currentHtml}\n${snippet}` : snippet
		assessmentHtml = updatedHtml

		if (currentAssessment) {
			currentAssessment = {
				...currentAssessment,
				rubricHtml: updatedHtml
			}
		}

		await saveAssessmentData({ force: true, skipSelections: true })
		showSuccessNotification('✅ Spacer snippet inserted into Assessment HTML.')
	}

	// Function to toggle calculator view
	function toggleCalculatorView() {
		showCalculator = !showCalculator
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

	function persistNavigationState() {
		try {
			const data = {
				view: currentView,
				subjectId: currentSubjectId,
				assessmentId: currentAssessmentId,
				studentId: currentStudentId
			}
			localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(data))
		} catch (error) {
			console.warn('Failed to persist navigation state', error)
		}
	}

	function restoreNavigationState() {
		try {
			const raw = localStorage.getItem(NAVIGATION_STATE_KEY)
			if (!raw) return
			const data = JSON.parse(raw)

			if (data?.subjectId) {
				const subject = subjects.find(item => item.id === data.subjectId)
				if (subject) {
					currentSubject = subject
					currentSubjectId = subject.id
				}
			}

			if (data?.assessmentId && currentSubject?.assessments) {
				const assessment = currentSubject.assessments.find(item => item.id === data.assessmentId)
				if (assessment) {
					currentAssessment = assessment
					currentAssessmentId = assessment.id
				}
			}

			if (data?.view === 'feedback' && currentAssessmentId) {
				currentView = 'feedback'
				if (currentSubjectId && currentAssessmentId) {
					loadAssessmentData(currentSubjectId, currentAssessmentId)
				}
			} else if (data?.view === 'assessments' && currentSubjectId) {
				currentView = 'assessments'
			} else {
				currentView = 'subjects'
			}

			if (data?.studentId && currentView === 'feedback') {
				currentStudentId = data.studentId
			}
		} catch (error) {
			console.warn('Failed to restore navigation state', error)
		}
	}

	// Category and topic selection
	let selectedCategory = $state('')
	let selectedTopic = $state('')
	let selectedKnowledgeArea = $state('')
	const tableRowLabels = $derived(extractTableRowLabels(assessmentHtml))
	const tableColumnHeaders = $derived(extractTableColumnHeaders(assessmentHtml))

	// pdrCategories is now imported from utils/constants.js

	// studio4Categories is now imported from utils/constants.js

	// studio5Categories is now imported from utils/constants.js

	// generateId function is now imported from utils/helpers.js

	// Ensure paragraphs have IDs (migration function for existing data)
	// ensureParagraphsHaveIds function is now imported from utils/helpers.js

	// ensureCategoriesHaveOrder function is now imported from utils/helpers.js

	function normalizeCategoryLabel(str) {
		return (str || '')
			.toString()
			.replace(/\u00a0/g, ' ')
			.replace(/\([^)]*\)/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase()
	}

	function normalizeHtmlQuotes(value) {
		return String(value || '')
			.replace(/[“”]/g, '"')
			.replace(/[‘’]/g, "'")
	}

	function extractTableRowLabels(html) {
		if (!html) return []
		const temp = document.createElement('div')
		temp.innerHTML = html
		const labels = new Set()
		const rows = Array.from(temp.querySelectorAll('table tr'))
		rows.forEach(row => {
			const firstCell = row.cells?.[0]
			if (!firstCell) return
			const text = (firstCell.textContent || '').replace(/\u00a0/g, ' ').trim()
			if (text) labels.add(text)
		})
		return Array.from(labels)
	}

	function extractTableColumnHeaders(html) {
		if (!html) return []
		const temp = document.createElement('div')
		temp.innerHTML = html
		const table = temp.querySelector('table')
		if (!table) return []

		// Get first row (usually headers)
		const firstRow = table.querySelector('tr')
		if (!firstRow) return []

		const headers = []
		const cells = Array.from(firstRow.querySelectorAll('th, td'))
		cells.forEach((cell, index) => {
			const text = (cell.textContent || '').replace(/\u00a0/g, ' ').trim()
			if (text && index > 0) { // Skip first column (row labels)
				headers.push({ index, text })
			}
		})
		return headers
	}

	function shouldUseLandscapeForHtml(html, marginMm = 20) {
		if (!html) return false
		const pxPerMm = 96 / 25.4
		const portraitWidthMm = 210 // A4 portrait width
		const maxContentWidthMm = portraitWidthMm - (marginMm * 2)
		const maxContentWidthPx = maxContentWidthMm * pxPerMm
		const temp = document.createElement('div')
		temp.className = 'pdf-assessment-html'
		temp.style.position = 'absolute'
		temp.style.left = '-99999px'
		temp.style.top = '0'
		temp.style.display = 'inline-block'
		temp.style.width = 'auto'
		temp.style.fontFamily = 'Arial, sans-serif'
		temp.style.fontSize = '12px'
		temp.style.lineHeight = '1.35'
		temp.innerHTML = html
		document.body.appendChild(temp)
		let needs = false
		try {
			const contentWidthPx = temp.scrollWidth
			needs = contentWidthPx > maxContentWidthPx
		} catch (e) {
			console.warn('Failed to measure HTML width for orientation detection:', e)
		} finally {
			document.body.removeChild(temp)
		}
		return needs
	}


	async function loadSubjects() {
		try {
			// Try Tauri first (desktop app)
			const data = await invoke('read_portable')
			if (data) {
				const parsed = JSON.parse(data)
				subjects = parsed.subjects || []
				// Note: knowledgeAreas are now stored as assignment properties
				students = parsed.students || []
				percentageRanges = parsed.percentageRanges || []
				globalAiSystemInstructions = parsed.appSettings?.aiMarkingSystemInstructions || ''
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const data = localStorage.getItem('feedback-subjects')
				if (data) {
					const parsed = JSON.parse(data)
					subjects = parsed.subjects || []
					// Note: knowledgeAreas are now stored as assignment properties
					students = parsed.students || []
					percentageRanges = parsed.percentageRanges || []
					globalAiSystemInstructions = parsed.appSettings?.aiMarkingSystemInstructions || ''
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
			}
		}
		
		// Migrate categories to have order field
		subjects.forEach(subject => {
			subject.assessments?.forEach(assessment => {
				if (assessment.categories) {
					assessment.categories = ensureCategoriesHaveOrder(assessment.categories)
				}
			})
		})

		restoreNavigationState()
	}

	async function saveSubjects() {
		const data = {
			subjects,
			students,
			percentageRanges,
			appSettings: {
				aiMarkingSystemInstructions: globalAiSystemInstructions.trim()
			}
		}
		
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

	async function loadAssessmentData(subjectId, assessmentId, preserveSelections = false) {
		// STRICT DATA SEPARATION: Validate assessment context before loading any data
		if (!currentSubject || !currentSubject.assessments) {
			console.error('STRICT DATA SEPARATION: No current subject or assessments found')
			initializeEmptyData()
			return
		}
		
		// STRICT DATA SEPARATION: Ensure assessment exists in current subject
		const assessmentExists = currentSubject.assessments.some(assessment => assessment.id === assessmentId)
		if (!assessmentExists) {
			console.error(`STRICT DATA SEPARATION: Assessment with ID ${assessmentId} not found in subject ${currentSubject.name}`)
			initializeEmptyData()
			return
		}
		
		// STRICT DATA SEPARATION: Ensure we're loading data for the correct assessment
		if (currentAssessmentId !== assessmentId) {
			console.error(`STRICT DATA SEPARATION: Assessment ID mismatch - current: ${currentAssessmentId}, requested: ${assessmentId}`)
			initializeEmptyData()
			return
		}
		
		console.log(`STRICT DATA SEPARATION: Loading assignment data for assessment ${assessmentId} in subject ${subjectId}`)
		
		try {
			// Try Tauri first (desktop app)
			const data = await invoke('read_subject_data', { subjectId: `${subjectId}-${assessmentId}` })
			if (data) {
				const parsed = JSON.parse(data)
				let loadedParagraphs = parsed.paragraphs || []
				
				// STRICT DATA SEPARATION RULE 1: When no student is selected, only load assignment data
				// Filter out any student paragraphs to maintain strict separation
				if (!currentStudentId) {
					loadedParagraphs = loadedParagraphs.filter(para => {
						// Filter out paragraphs with _source: 'student' or modified IDs ending with '_student'
						if (para._source === 'student') return false
						if (para.id && para.id.endsWith('_student')) return false
						return true
					})
				}
				
				// Debug: Check for duplicates before processing
				console.log('ASSIGNMENT DEBUG: Raw loaded paragraphs:', {
					count: loadedParagraphs.length,
					paragraphs: loadedParagraphs.map(p => ({ 
						text: typeof p === 'string' ? p : p.text, 
						color: typeof p === 'string' ? '' : p.color,
						id: typeof p === 'string' ? 'string' : p.id
					}))
				})
				
				// Check for duplicates by text and color
				const uniqueParagraphs = []
				const seen = new Set()
				loadedParagraphs.forEach(para => {
					const text = typeof para === 'string' ? para : para.text
					const color = typeof para === 'string' ? '' : para.color
					const key = `${text}|${color}`
					if (!seen.has(key)) {
						seen.add(key)
						uniqueParagraphs.push(para)
					} else {
						console.log('DUPLICATE FOUND:', { text: text.substring(0, 50) + '...', color })
					}
				})
				
				console.log('ASSIGNMENT DEBUG: After deduplication:', {
					originalCount: loadedParagraphs.length,
					uniqueCount: uniqueParagraphs.length,
					duplicatesRemoved: loadedParagraphs.length - uniqueParagraphs.length
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				paragraphs = ensureParagraphsHaveIds(uniqueParagraphs)
				
				// Check for duplicate IDs after loading and fixing
				const hasDuplicates = checkForDuplicateIds()
				if (hasDuplicates) {
					console.log('⚠️ Duplicate IDs detected during load - auto-fixing...')
					addCheckboxDebug('⚠️ Duplicate IDs detected - auto-fixing...')
					regenerateParagraphIds()
				}
				
				// Load all paragraphs but don't select any by default (unless preserving selections)
				if (!preserveSelections) {
					selectedParagraphs = new Set()
				}
				
				// STRICT DATA SEPARATION RULE 1: Assignment data should never contain student information
				// Always clear student identity data when loading assignment data
				studentName = ''
				studentSubmissionText = ''
				// No studentImage - only header photo for assessment
				
					// Load assessment header photo if available
					if (currentAssessment && parsed.headerPhoto) {
						currentAssessment.headerPhoto = parsed.headerPhoto
					}
					// Load assessment HTML snippet if available
					if (currentAssessment && parsed.rubricHtml !== undefined) {
						currentAssessment.rubricHtml = parsed.rubricHtml
					}
					if (currentAssessment && parsed.tableRowCategoryMap !== undefined) {
						currentAssessment.tableRowCategoryMap = parsed.tableRowCategoryMap || {}
					}
					if (currentAssessment && parsed.tableColumnMarkMap !== undefined) {
						currentAssessment.tableColumnMarkMap = parsed.tableColumnMarkMap || {}
					}
					if (currentAssessment && parsed.aiVectorIndex !== undefined) {
						currentAssessment.aiVectorIndex = parsed.aiVectorIndex || null
					}
					if (currentAssessment && parsed.aiReferenceDocuments !== undefined) {
						currentAssessment.aiReferenceDocuments = parsed.aiReferenceDocuments || []
					}
					if (currentAssessment && parsed.aiAnswerInstructionsByCategory !== undefined) {
						const instructionsMap = parsed.aiAnswerInstructionsByCategory || {}
						currentAssessment.aiAnswerInstructionsByCategory = instructionsMap
						if (Array.isArray(currentAssessment.categories)) {
							currentAssessment.categories = currentAssessment.categories.map(category => {
								const mappedValue = instructionsMap[category.name] ?? instructionsMap[normalizeCategoryName(category.name)]
								if (mappedValue === undefined) return category
								return {
									...category,
									aiAnswerInstructions: String(mappedValue)
								}
							})
						}
					}
					studentSubmissionDocuments = parsed.assessmentInputDocuments || parsed.studentSubmissionDocuments || []
					assessmentHtml = currentAssessment?.rubricHtml || ''
					tableRowCategoryMap = currentAssessment?.tableRowCategoryMap || {}
					tableColumnMarkMap = currentAssessment?.tableColumnMarkMap || {}
					assessmentVectorIndex = currentAssessment?.aiVectorIndex || null
					assessmentReferenceDocuments = currentAssessment?.aiReferenceDocuments || []
					quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
					quickAddInstructionExpanded = {}
					quickAddInstructionAssessmentKey = `${subjectId || ''}:${assessmentId || ''}`
					// Keep HTML card collapsed by default; user can expand manually
					showAssessmentHtml = false
					// Reset all marks to zero
					categoryMarks = {}
					manualTotalMarks = currentAssessment?.totalMarks ?? ''
				quickAddText = {}
			} else {
				// Initialize empty data for new assessment
				initializeEmptyData()
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const key = `feedback-assessment-${subjectId}-${assessmentId}`
				const data = localStorage.getItem(key)
				if (data) {
					const parsed = JSON.parse(data)
					let loadedParagraphs = parsed.paragraphs || []
					
					// STRICT DATA SEPARATION RULE 1: When no student is selected, only load assignment data
					// Filter out any student paragraphs to maintain strict separation
					if (!currentStudentId) {
						loadedParagraphs = loadedParagraphs.filter(para => {
							// Filter out paragraphs with _source: 'student' or modified IDs ending with '_student'
							if (para._source === 'student') return false
							if (para.id && para.id.endsWith('_student')) return false
							return true
						})
					}
					
					// Debug: Check for duplicates before processing
					console.log('ASSIGNMENT DEBUG (localStorage): Raw loaded paragraphs:', {
						count: loadedParagraphs.length,
						paragraphs: loadedParagraphs.map(p => ({ 
							text: typeof p === 'string' ? p : p.text, 
							color: typeof p === 'string' ? '' : p.color,
							id: typeof p === 'string' ? 'string' : p.id
						}))
					})
					
					// Check for duplicates by text and color
					const uniqueParagraphs = []
					const seen = new Set()
					loadedParagraphs.forEach(para => {
						const text = typeof para === 'string' ? para : para.text
						const color = typeof para === 'string' ? '' : para.color
						const key = `${text}|${color}`
						if (!seen.has(key)) {
							seen.add(key)
							uniqueParagraphs.push(para)
						} else {
							console.log('DUPLICATE FOUND (localStorage):', { text: text.substring(0, 50) + '...', color })
						}
					})
					
					console.log('ASSIGNMENT DEBUG (localStorage): After deduplication:', {
						originalCount: loadedParagraphs.length,
						uniqueCount: uniqueParagraphs.length,
						duplicatesRemoved: loadedParagraphs.length - uniqueParagraphs.length
					})
					
					// Ensure paragraphs have IDs (migration for existing data)
					paragraphs = ensureParagraphsHaveIds(uniqueParagraphs)
					
					// Check for duplicate IDs after loading and fixing
					const hasDuplicates = checkForDuplicateIds()
					if (hasDuplicates) {
						console.log('⚠️ Duplicate IDs detected during load (localStorage) - auto-fixing...')
						addCheckboxDebug('⚠️ Duplicate IDs detected - auto-fixing...')
						regenerateParagraphIds()
					}
					
					// Load all paragraphs but don't select any by default (unless preserving selections)
					if (!preserveSelections) {
						selectedParagraphs = new Set()
					}
					
					// STRICT DATA SEPARATION RULE 1: Assignment data should never contain student information
					// Always clear student identity data when loading assignment data
					studentName = ''
					studentSubmissionText = ''
					// No studentImage - only header photo for assessment
					
					// Load assessment header photo if available
					if (currentAssessment && parsed.headerPhoto) {
						currentAssessment.headerPhoto = parsed.headerPhoto
					}
					// Load assessment HTML snippet if available
					if (currentAssessment && parsed.rubricHtml !== undefined) {
						currentAssessment.rubricHtml = parsed.rubricHtml
					}
					if (currentAssessment && parsed.tableRowCategoryMap !== undefined) {
						currentAssessment.tableRowCategoryMap = parsed.tableRowCategoryMap || {}
					}
					if (currentAssessment && parsed.tableColumnMarkMap !== undefined) {
						currentAssessment.tableColumnMarkMap = parsed.tableColumnMarkMap || {}
					}
					if (currentAssessment && parsed.aiVectorIndex !== undefined) {
						currentAssessment.aiVectorIndex = parsed.aiVectorIndex || null
					}
					if (currentAssessment && parsed.aiReferenceDocuments !== undefined) {
						currentAssessment.aiReferenceDocuments = parsed.aiReferenceDocuments || []
					}
					if (currentAssessment && parsed.aiAnswerInstructionsByCategory !== undefined) {
						const instructionsMap = parsed.aiAnswerInstructionsByCategory || {}
						currentAssessment.aiAnswerInstructionsByCategory = instructionsMap
						if (Array.isArray(currentAssessment.categories)) {
							currentAssessment.categories = currentAssessment.categories.map(category => {
								const mappedValue = instructionsMap[category.name] ?? instructionsMap[normalizeCategoryName(category.name)]
								if (mappedValue === undefined) return category
								return {
									...category,
									aiAnswerInstructions: String(mappedValue)
								}
							})
						}
					}
					studentSubmissionDocuments = parsed.assessmentInputDocuments || parsed.studentSubmissionDocuments || []
					assessmentHtml = currentAssessment?.rubricHtml || ''
					tableRowCategoryMap = currentAssessment?.tableRowCategoryMap || {}
					tableColumnMarkMap = currentAssessment?.tableColumnMarkMap || {}
					assessmentVectorIndex = currentAssessment?.aiVectorIndex || null
					assessmentReferenceDocuments = currentAssessment?.aiReferenceDocuments || []
					quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
					quickAddInstructionExpanded = {}
					quickAddInstructionAssessmentKey = `${subjectId || ''}:${assessmentId || ''}`
					// Keep HTML card collapsed by default; user can expand manually
					showAssessmentHtml = false
					// Reset all marks to zero
					categoryMarks = {}
					manualTotalMarks = currentAssessment?.totalMarks ?? ''
				quickAddText = {}
				} else {
					// Initialize empty data for new assessment
					initializeEmptyData()
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
				initializeEmptyData()
			}
		}
	}
	
	// Helper function to initialize empty data - STRICT DATA SEPARATION
	function initializeEmptyData() {
		// Clear all assessment-related data
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		studentSubmissionText = ''
		studentSubmissionDocuments = []
		// No studentImage - only header photo for assessment
		assessmentHtml = ''
		showAssessmentHtml = false
		tableRowCategoryMap = {}
		tableColumnMarkMap = {}
		assessmentVectorIndex = null
		assessmentReferenceDocuments = []
		categoryMarks = {}
		manualTotalMarks = ''
		quickAddText = {}
		quickAddAiInstructions = {}
		quickAddInstructionExpanded = {}
		Object.keys(quickAddInstructionSaveTimers).forEach(key => {
			clearTimeout(quickAddInstructionSaveTimers[key])
			delete quickAddInstructionSaveTimers[key]
		})
		quickAddInstructionAssessmentKey = ''
		quickAddColorPicker = {}
		improvingText = {}
		improvingTextWithRag = {}
		evidenceCheckingText = {}
		aiImprovedText = {}
		aiDraftOverallFeedback = ''
		aiDraftRetrievedContext = []
		aiRetrievalMode = ''
		aiDraftReviewItems = []
		showAiDraftReviewModal = false
		showPromptPreviewModal = false
		promptPreviewTitle = ''
		promptPreviewMessages = []
		activeFeedbackTab = 'enter-data'
		quickAddToAssessmentWhenStudentSelected = false

		// Clear student selection to prevent cross-contamination
		currentStudentId = null
		
		// Clear any cached data that might be from other assessments
		// This ensures a clean slate when entering any assessment
		console.log('STRICT DATA SEPARATION: All data cleared before entering assessment')
	}

	$effect(() => {
		if (!currentAssessment?.categories || !currentAssessmentId) {
			quickAddAiInstructions = {}
			quickAddInstructionExpanded = {}
			quickAddInstructionAssessmentKey = ''
			return
		}

		const assessmentKey = `${currentSubjectId || ''}:${currentAssessmentId || ''}`
		if (quickAddInstructionAssessmentKey !== assessmentKey) {
			quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
			quickAddInstructionExpanded = {}
			quickAddInstructionAssessmentKey = assessmentKey
		}
	})

	function syncCurrentAssessmentAiInstructionsFromQuickAdd() {
		if (!currentAssessment) return

		const nextMap = {
			...(currentAssessment.aiAnswerInstructionsByCategory || {})
		}

		Object.entries(quickAddAiInstructions || {}).forEach(([key, value]) => {
			const safeValue = String(value || '')
			nextMap[key] = safeValue
			nextMap[normalizeCategoryName(key)] = safeValue
		})

		let categoriesChanged = false
		const syncedCategories = (currentAssessment.categories || []).map(category => {
			const categoryName = category?.name || ''
			if (!categoryName) return category

			const normalizedCategoryName = normalizeCategoryName(categoryName)
			const explicitValue = quickAddAiInstructions[categoryName]
			const resolvedValue = explicitValue !== undefined
				? String(explicitValue)
				: String(nextMap[categoryName] ?? nextMap[normalizedCategoryName] ?? (category.aiAnswerInstructions || ''))

			nextMap[categoryName] = resolvedValue
			nextMap[normalizedCategoryName] = resolvedValue

			if (String(category.aiAnswerInstructions || '') !== resolvedValue) {
				categoriesChanged = true
				return {
					...category,
					aiAnswerInstructions: resolvedValue
				}
			}

			return category
		})

		const currentMapSerialized = JSON.stringify(currentAssessment.aiAnswerInstructionsByCategory || {})
		const nextMapSerialized = JSON.stringify(nextMap)

		if (categoriesChanged || currentMapSerialized !== nextMapSerialized) {
			currentAssessment = {
				...currentAssessment,
				categories: syncedCategories,
				aiAnswerInstructionsByCategory: nextMap
			}
		}
	}

	async function saveAssessmentData(options = {}) {
		const { force = false, skipSelections = false } = options
		if (!currentSubjectId || !currentAssessmentId) return

		Object.keys(quickAddInstructionSaveTimers).forEach(key => {
			clearTimeout(quickAddInstructionSaveTimers[key])
			delete quickAddInstructionSaveTimers[key]
		})
		syncCurrentAssessmentAiInstructionsFromQuickAdd()

		const subjectIndexForSettings = subjects.findIndex(subject => subject.id === currentSubjectId)
		if (subjectIndexForSettings !== -1) {
			const assessmentIndexForSettings = subjects[subjectIndexForSettings].assessments.findIndex(assessment => assessment.id === currentAssessmentId)
			if (assessmentIndexForSettings !== -1 && currentAssessment) {
				subjects[subjectIndexForSettings].assessments[assessmentIndexForSettings] = currentAssessment
				await saveSubjects()
			}
		}
		
		// STRICT SAVING CRITERIA 1: Only save to Assessment if student is NOT selected
		if (currentStudentId && !force) {
			console.log('STRICT SAVING CRITERIA: Student selected - skipping assessment save to avoid mixing student feedback into assessment data')
			showSuccessNotification('ℹ️ Assessment settings saved. Paragraph data is not overwritten while a student is selected.')
			return
		}
		
		// STRICT VALIDATION: Ensure no student-specific data is being saved to assessment
		if (currentStudentId && force) {
			console.log('STRICT SAVING CRITERIA: Forced save of assessment metadata while student is selected (student data excluded)')
		} else {
			console.log('STRICT SAVING CRITERIA: Saving to assessment file - no student selected')
		}

		const data = {
			paragraphs,
			selectedParagraphs: Array.from(currentStudentId && (force || skipSelections) ? new Set() : selectedParagraphs),
			// Assignment data should never contain student-specific information
			studentName: '',
			// No studentImage - only header photo for assessment
			headerPhoto: currentAssessment?.headerPhoto || '',
			rubricHtml: assessmentHtml,
			tableRowCategoryMap,
			tableColumnMarkMap,
			aiReferenceDocuments: assessmentReferenceDocuments,
			assessmentInputDocuments: studentSubmissionDocuments,
			aiAnswerInstructionsByCategory: currentAssessment?.aiAnswerInstructionsByCategory || {},
			aiVectorIndex: assessmentVectorIndex,
			categoryMarks,
			manualTotalMarks: currentAssessment?.totalMarks ?? manualTotalMarks
		}
		
		try {
			// Try Tauri first (desktop app)
			await invoke('write_subject_data', { 
				subjectId: `${currentSubjectId}-${currentAssessmentId}`, 
				data: JSON.stringify(data, null, 2) 
			})
			
			// Show motivational message after successful save
			showSuccessNotification(getMotivationalMessage('assignment'))
		} catch (error) {
			console.log('Tauri not available, saving to browser storage')
			// Fallback to localStorage for web development
			try {
				const key = `feedback-assessment-${currentSubjectId}-${currentAssessmentId}`
				localStorage.setItem(key, JSON.stringify(data))
				
				// Show motivational message after successful save
				showSuccessNotification(getMotivationalMessage('assignment'))
			} catch (localError) {
				console.error('Failed to save to localStorage:', localError)
				showSuccessNotification('❌ Failed to save assignment data. Please try again.')
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
			// Autosave will handle saving automatically
		}
	}

	function addAssessment() {
		if (newAssessmentName.trim() && currentSubject) {
			const assessment = {
				id: generateId(),
				name: newAssessmentName.trim(),
				topics: [],
				categories: [],
				knowledgeAreas: [],
				aiAnswerInstructionsByCategory: {},
				aiReferenceDocuments: [],
				totalMarks: 0, // Assessment property for total marks
				percentageRanges: [], // Assessment-specific percentage ranges
				markingMode: 'none' // 'none', 'percentage', or 'fixed' - determines how colors get marks
			}
			currentSubject.assessments.push(assessment)
			newAssessmentName = ''
			showAddAssessment = false
			// Autosave will handle saving automatically
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
		studentSubmissionText = ''
		studentSubmissionDocuments = []
		assessmentReferenceDocuments = []
		// No studentImage - only header photo for assessment
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
				studentSubmissionText = ''
				studentSubmissionDocuments = []
				assessmentReferenceDocuments = []
				// No studentImage - only header photo for assessment
			}
			
			console.log(`Subject "${subjectToDelete.name}" deleted successfully`)
		}
	}

	function selectAssessment(assessment) {
		// STRICT FILTER: Clear ALL data before entering assessment feedback page
		initializeEmptyData()

			// Set new assessment context
			currentAssessmentId = assessment.id
			currentAssessment = assessment
			manualTotalMarks = assessment.totalMarks ?? ''
			assessmentHtml = assessment.rubricHtml || ''
			tableRowCategoryMap = assessment.tableRowCategoryMap || {}

		// Backward compatibility: Initialize markingMode if not present
		if (!currentAssessment.markingMode) {
			currentAssessment.markingMode = 'none'
		}

		// Backward compatibility: Initialize colorMarks for categories if not present
		if (currentAssessment.categories) {
			currentAssessment.categories.forEach(category => {
				if (!category.colorMarks) {
					category.colorMarks = {}
				}
			})
		}

		currentView = 'feedback'

		// Load ONLY data for this specific assessment
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
		// No studentImage - only header photo for assessment
	}

	function goBackToAssessments() {
		currentAssessmentId = null
		currentAssessment = null
		currentView = 'assessments'
		paragraphs = []
		selectedParagraphs = new Set()
		studentName = ''
		// No studentImage - only header photo for assessment
	}

	function addParagraph() {
		if (newParagraph.trim()) {
			// Strip HTML tags from the input
			let paragraphText = stripHtmlTags(newParagraph.trim())

			// For Studio 6 or Studio 4 PDR assessments, add category prefix if selected
			if (needsCategorySelection() && selectedCategory) {
				paragraphText = `${selectedCategory}: ${paragraphText}`
			}

			// Add knowledge area prefix if selected
			if (selectedKnowledgeArea) {
				paragraphText = `${paragraphText} - ${selectedKnowledgeArea}`
			}
			
		const newPara = {
			id: generateId(), // Add unique ID for reliable tracking
			text: paragraphText,
			color: selectedColor || undefined,
			subjectId: currentSubjectId, // STRICT DATA ISOLATION: Add subject context
			assessmentId: currentAssessmentId // STRICT DATA ISOLATION: Add assessment context
		}

		// Persist color mark configuration for fixed marking mode
		persistSelectedColorMark()

		paragraphs.push(newPara)
		newParagraph = ''
		selectedColorMark = '' // Reset mark input
		// Keep knowledge area selection intact (like category selection)
		// selectedKnowledgeArea = '' // Reset knowledge area selection

		// Save to both assignment and student
		saveAssessmentData()
		if (currentStudentId) {
			saveStudentParagraphs()
		}
		}
	}

	const quickAddInputId = (categoryName = '') => `quick-add-${categoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
	const quickAddInstructionInputId = (categoryName = '') => `quick-add-instructions-${categoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
	const quickAddInstructionSectionId = (categoryName = '') => `quick-add-instructions-panel-${categoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}`

	function isQuickAddInstructionExpanded(categoryName) {
		return Boolean(quickAddInstructionExpanded[categoryName])
	}

	function toggleQuickAddInstructionPanel(categoryName) {
		const isExpanded = isQuickAddInstructionExpanded(categoryName)
		if (isExpanded) {
			persistCategoryAiInstruction(categoryName)
		}
		quickAddInstructionExpanded = {
			...quickAddInstructionExpanded,
			[categoryName]: !isExpanded
		}
	}

	function schedulePersistCategoryAiInstruction(categoryName, delayMs = 500) {
		if (!categoryName) return
		if (quickAddInstructionSaveTimers[categoryName]) {
			clearTimeout(quickAddInstructionSaveTimers[categoryName])
		}
		quickAddInstructionSaveTimers[categoryName] = setTimeout(() => {
			persistCategoryAiInstruction(categoryName)
			delete quickAddInstructionSaveTimers[categoryName]
		}, delayMs)
	}

	// Prefill category/knowledge area and focus the inline quick-add input
	function startNewParagraphFor(categoryName, knowledgeAreaName) {
		if (categoryName) {
			selectedCategory = categoryName
		}
		if (knowledgeAreaName && knowledgeAreaName !== 'No Knowledge Area') {
			selectedKnowledgeArea = knowledgeAreaName
			quickAddKnowledgeArea = { ...quickAddKnowledgeArea, [categoryName]: knowledgeAreaName }
		} else {
			selectedKnowledgeArea = ''
		}

		const quickInput = document.getElementById(quickAddInputId(categoryName))
		if (quickInput) {
			quickInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
			quickInput.focus()
		}
	}

	async function improveTextWithAI(categoryName) {
		const text = stripHtmlTags((quickAddText[categoryName] || '').trim())
		const answerInstructions = (quickAddAiInstructions[categoryName] || '').trim()
		if (!text) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		// Set loading state
		improvingText = { ...improvingText, [categoryName]: true }

		try {
			const improvedText = await improveEnglish(text, answerInstructions)
			// Strip any HTML tags that might have been introduced
			const cleanedText = stripHtmlTags(improvedText)
			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			// Mark this text as AI-improved for styling
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification('✨ Text improved successfully!')
		} catch (error) {
			console.error('Failed to improve text:', error)
			showSuccessNotification(`❌ Failed to improve text: ${error.message}`)
		} finally {
			// Clear loading state
			improvingText = { ...improvingText, [categoryName]: false }
		}
	}

	async function persistAssessmentAiSettings() {
		if (!currentAssessment || !currentSubject) return

		const subjectIndex = subjects.findIndex(subject => subject.id === currentSubject.id)
		if (subjectIndex === -1) return

		const assessmentIndex = subjects[subjectIndex].assessments.findIndex(assessment => assessment.id === currentAssessment.id)
		if (assessmentIndex === -1) return

		subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
		await saveSubjects()
	}

	async function persistGlobalAiSettings() {
		await saveSubjects()
		showSuccessNotification('Global AI system instructions saved.')
	}

	function getDocumentTypeLabel(value, scope = 'assessment') {
		const options = scope === 'student' ? STUDENT_DOCUMENT_TYPES : ASSESSMENT_DOCUMENT_TYPES
		return options.find(option => option.value === value)?.label || value
	}

	function buildQuickAddAiInstructionDefaults() {
		const defaults = {}
		const perAnswerMap = currentAssessment?.aiAnswerInstructionsByCategory || {}
		Object.entries(perAnswerMap).forEach(([key, value]) => {
			defaults[key] = String(value || '')
		})
		for (const category of currentAssessment?.categories || []) {
			const mappedValue = perAnswerMap[category.name] ?? perAnswerMap[normalizeCategoryName(category.name)]
			defaults[category.name] = mappedValue ?? (category.aiAnswerInstructions || '')
		}
		return defaults
	}

	function setCategoryAiInstruction(categoryName, instructionValue) {
		const nextValue = String(instructionValue || '')
		quickAddAiInstructions = {
			...quickAddAiInstructions,
			[categoryName]: nextValue
		}
	}

	async function persistCategoryAiInstruction(categoryName, instructionValue = null) {
		if (!currentAssessment || !currentAssessmentId || !currentSubjectId) return
		const nextValue = instructionValue ?? quickAddAiInstructions[categoryName] ?? ''
		if (quickAddInstructionSaveTimers[categoryName]) {
			clearTimeout(quickAddInstructionSaveTimers[categoryName])
			delete quickAddInstructionSaveTimers[categoryName]
		}
		setCategoryAiInstruction(categoryName, nextValue)

		const nextPerAnswerMap = {
			...(currentAssessment.aiAnswerInstructionsByCategory || {}),
			[categoryName]: String(nextValue),
			[normalizeCategoryName(categoryName)]: String(nextValue)
		}

		let updatedCategories = currentAssessment.categories || []

		const categoryIndex = (currentAssessment.categories || []).findIndex(
			category => normalizeCategoryName(category.name) === normalizeCategoryName(categoryName)
		)
		if (categoryIndex !== -1) {
			updatedCategories = [...updatedCategories]
			updatedCategories[categoryIndex] = {
				...updatedCategories[categoryIndex],
				aiAnswerInstructions: String(nextValue)
			}
		}

		currentAssessment = {
			...currentAssessment,
			categories: updatedCategories,
			aiAnswerInstructionsByCategory: nextPerAnswerMap
		}

		const subjectIndex = subjects.findIndex(subject => subject.id === currentSubjectId)
		if (subjectIndex === -1) return

		const assessmentIndex = subjects[subjectIndex].assessments.findIndex(assessment => assessment.id === currentAssessmentId)
		if (assessmentIndex === -1) return

		subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
		await saveSubjects()
	}

	function updateAssessmentReferenceDocuments(nextDocuments) {
		assessmentReferenceDocuments = nextDocuments
		if (currentAssessment) {
			currentAssessment.aiReferenceDocuments = nextDocuments
			currentAssessment.aiVectorIndex = null
		}
		assessmentVectorIndex = null
	}

	function updateStudentSubmissionDocuments(nextDocuments) {
		studentSubmissionDocuments = nextDocuments
	}

	function getCombinedStudentSubmissionText() {
		const sections = []

		if (studentSubmissionText.trim()) {
			sections.push(studentSubmissionText.trim())
		}

		studentSubmissionDocuments.forEach(document => {
			if (!document?.extractedText) return
			sections.push([
				`${getDocumentTypeLabel(document.documentType, 'student')}: ${document.name}`,
				document.extractedText
			].join('\n'))
		})

		return sections.join('\n\n')
	}

	function buildCurrentStudentEvaluationData() {
		return {
			studentId: currentStudentId,
			assessmentId: currentAssessmentId,
			paragraphs: [...paragraphs],
			studentName: studentName,
			studentSubmissionText: studentSubmissionText.trim(),
			studentImage: studentPhoto || '',
			categoryMarks: { ...categoryMarks },
			manualTotalMarks: currentAssessment?.totalMarks ?? manualTotalMarks,
			quickAddText: { ...quickAddText },
			savedAt: new Date().toISOString()
		}
	}

	async function persistCurrentStudentEvaluationData() {
		if (!currentStudentId || !currentAssessmentId) return false

		const evaluationData = buildCurrentStudentEvaluationData()
		try {
			await invoke('write_student_evaluation', {
				data: JSON.stringify(evaluationData),
				studentId: currentStudentId,
				assessmentId: currentAssessmentId
			})
			return true
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			try {
				const key = `student-evaluation-${currentStudentId}-${currentAssessmentId}`
				localStorage.setItem(key, JSON.stringify(evaluationData))
				return true
			} catch (storageError) {
				console.error('Failed to persist student evaluation in browser storage', storageError)
				return false
			}
		}
	}

	async function handleAssessmentReferenceUpload(event) {
		const input = event.currentTarget
		const files = Array.from(input?.files || [])
		if (!currentAssessment || files.length === 0) return

		uploadingAssessmentDocument = true
		try {
			const uploadedDocuments = []
			for (const file of files) {
				const extractedText = await extractTextFromFile(file)
				if (!extractedText) {
					throw new Error(`No readable text found in ${file.name}`)
				}

				uploadedDocuments.push(createUploadedDocumentRecord({
					file,
					extractedText,
					documentType: selectedAssessmentDocumentType,
					scope: 'assessment'
				}))
			}

			updateAssessmentReferenceDocuments([...assessmentReferenceDocuments, ...uploadedDocuments])
			await saveAssessmentData({ force: Boolean(currentStudentId), skipSelections: true })
			showSuccessNotification(`✅ Added ${uploadedDocuments.length} assessment reference file${uploadedDocuments.length === 1 ? '' : 's'} for AI marking.`)
		} catch (error) {
			console.error('Failed to upload assessment reference file:', error)
			showSuccessNotification(`❌ Upload failed: ${error.message}`)
		} finally {
			uploadingAssessmentDocument = false
			if (input) {
				input.value = ''
			}
		}
	}

	async function removeAssessmentReferenceDocument(documentId) {
		updateAssessmentReferenceDocuments(assessmentReferenceDocuments.filter(document => document.id !== documentId))
		await saveAssessmentData({ force: Boolean(currentStudentId), skipSelections: true })
		showSuccessNotification('Assessment reference removed.')
	}

	async function handleStudentSubmissionUpload(event) {
		const input = event.currentTarget
		if (!currentStudentId) {
			showSuccessNotification('⚠️ Select a student before uploading student files.')
			if (input) {
				input.value = ''
			}
			return
		}

		const files = Array.from(input?.files || [])
		if (files.length === 0) return

		uploadingStudentDocument = true
		try {
			const uploadedDocuments = []
			for (const file of files) {
				const extractedText = await extractTextFromFile(file)
				if (!extractedText) {
					throw new Error(`No readable text found in ${file.name}`)
				}

				uploadedDocuments.push(createUploadedDocumentRecord({
					file,
					extractedText,
					documentType: selectedStudentDocumentType,
					scope: 'student'
				}))
			}

			updateStudentSubmissionDocuments([...studentSubmissionDocuments, ...uploadedDocuments])
			await saveAssessmentData({ force: true, skipSelections: true })
			showSuccessNotification(`✅ Added ${uploadedDocuments.length} assessment input file${uploadedDocuments.length === 1 ? '' : 's'} for AI marking.`)
		} catch (error) {
			console.error('Failed to upload student submission file:', error)
			showSuccessNotification(`❌ Upload failed: ${error.message}`)
		} finally {
			uploadingStudentDocument = false
			if (input) {
				input.value = ''
			}
		}
	}

	async function removeStudentSubmissionDocument(documentId) {
		updateStudentSubmissionDocuments(studentSubmissionDocuments.filter(document => document.id !== documentId))
		await saveAssessmentData({ force: true, skipSelections: true })
		showSuccessNotification('Assessment input upload removed.')
	}

	async function buildAssessmentRetrievalIndex() {
		if (!currentAssessment) {
			showSuccessNotification('⚠️ Select an assessment first.')
			return
		}

		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		buildingAssessmentVectorIndex = true
		try {
			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs, forceRebuild: true })
			showSuccessNotification('✨ Assessment retrieval index built successfully.')
		} catch (error) {
			console.error('Failed to build assessment retrieval index:', error)
			showSuccessNotification(`❌ Failed to build retrieval index: ${error.message}`)
		} finally {
			buildingAssessmentVectorIndex = false
		}
	}

	function getSelectedEvidenceNotes(categoryName = '') {
		const targetCategory = String(categoryName || '').trim().toLowerCase()
		const selectedTexts = []
		for (const selectedId of selectedParagraphs) {
			const paragraph = paragraphs.find(item => item.id === selectedId)
			const rawText = typeof paragraph === 'string' ? paragraph : paragraph?.text
			if (targetCategory) {
				const paragraphCategory = extractCategoryFromParagraphText(rawText || '').trim().toLowerCase()
				if (paragraphCategory !== targetCategory) {
					continue
				}
			}
			const cleanText = stripHtmlTags(rawText || '').trim()
			if (cleanText) {
				selectedTexts.push(cleanText)
			}
		}

		return selectedTexts.join('\n')
	}

	async function loadPriorAssessmentEvaluations() {
		const priorEvaluations = []

		for (const student of students) {
			if (!student?.id || student.id === currentStudentId) continue

			let evaluationData = null
			try {
				const data = await invoke('read_student_evaluation', {
					studentId: student.id,
					assessmentId: currentAssessmentId
				})
				if (data) {
					evaluationData = JSON.parse(String(data))
				}
			} catch (error) {
				const key = `student-evaluation-${student.id}-${currentAssessmentId}`
				const data = localStorage.getItem(key)
				if (data) {
					evaluationData = JSON.parse(data)
				}
			}

			if (!evaluationData) continue

			const hasMarks = Object.keys(evaluationData.categoryMarks || {}).length > 0
			const hasParagraphs = Array.isArray(evaluationData.paragraphs) && evaluationData.paragraphs.length > 0
			if (!hasMarks && !hasParagraphs) continue

			priorEvaluations.push({
				...evaluationData,
				studentDisplayName: student.displayName || student.name || student.id
			})
		}

		return priorEvaluations
	}

	function getCurrentAssessmentForAi() {
		return {
			...currentAssessment,
			rubricHtml: assessmentHtml || currentAssessment?.rubricHtml || ''
		}
	}

	async function ensureAssessmentVectorIndex({ priorEvaluations = [], assessmentParagraphs = [], forceRebuild = false } = {}) {
		const assessmentForAi = getCurrentAssessmentForAi()
		let vectorIndex = assessmentVectorIndex
		const indexIsCurrent = !forceRebuild && isAssessmentVectorIndexCurrent(vectorIndex, {
			assessment: assessmentForAi,
			assessmentParagraphs,
			priorEvaluations
		})

		if (!indexIsCurrent) {
			vectorIndex = await buildAssessmentVectorIndex({
				assessment: assessmentForAi,
				assessmentParagraphs,
				priorEvaluations
			})
			assessmentVectorIndex = vectorIndex
			currentAssessment.aiVectorIndex = vectorIndex
			await saveAssessmentData({ force: true, skipSelections: true })
		}

		return { assessmentForAi, vectorIndex }
	}

	async function improveTextWithRag(categoryName) {
		const shortText = stripHtmlTags((quickAddText[categoryName] || '').trim())
		const answerInstructions = (quickAddAiInstructions[categoryName] || '').trim()
		if (!shortText) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		improvingTextWithRag = { ...improvingTextWithRag, [categoryName]: true }

		try {
			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			const { assessmentForAi, vectorIndex } = await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs })
			const result = await improveFeedbackWithRag({
				assessment: assessmentForAi,
				categoryName,
				shortFeedback: shortText,
				answerInstructions,
				student: getCurrentStudent(),
				studentSubmission: getCombinedStudentSubmissionText(),
				evidenceNotes: getSelectedEvidenceNotes(categoryName),
				assessmentParagraphs,
				priorEvaluations,
				vectorIndex,
				globalSystemInstructions: globalAiSystemInstructions
			})

			const cleanedText = stripHtmlTags(result.improvedText || '').trim()
			if (!cleanedText) {
				throw new Error('No improved feedback was returned.')
			}

			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification(`✨ Feedback expanded with RAG (${result.retrievalMode || 'context'}). Review before adding.`)
		} catch (error) {
			console.error('Failed to improve text with RAG:', error)
			showSuccessNotification(`❌ Failed to improve with RAG: ${error.message}`)
		} finally {
			improvingTextWithRag = { ...improvingTextWithRag, [categoryName]: false }
		}
	}

	async function runEvidenceCheck(categoryName) {
		if (!currentStudentId) {
			showSuccessNotification('⚠️ Please select a student first.')
			return
		}

		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		const answerInstructions = (quickAddAiInstructions[categoryName] || '').trim()
		const studentSubmission = getCombinedStudentSubmissionText()
		const evidenceNotes = getSelectedEvidenceNotes(categoryName)

		if (!studentSubmission && !evidenceNotes) {
			showSuccessNotification('⚠️ Add student submission text, upload student files, or select evidence notes first.')
			return
		}

		evidenceCheckingText = { ...evidenceCheckingText, [categoryName]: true }

		try {
			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			const { assessmentForAi, vectorIndex } = await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs })
			const result = await generateEvidenceCheckReport({
				assessment: assessmentForAi,
				categoryName,
				student: getCurrentStudent(),
				studentSubmission,
				evidenceNotes,
				assessmentParagraphs,
				priorEvaluations,
				vectorIndex,
				globalSystemInstructions: globalAiSystemInstructions,
				answerInstructions
			})

			const cleanedText = stripHtmlTags(result.reportText || '').trim()
			if (!cleanedText) {
				throw new Error('No evidence-check report was returned.')
			}

			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification(`✅ Evidence check generated (${result.retrievalMode || 'context'}).`)
		} catch (error) {
			console.error('Failed to run evidence check:', error)
			showSuccessNotification(`❌ Evidence check failed: ${error.message}`)
		} finally {
			evidenceCheckingText = { ...evidenceCheckingText, [categoryName]: false }
		}
	}

	async function draftFeedbackWithAI() {
		if (!currentStudentId) {
			showSuccessNotification('⚠️ Please select a student first.')
			return
		}

		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		if (!currentAssessment?.categories || currentAssessment.categories.length === 0) {
			showSuccessNotification('⚠️ Add assessment categories before generating AI feedback.')
			return
		}

		const studentSubmission = getCombinedStudentSubmissionText()
		const evidenceNotes = getSelectedEvidenceNotes()

		if (!studentSubmission && !evidenceNotes) {
			showSuccessNotification('⚠️ Add student submission text, upload a student report, or select some evidence paragraphs first.')
			return
		}

		aiDraftingFeedback = true
		aiDraftOverallFeedback = ''
		aiDraftRetrievedContext = []

		try {
			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			const { assessmentForAi, vectorIndex } = await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs })

			const result = await generateStructuredMarkingDraft({
				assessment: assessmentForAi,
				student: getCurrentStudent(),
				globalSystemInstructions: globalAiSystemInstructions,
				studentSubmission,
				evidenceNotes,
				assessmentParagraphs,
				priorEvaluations,
				vectorIndex
			})

			const reviewItems = result.criteria.map(criterionDraft => {
				const matchedCategory = findCriterionByName(currentAssessment.categories, criterionDraft.criterion_name)
				if (!matchedCategory) return null

				const suggestedFeedback = stripHtmlTags(criterionDraft.suggested_feedback || '').trim()
				const numericMark = Number(criterionDraft.awarded_mark)
				let boundedMark = null
				if (Number.isFinite(numericMark)) {
					const maxMark = Number(matchedCategory.allocatedMarks)
					boundedMark = Number.isFinite(maxMark)
						? Math.min(Math.max(numericMark, 0), maxMark)
						: Math.max(numericMark, 0)
				}

				return {
					criterion_name: criterionDraft.criterion_name,
					matchedCategoryName: matchedCategory.name,
					awarded_mark: boundedMark,
					judgement: stripHtmlTags(criterionDraft.judgement || '').trim(),
					evidence: Array.isArray(criterionDraft.evidence) ? criterionDraft.evidence.map(item => stripHtmlTags(item || '').trim()).filter(Boolean) : [],
					improvement_advice: stripHtmlTags(criterionDraft.improvement_advice || '').trim(),
					suggested_feedback: suggestedFeedback,
					applyMark: boundedMark !== null,
					applyFeedback: Boolean(suggestedFeedback)
				}
			}).filter(Boolean)

			aiDraftOverallFeedback = result.overall_feedback || ''
			aiDraftRetrievedContext = result.retrievedContext || []
			aiRetrievalMode = result.retrievalMode || ''
			aiDraftReviewItems = reviewItems
			showAiDraftReviewModal = true
			showSuccessNotification('✨ AI draft generated. Review each criterion before applying.')
		} catch (error) {
			console.error('Failed to draft feedback with AI:', error)
			showSuccessNotification(`❌ Failed to generate AI feedback: ${error.message}`)
		} finally {
			aiDraftingFeedback = false
		}
	}

	function toggleAiDraftReviewItem(index, field) {
		aiDraftReviewItems = aiDraftReviewItems.map((item, itemIndex) => itemIndex === index
			? { ...item, [field]: !item[field] }
			: item)
	}

	function closeAiDraftReviewModal() {
		showAiDraftReviewModal = false
	}

	function closePromptPreviewModal() {
		showPromptPreviewModal = false
		promptPreviewTitle = ''
		promptPreviewMessages = []
	}

	async function viewFinalPrompt(categoryName, mode = 'ai') {
		const shortText = stripHtmlTags((quickAddText[categoryName] || '').trim())
		const answerInstructions = (quickAddAiInstructions[categoryName] || '').trim()

		if (!shortText) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		try {
			if (mode === 'ai') {
				promptPreviewMessages = buildImproveEnglishPromptPreview(shortText, answerInstructions)
				promptPreviewTitle = `Improve Prompt - ${categoryName}`
				showPromptPreviewModal = true
				return
			}

			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			const { assessmentForAi, vectorIndex } = await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs })
			const preview = await buildImproveFeedbackWithRagPromptPreview({
				assessment: assessmentForAi,
				categoryName,
				shortFeedback: shortText,
				answerInstructions,
				student: getCurrentStudent(),
				studentSubmission: getCombinedStudentSubmissionText(),
				evidenceNotes: getSelectedEvidenceNotes(categoryName),
				assessmentParagraphs,
				priorEvaluations,
				vectorIndex,
				globalSystemInstructions: globalAiSystemInstructions
			})

			promptPreviewMessages = preview.messages
			promptPreviewTitle = `RAG Prompt - ${categoryName}`
			showPromptPreviewModal = true
		} catch (error) {
			console.error('Failed to build prompt preview:', error)
			showSuccessNotification(`❌ Failed to build prompt preview: ${error.message}`)
		}
	}

	function applyAiDraftReviewSelections() {
		const nextQuickAddText = { ...quickAddText }
		const nextCategoryMarks = { ...categoryMarks }

		aiDraftReviewItems.forEach(item => {
			if (item.applyFeedback && item.suggested_feedback) {
				nextQuickAddText[item.matchedCategoryName] = item.suggested_feedback
			}

			if (item.applyMark && item.awarded_mark !== null && item.awarded_mark !== undefined) {
				nextCategoryMarks[item.matchedCategoryName] = item.awarded_mark
			}
		})

		quickAddText = nextQuickAddText
		categoryMarks = nextCategoryMarks
		showAiDraftReviewModal = false
		refreshCategoryWarnings()
		showSuccessNotification('AI draft selections applied. Review and save when ready.')
	}

	function quickAddParagraph(categoryName) {
		const text = (quickAddText[categoryName] || '').trim()
		if (!stripHtmlTags(text)) return

		let paragraphText = text
		if (categoryName) {
			paragraphText = `${categoryName}: ${paragraphText}`
		}

		const knowledgeArea = quickAddKnowledgeArea[categoryName]
		if (knowledgeArea) {
			paragraphText = `${paragraphText} - ${knowledgeArea}`
		}

		const newPara = {
			id: generateId(),
			text: paragraphText,
			color: undefined,
			subjectId: currentSubjectId,
			assessmentId: currentAssessmentId
		}

		paragraphs.push(newPara)

		// Automatically select the newly added paragraph
		selectedParagraphs.add(newPara.id)
		selectedParagraphs = new Set(selectedParagraphs) // Trigger reactivity

		quickAddText = { ...quickAddText, [categoryName]: '' }
		// Clear AI-improved flag when paragraph is added
		aiImprovedText = { ...aiImprovedText, [categoryName]: false }

		const addToAssessment = currentStudentId && quickAddToAssessmentWhenStudentSelected

		if (addToAssessment) {
			saveAssessmentData({ force: true, skipSelections: true })
		} else {
			saveAssessmentData()
		}

		if (currentStudentId && !addToAssessment) {
			saveStudentParagraphs()
		}
		refreshCategoryWarnings()
	}

	function applyFormattingToQuickAdd(categoryName, { openTag, closeTag }) {
		const textarea = document.getElementById(quickAddInputId(categoryName))
		if (!(textarea instanceof HTMLTextAreaElement)) return

		const currentValue = quickAddText[categoryName] || ''
		const start = textarea.selectionStart ?? currentValue.length
		const end = textarea.selectionEnd ?? currentValue.length
		const selected = currentValue.slice(start, end)
		const wrapped = `${openTag}${selected}${closeTag}`
		const nextValue = `${currentValue.slice(0, start)}${wrapped}${currentValue.slice(end)}`

		quickAddText = { ...quickAddText, [categoryName]: nextValue }
		aiImprovedText = { ...aiImprovedText, [categoryName]: false }

		setTimeout(() => {
			const updatedTextarea = document.getElementById(quickAddInputId(categoryName))
			if (!(updatedTextarea instanceof HTMLTextAreaElement)) return
			updatedTextarea.focus()
			const nextCursor = start + wrapped.length
			updatedTextarea.setSelectionRange(nextCursor, nextCursor)
		}, 0)
	}

	function applyBoldToQuickAdd(categoryName) {
		applyFormattingToQuickAdd(categoryName, {
			openTag: '<strong>',
			closeTag: '</strong>'
		})
	}

	function applyColorToQuickAdd(categoryName, colorValue) {
		const color = colorValue || '#0d6efd'
		quickAddColorPicker = { ...quickAddColorPicker, [categoryName]: color }
		applyFormattingToQuickAdd(categoryName, {
			openTag: `<span style="color:${color};">`,
			closeTag: '</span>'
		})
	}

	function sendParagraphToAiInput(paragraphText, categoryName, knowledgeAreaName = '') {
		copyToQuickAdd(paragraphText, categoryName)
		if (knowledgeAreaName && knowledgeAreaName !== 'No Knowledge Area') {
			quickAddKnowledgeArea = {
				...quickAddKnowledgeArea,
				[categoryName]: knowledgeAreaName
			}
		}
		showSuccessNotification('Paragraph loaded into AI-supported input for editing.')
	}

	// Copy paragraph text to quick-add box for customization
	function copyToQuickAdd(paragraphText, categoryName) {
		// Extract the main text without category prefix and knowledge area suffix
		const mainText = extractMainTextFromParagraph(paragraphText)

		// Remove the source paragraph from the list since it will be re-added after editing
		const paragraphIndex = paragraphs.findIndex(p => {
			const pText = typeof p === 'string' ? p : p.text
			return pText === paragraphText
		})
		if (paragraphIndex !== -1) {
			const paragraphId = paragraphs[paragraphIndex].id
			paragraphs = paragraphs.filter((_, i) => i !== paragraphIndex)
			// Also remove from selections if selected
			if (selectedParagraphs.has(paragraphId)) {
				selectedParagraphs = new Set([...selectedParagraphs].filter(id => id !== paragraphId))
			}
		}

		// Set the text in the quick-add box for this category
		quickAddText = { ...quickAddText, [categoryName]: mainText }

		// Clear AI-improved flag
		aiImprovedText = { ...aiImprovedText, [categoryName]: false }

		// Focus the textarea
		setTimeout(() => {
			const textareaId = quickAddInputId(categoryName)
			const textarea = document.getElementById(textareaId)
			if (textarea instanceof HTMLTextAreaElement) {
				textarea.focus()
				// Move cursor to end
				textarea.setSelectionRange(mainText.length, mainText.length)
			}
		}, 100)
	}

	/**
	 * Import paragraphs from other assignments to text box for editing
	 */
	function importParagraphs(event) {
		const { paragraphs: importedParagraphs } = event.detail
		
		if (importedParagraphs && importedParagraphs.length > 0) {
			// Combine all imported paragraphs into text for the text box
			const combinedText = importedParagraphs.map(para => para.text).join('\n\n')
			
			// Add to existing text in the text box (if any)
			if (newParagraph.trim()) {
				newParagraph = newParagraph + '\n\n' + combinedText
			} else {
				newParagraph = combinedText
			}
			
			// Show success notification
			notificationMessage = `Imported ${importedParagraphs.length} paragraph${importedParagraphs.length !== 1 ? 's' : ''} to text box for editing`
			showNotification = true
			setTimeout(() => showNotification = false, 3000)
		}
	}

	function addCategory() {
		if (newCategoryName.trim() && currentAssessment) {
			// Ensure categories array exists
			if (!currentAssessment.categories) {
				currentAssessment.categories = []
			}

			const isPercentageMode = newCategoryMarkingMode === 'percentage'
			const parsedAllocated = parseFloat(newCategoryAllocatedMarks)
			const hasValidAllocatedMarks = !isPercentageMode || (!Number.isNaN(parsedAllocated) && parsedAllocated > 0)
			if (!hasValidAllocatedMarks) {
				return
			}

			const newCategory = {
				id: Date.now().toString(),
				name: newCategoryName.trim(),
				knowledgeLevel: newCategoryKnowledgeArea.trim() || undefined,
				markingMode: newCategoryMarkingMode || 'none',
				order: currentAssessment.categories.length, // Set order as the next index
				allocatedMarks: isPercentageMode ? parsedAllocated : undefined,
				colorMarks: {} // For fixed marking mode: { colorName: markValue }
			}

				currentAssessment.categories = normalizeCategoryOrder([...currentAssessment.categories, newCategory])
			newCategoryName = ''
			newCategoryKnowledgeArea = ''
			newCategoryAllocatedMarks = ''
			
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
				currentAssessment.categories = normalizeCategoryOrder(
					currentAssessment.categories.filter(cat => cat.id !== categoryId)
				)
			
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

	function openCategoryEditModal(category) {
		editingCategory = { ...category }
		if (!editingCategory.markingMode) {
			editingCategory.markingMode = 'none'
		}
		showCategoryEditModal = true
	}

	function saveCategoryEdit() {
		if (!editingCategory || !currentAssessment) return

		const normalizedCategory = { ...editingCategory }
		if (normalizedCategory.markingMode === 'percentage') {
			const parsed = parseFloat(normalizedCategory.allocatedMarks)
			normalizedCategory.allocatedMarks = Number.isNaN(parsed) ? undefined : parsed
		} else {
			normalizedCategory.allocatedMarks = undefined
		}

		const categoryIndex = currentAssessment.categories.findIndex(c => c.id === editingCategory.id)
		if (categoryIndex !== -1) {
			currentAssessment.categories[categoryIndex] = normalizedCategory

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

		showCategoryEditModal = false
		editingCategory = null
	}

	// Get the effective marking mode for a category (category override or assessment default)
	function getEffectiveMarkingMode(categoryName) {
		if (!currentAssessment) return 'none'

		const category = currentAssessment.categories?.find(c => c.name === categoryName)
		if (category?.markingMode) {
			return category.markingMode
		}

		return currentAssessment.markingMode || 'none'
	}

	function getCategoryColorMarkValue(categoryName, color) {
		if (!currentAssessment?.categories || !categoryName || !color) return undefined
		const category = currentAssessment.categories.find(cat => cat.name === categoryName)
		if (!category) return undefined
		return category.colorMarks ? category.colorMarks[color] : undefined
	}

	function getCategoryMarkingMode(categoryName) {
		if (!currentAssessment?.categories || !categoryName) return 'none'
		const category = currentAssessment.categories.find(cat => cat.name === categoryName)
		return category?.markingMode || 'none'
	}

	function updateCategoryColorMark(categoryName, color, markValue) {
		if (!currentAssessment?.categories || !categoryName || !color) return

		const categoryIndex = currentAssessment.categories.findIndex(cat => cat.name === categoryName)
		if (categoryIndex === -1) return

		const category = currentAssessment.categories[categoryIndex]
		const updatedColorMarks = { ...(category.colorMarks || {}) }

		const isEmpty =
			markValue === undefined ||
			markValue === null ||
			(typeof markValue === 'string' && markValue.trim() === '')

		if (isEmpty) {
			delete updatedColorMarks[color]
		} else {
			updatedColorMarks[color] = markValue
		}

		const updatedCategory = { ...category, colorMarks: updatedColorMarks }
		const updatedCategories = [...currentAssessment.categories]
		updatedCategories[categoryIndex] = updatedCategory
		currentAssessment = { ...currentAssessment, categories: updatedCategories }

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

		refreshCategoryWarnings()
	}

	function persistSelectedColorMark(valueOverride = null) {
		if (getEffectiveMarkingMode(selectedCategory) !== 'fixed' || !selectedCategory || !selectedColor) return

		const rawValue = valueOverride !== null && valueOverride !== undefined ? valueOverride : selectedColorMark
		const stringValue = rawValue !== undefined && rawValue !== null ? rawValue.toString().trim() : ''

		if (stringValue === '') {
			updateCategoryColorMark(selectedCategory, selectedColor, undefined)
			return
		}

		const numericValue = Number(stringValue)
		const valueToStore = Number.isNaN(numericValue) ? stringValue : numericValue
		updateCategoryColorMark(selectedCategory, selectedColor, valueToStore)
	}

	function handleColorMarkChange(event) {
		persistSelectedColorMark(event.currentTarget.value)
	}

	$effect(() => {
		const effectiveMode = getEffectiveMarkingMode(selectedCategory)
		const hasColorSelection = effectiveMode === 'fixed' && selectedCategory && selectedColor && currentAssessment
		const storedMark = hasColorSelection ? getCategoryColorMarkValue(selectedCategory, selectedColor) : undefined
		const signature = hasColorSelection
			? `${currentAssessment.id}-${selectedCategory}-${selectedColor}-${storedMark ?? 'unset'}`
			: ''

		if (signature !== lastColorSelectionSignature) {
			lastColorSelectionSignature = signature

			if (signature) {
				selectedColorMark = storedMark !== undefined && storedMark !== null ? storedMark.toString() : ''
			} else if (selectedColorMark !== '') {
				selectedColorMark = ''
			}
		}
	})

	$effect(() => {
		currentCategoryMarkingMode = selectedCategory ? getEffectiveMarkingMode(selectedCategory) : 'none'
	})

	$effect(() => {
		if (!currentAssessment?.categories || currentAssessment.categories.length === 0) return

		if (!selectedCategory) {
			const sortedCategories = currentAssessment.categories.slice().sort((a, b) => {
				const orderA = a.order ?? 999
				const orderB = b.order ?? 999
				return orderA - orderB
			})
			if (sortedCategories.length > 0) {
				selectedCategory = sortedCategories[0].name
			}
		}
		})

		// Category reordering functions
		function normalizeCategoryOrder(categories) {
			if (!categories || categories.length === 0) return []
			return categories
				.slice()
				.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
				.map((cat, index) => ({ ...cat, order: index }))
		}

		function normalizeCategoryName(value) {
			return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
		}

		function moveCategoryUp(categoryId) {
			if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
			
			const normalized = normalizeCategoryOrder(currentAssessment.categories)
			const index = normalized.findIndex(cat => cat.id === categoryId || normalizeCategoryName(cat.name) === normalizeCategoryName(categoryId))
			if (index <= 0) return

			const swapped = [...normalized]
			;[swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]]

			const reordered = swapped.map((cat, idx) => ({ ...cat, order: idx }))
			currentAssessment = { ...currentAssessment, categories: reordered }
				
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

		function moveCategoryDown(categoryId) {
			if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
			
			const normalized = normalizeCategoryOrder(currentAssessment.categories)
			const index = normalized.findIndex(cat => cat.id === categoryId || normalizeCategoryName(cat.name) === normalizeCategoryName(categoryId))
			if (index === -1 || index >= normalized.length - 1) return

			const swapped = [...normalized]
			;[swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]]

			const reordered = swapped.map((cat, idx) => ({ ...cat, order: idx }))
			currentAssessment = { ...currentAssessment, categories: reordered }
				
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

	// Paragraph reordering functions
	function extractCategoryFromParagraphText(paragraphText) {
		const text = typeof paragraphText === 'string' ? paragraphText : ''
		if (!text.includes(': ')) return 'General Feedback'
		const prefix = text.split(': ')[0]?.trim() || ''
		if (!prefix) return 'General Feedback'
		if (prefix.includes(' - ')) {
			const parts = prefix.split(' - ')
			return parts[1]?.trim() || 'General Feedback'
		}
		return prefix
	}

	function getCategoryParagraphIndices(categoryName) {
		const target = normalizeCategoryName(categoryName)
		const group = getGroupedParagraphs().find(item => normalizeCategoryName(item.category) === target)
		if (!group) return []

		const indices = []
		Object.values(group.knowledgeAreas || {}).forEach(paragraphsInArea => {
			paragraphsInArea.forEach(entry => {
				const resolvedIndex = resolveParagraphMainIndex(entry)
				if (resolvedIndex !== -1) {
					indices.push(resolvedIndex)
				}
			})
		})

		return Array.from(new Set(indices)).sort((a, b) => a - b)
	}

	function getParagraphPositionInCategory(categoryName, originalIndex) {
		const categoryIndices = getCategoryParagraphIndices(categoryName)
		return categoryIndices.findIndex(index => index === originalIndex)
	}

	function moveParagraphUpInCategory(originalIndex, categoryName) {
		if (currentStudentId) return
		const categoryIndices = getCategoryParagraphIndices(categoryName)
		const position = categoryIndices.findIndex(index => index === originalIndex)
		if (position <= 0) return
		const currentIndex = categoryIndices[position]
		const previousIndex = categoryIndices[position - 1]
		if (currentIndex < 0 || previousIndex < 0) return
		;[paragraphs[currentIndex], paragraphs[previousIndex]] = [paragraphs[previousIndex], paragraphs[currentIndex]]
		paragraphs.forEach((para, index) => {
			if (typeof para === 'object' && para.id) para.order = index
		})
		saveAssessmentData()
	}

	function moveParagraphDownInCategory(originalIndex, categoryName) {
		if (currentStudentId) return
		const categoryIndices = getCategoryParagraphIndices(categoryName)
		const position = categoryIndices.findIndex(index => index === originalIndex)
		if (position === -1 || position >= categoryIndices.length - 1) return
		const currentIndex = categoryIndices[position]
		const nextIndex = categoryIndices[position + 1]
		if (currentIndex < 0 || nextIndex < 0) return
		;[paragraphs[currentIndex], paragraphs[nextIndex]] = [paragraphs[nextIndex], paragraphs[currentIndex]]
		paragraphs.forEach((para, index) => {
			if (typeof para === 'object' && para.id) para.order = index
		})
		saveAssessmentData()
	}

	function moveParagraphUp(paragraphId, displayIndex, groupParagraphs) {
		if (currentStudentId) return // Only in assignment mode

		// Move within the displayed group context
		if (displayIndex > 0) {
			const currentEntry = groupParagraphs[displayIndex]
			const previousEntry = groupParagraphs[displayIndex - 1]

			// Find their positions in the main paragraphs array
			const currentIndex = resolveParagraphMainIndex(currentEntry)
			const previousIndex = resolveParagraphMainIndex(previousEntry)

			if (currentIndex !== -1 && previousIndex !== -1 && currentIndex !== previousIndex) {
				// Swap in the main array
				[paragraphs[currentIndex], paragraphs[previousIndex]] = [paragraphs[previousIndex], paragraphs[currentIndex]]

				// Update order values
				paragraphs.forEach((para, index) => {
					if (typeof para === 'object' && para.id) {
						para.order = index
					}
				})

				saveAssessmentData()
			}
		}
	}

function moveParagraphDown(paragraphId, displayIndex, groupParagraphs) {
		if (currentStudentId) return // Only in assignment mode

		// Move within the displayed group context
		if (displayIndex < groupParagraphs.length - 1) {
			const currentEntry = groupParagraphs[displayIndex]
			const nextEntry = groupParagraphs[displayIndex + 1]

			// Find their positions in the main paragraphs array
			const currentIndex = resolveParagraphMainIndex(currentEntry)
			const nextIndex = resolveParagraphMainIndex(nextEntry)

			if (currentIndex !== -1 && nextIndex !== -1 && currentIndex !== nextIndex) {
				// Swap in the main array
				[paragraphs[currentIndex], paragraphs[nextIndex]] = [paragraphs[nextIndex], paragraphs[currentIndex]]

				// Update order values
				paragraphs.forEach((para, index) => {
					if (typeof para === 'object' && para.id) {
						para.order = index
					}
				})

				saveAssessmentData()
			}
		}
	}

	function addKnowledgeArea() {
		if (newKnowledgeAreaName.trim() && currentAssessment) {
			// Ensure knowledgeAreas array exists
			if (!currentAssessment.knowledgeAreas) {
				currentAssessment.knowledgeAreas = []
			}
			
			// Add knowledge area if it doesn't already exist
			if (!currentAssessment.knowledgeAreas.includes(newKnowledgeAreaName.trim())) {
				currentAssessment.knowledgeAreas = [...currentAssessment.knowledgeAreas, newKnowledgeAreaName.trim()]
				
				// Update the current subject's assessments
				if (currentSubject) {
					const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
					if (subjectIndex !== -1) {
						const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
						if (assessmentIndex !== -1) {
							subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
							console.log('Saving knowledge area to assessment:', newKnowledgeAreaName.trim(), 'Total knowledge areas:', currentAssessment.knowledgeAreas.length)
							saveSubjects()
						}
					}
				}
			}
			newKnowledgeAreaName = ''
		}
	}

	function removeKnowledgeArea(knowledgeArea) {
		if (currentAssessment && currentAssessment.knowledgeAreas) {
			currentAssessment.knowledgeAreas = currentAssessment.knowledgeAreas.filter(area => area !== knowledgeArea)
			
			// Update the current subject's assessments
			if (currentSubject) {
				const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
				if (subjectIndex !== -1) {
					const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
					if (assessmentIndex !== -1) {
						subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
						console.log('Removing knowledge area from assessment:', knowledgeArea, 'Remaining knowledge areas:', currentAssessment.knowledgeAreas.length)
						saveSubjects()
					}
				}
			}
		}
	}

	function paragraphMatchesCategory(paragraphText, category) {
		if (!paragraphText || !category) return false
		if (paragraphText.includes(': ')) {
			const parts = paragraphText.split(': ')
			if (parts.length >= 2 && parts[0].trim() === category) {
				return true
			}
		} else if (category === 'General Feedback') {
			return true
		}
		return false
	}

	function checkCategoryHasSelectedParagraphs(category) {
		// Check if any selected paragraphs belong to this category
		for (const selectedId of selectedParagraphs) {
			const paragraph = paragraphs.find(p => p.id === selectedId)
			if (paragraph) {
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				if (paragraphMatchesCategory(paragraphText, category)) {
					return true
				}
			}
		}
		return false
	}

	function getSelectedParagraphsInCategory(category, paragraphInfoIndex = null) {
		const results = []
		if (paragraphInfoIndex) {
			for (const selectedId of selectedParagraphs) {
				const paragraphInfo = paragraphInfoIndex[selectedId]
				if (paragraphInfo && paragraphInfo.category === category) {
					results.push(paragraphInfo)
				}
			}
			return results
		}

		for (const selectedId of selectedParagraphs) {
			const paragraph = paragraphs.find(p => p.id === selectedId)
			if (!paragraph) continue
			const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
			if (paragraphMatchesCategory(paragraphText, category)) {
				results.push(typeof paragraph === 'string' ? { text: paragraph, id: selectedId } : paragraph)
			}
		}
		return results
	}

	function parseNumericMarkValue(value) {
		if (value === undefined || value === null) return null
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : null
		}
		const stringValue = String(value)
		const match = stringValue.match(/-?\d+(\.\d+)?/)
		if (!match) return null
		const parsed = parseFloat(match[0])
		return Number.isFinite(parsed) ? parsed : null
	}

	function parseNumericRange(value) {
		if (value === undefined || value === null) return null
		const stringValue = String(value)
		const connectorMatch = stringValue.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to|through|thru)\s*(-?\d+(?:\.\d+)?)/i)
		if (connectorMatch) {
			const first = parseFloat(connectorMatch[1])
			const second = parseFloat(connectorMatch[2])
			if (Number.isFinite(first) && Number.isFinite(second)) {
				return {
					min: Math.min(first, second),
					max: Math.max(first, second)
				}
			}
		}

		const matches = stringValue.match(/-?\d+(?:\.\d+)?/g)
		if (!matches || matches.length < 2) return null
		const first = parseFloat(matches[0])
		const second = parseFloat(matches[1])
		if (!Number.isFinite(first) || !Number.isFinite(second)) return null
		return {
			min: Math.min(first, second),
			max: Math.max(first, second)
		}
	}

	function hasMarksValue(value) {
		if (value === undefined || value === null) return false
		return String(value).trim() !== ''
	}

	function getColorPercentageBounds(color) {
		if (!color) return null
		if (currentAssessment?.percentageRanges && currentAssessment.percentageRanges.length > 0) {
			const customRange = currentAssessment.percentageRanges.find(range => range.color === color)
			if (customRange) {
				return {
					lower: customRange.lowerPercentage / 100,
					upper: customRange.upperPercentage / 100
				}
			}
		}

		const defaultRanges = {
			green: { lower: 0.8, upper: 1.0 },
			lightgreen: { lower: 0.65, upper: 0.79 },
			yellow: { lower: 0.5, upper: 0.64 },
			orange: { lower: 0.4, upper: 0.49 },
			red: { lower: 0.0, upper: 0.39 }
		}
		return defaultRanges[color] || null
	}

	function doesCategoryRequireMarks(category) {
		const allocatedMarks = getCategoryAllocatedMarks(category)
		if (Number.isFinite(allocatedMarks) && allocatedMarks > 0) {
			return true
		}
		
		const effectiveMode = getEffectiveMarkingMode(category)
		return effectiveMode === 'fixed'
	}

	function getParagraphMarkExpectation(paragraph, category) {
		if (!paragraph || !category) return null
		const markInfo = paragraph.markInfo
		if (markInfo) {
			if (markInfo.type === 'fixed') {
				const inferredRange = parseNumericRange(markInfo.value)
				if (inferredRange) {
					return {
						type: 'range',
						min: inferredRange.min,
						max: inferredRange.max,
						color: markInfo.color || paragraph.color
					}
				}
				const numericValue = parseNumericMarkValue(markInfo.numericValue ?? markInfo.value)
				if (Number.isFinite(numericValue)) {
					return {
						type: 'fixed',
						value: numericValue,
						color: markInfo.color || paragraph.color
					}
				}
			} else if (markInfo.type === 'percentage') {
				const minValue = parseNumericMarkValue(markInfo.min)
				const maxValue = parseNumericMarkValue(markInfo.max)
				if (Number.isFinite(minValue) && Number.isFinite(maxValue)) {
					return {
						type: 'range',
						min: Math.min(minValue, maxValue),
						max: Math.max(minValue, maxValue),
						color: markInfo.color || paragraph.color
					}
				}
			}
		}

		const paragraphColor = paragraph.color
		const effectiveMode = getEffectiveMarkingMode(category)
		if (!paragraphColor || effectiveMode === 'none') return null

		if (effectiveMode === 'fixed') {
			const colorMark = getCategoryColorMarkValue(category, paragraphColor)
			const numericColorMark = parseNumericMarkValue(colorMark)
			if (!Number.isFinite(numericColorMark)) return null
			return {
				type: 'fixed',
				value: numericColorMark,
				color: paragraphColor
			}
		} else if (effectiveMode === 'percentage') {
			const allocatedMarks = getCategoryAllocatedMarks(category)
			const percentageBounds = getColorPercentageBounds(paragraphColor)
			if (!Number.isFinite(allocatedMarks) || !percentageBounds) return null
			const minMarks = Number((allocatedMarks * percentageBounds.lower).toFixed(2))
			const maxMarks = Number((allocatedMarks * percentageBounds.upper).toFixed(2))
			if (!Number.isFinite(minMarks) || !Number.isFinite(maxMarks)) return null
			return {
				type: 'range',
				min: Math.min(minMarks, maxMarks),
				max: Math.max(minMarks, maxMarks),
				color: paragraphColor
			}
		}

		return null
	}

	function isMarkWithinExpectation(markValue, expectation) {
		if (!expectation || !Number.isFinite(markValue)) return true
		const tolerance = 0.01
		if (expectation.type === 'fixed') {
			return Math.abs(markValue - expectation.value) <= tolerance
		}
		return markValue >= (expectation.min - tolerance) && markValue <= (expectation.max + tolerance)
	}

	function getCategoryMarkMismatchWarning(category, numericMarks, paragraphInfoIndex = null, selectedParasOverride = null) {
		const marksValue = Number.isFinite(numericMarks) ? numericMarks : Number(categoryMarks[category])
		if (!Number.isFinite(marksValue)) return null
		const selectedParas = selectedParasOverride || getSelectedParagraphsInCategory(category, paragraphInfoIndex)
		if (selectedParas.length === 0) return null

		for (const para of selectedParas) {
			const expectation = getParagraphMarkExpectation(para, category)
			if (!expectation) {
				continue
			}
			if (!isMarkWithinExpectation(marksValue, expectation)) {
				const expectedText = expectation.type === 'fixed'
					? `${expectation.value} mark${expectation.value === 1 ? '' : 's'}`
					: `${expectation.min} - ${expectation.max} marks`
				return {
					type: 'markMismatch',
					color: expectation.color,
					expected: expectedText
				}
			}
		}

		return null
	}

	function getCategoryWarningState(category, paragraphInfoIndex = null) {
		const marksValue = categoryMarks[category]
		const hasMarks = hasMarksValue(marksValue)
		const selectedParagraphsForCategory = getSelectedParagraphsInCategory(category, paragraphInfoIndex)
		const hasSelectedParagraphs = selectedParagraphsForCategory.length > 0

		if (hasMarks && !hasSelectedParagraphs) {
			return { type: 'missingParagraphs' }
		}

		if (doesCategoryRequireMarks(category) && hasSelectedParagraphs && !hasMarks) {
			return { type: 'missingMarks' }
		}

		if (hasMarks && hasSelectedParagraphs) {
			const parsedMarks = Number(marksValue)
			if (Number.isFinite(parsedMarks)) {
				const mismatchWarning = getCategoryMarkMismatchWarning(category, parsedMarks, paragraphInfoIndex, selectedParagraphsForCategory)
				if (mismatchWarning) {
					return mismatchWarning
				}
			}
		}

		return null
	}

	function refreshCategoryWarnings() {
		const categoriesToCheck = new Set(Object.keys(categoryMarks))
		if (currentAssessment?.categories) {
			currentAssessment.categories.forEach(cat => categoriesToCheck.add(cat.name))
		}

		const paragraphInfoIndex = buildParagraphInfoIndex()
		const nextWarnings = {}
		categoriesToCheck.forEach(category => {
			const warning = getCategoryWarningState(category, paragraphInfoIndex)
			if (warning) {
				nextWarnings[category] = warning
			}
		})

		categoryWarnings = nextWarnings
	}

	function updateCategoryMarks(category, marks) {
		categoryMarks[category] = marks
		categoryMarks = {...categoryMarks} // trigger reactivity
		
		refreshCategoryWarnings()
		
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
		refreshCategoryWarnings()
	}

	function getCategoryAllocatedMarks(categoryName) {
		if (!currentAssessment?.categories || !categoryName) return undefined
		const category = currentAssessment.categories.find(cat => cat.name === categoryName)
		if (!category) return undefined
		const rawValue = category.allocatedMarks
		if (rawValue === undefined || rawValue === null) return undefined
		const numericValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue
		return Number.isFinite(numericValue) ? numericValue : undefined
	}

	function getTotalMarks() {
		return Object.values(categoryMarks).reduce((total, marks) => {
			const numMarks = parseFloat(marks) || 0
			return total + numMarks
		}, 0)
	}

	function getAssessmentTotalInfo() {
		const numericTotal = Number(currentAssessment?.totalMarks)
		const hasValue = Number.isFinite(numericTotal) && numericTotal > 0
		return {
			value: hasValue ? numericTotal : 0,
			hasValue
		}
	}

	// Get the mark range/grade for the current student
	function getStudentMarkInfo() {
		const totalMarks = getTotalMarks()
		const assessmentTotal = currentAssessment?.totalMarks || 0

		if (totalMarks === 0) {
			return { display: 'No marks yet', color: 'secondary' }
		}

		// For percentage mode or when assessment has total marks
		if (assessmentTotal > 0) {
			const percentage = (totalMarks / assessmentTotal) * 100
			let grade = ''
			let color = ''

			if (percentage >= 80) {
				grade = 'A (Excellent)'
				color = 'success'
			} else if (percentage >= 65) {
				grade = 'B (Good)'
				color = 'info'
			} else if (percentage >= 50) {
				grade = 'C (Satisfactory)'
				color = 'warning'
			} else if (percentage >= 40) {
				grade = 'D (Pass)'
				color = 'warning'
			} else {
				grade = 'F (Fail)'
				color = 'danger'
			}

			return {
				display: `${totalMarks} / ${assessmentTotal} (${percentage.toFixed(1)}%) - ${grade}`,
				color: color
			}
		}

		// For fixed mode without total marks
		return {
			display: `Total: ${totalMarks} marks`,
			color: 'primary'
		}
	}

	function formatMarkValue(value) {
		if (value === undefined || value === null) return null
		const num = Number(value)
		if (!Number.isFinite(num)) return null
		return parseFloat(num.toFixed(2)).toString()
	}

		// Calculate marks range based on color and allocated marks
		function getMarksRange(color, allocatedMarks) {
			let lower = null
			let upper = null
			let customRange = null
			
			if (currentAssessment?.percentageRanges && currentAssessment.percentageRanges.length > 0) {
				customRange = currentAssessment.percentageRanges.find(range => range.color === color)
				if (customRange) {
					lower = customRange.lowerPercentage / 100
					upper = customRange.upperPercentage / 100
				}
			}

			if (lower === null || upper === null) {
				const colorRanges = {
					green: { min: 0.8, max: 1.0 },
					lightgreen: { min: 0.65, max: 0.79 },
					yellow: { min: 0.5, max: 0.64 },
					orange: { min: 0.4, max: 0.49 },
					red: { min: 0.0, max: 0.39 }
				}
				const fallback = colorRanges[color]
				if (!fallback) return null
				lower = fallback.min
				upper = fallback.max
			}

			const percentRange = customRange
				? `${customRange.lowerPercentage}% - ${customRange.upperPercentage}%`
				: `${(lower * 100).toFixed(0)}% - ${(upper * 100).toFixed(0)}%`
			
			if (!allocatedMarks || allocatedMarks <= 0) {
				return percentRange
			}
			
			const minMarks = Math.round(allocatedMarks * lower * 100) / 100
			const maxMarks = Math.round(allocatedMarks * upper * 100) / 100
			const formattedMin = formatMarkValue(minMarks)
			const formattedMax = formatMarkValue(maxMarks)
			
			if (formattedMin && formattedMax) {
				return `${formattedMin} - ${formattedMax}`
			}

			return percentRange
		}

		function updateTotalMarks(totalMarks) {
			manualTotalMarks = totalMarks ?? ''

			// Persist total marks on the assessment itself
			if (!currentAssessment || !currentSubject) return

			const parsedTotal = totalMarks === '' || totalMarks === null || totalMarks === undefined
				? null
				: Number(totalMarks)
			const sanitizedTotal = Number.isFinite(parsedTotal) ? parsedTotal : null

			const updatedAssessment = { ...currentAssessment, totalMarks: sanitizedTotal }
			currentAssessment = updatedAssessment

			const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
			if (subjectIndex !== -1) {
				const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
				if (assessmentIndex !== -1) {
					const assessments = [...subjects[subjectIndex].assessments]
					assessments[assessmentIndex] = updatedAssessment
					subjects[subjectIndex] = { ...subjects[subjectIndex], assessments }
					saveSubjects()
				}
			}
		}

	// Notification Functions
	function showSuccessNotification(message) {
		console.log('NOTIFICATION DEBUG: Showing notification:', message)
		const nextMessage = String(message || '')
		notificationMessage = nextMessage
		notificationVariant = /❌|failed|error|unable|cannot/i.test(nextMessage) ? 'danger' : 'success'
		showNotification = true
		setTimeout(() => {
			console.log('NOTIFICATION DEBUG: Auto-hiding notification')
			showNotification = false
		}, 3000) // Auto-hide after 3 seconds
	}

	async function savePhotoForCurrentStudent(imageDataUrl) {
		if (!currentStudentId || !imageDataUrl) return false

		const studentExists = students.some(s => s.id === currentStudentId)
		if (!studentExists) return false

		// Persist in common fields for backward compatibility with existing data reads.
		students = students.map(student =>
			student.id === currentStudentId
				? { ...student, studentImage: imageDataUrl, photo: imageDataUrl, updatedAt: new Date().toISOString() }
				: student
		)
		studentPhoto = imageDataUrl
		await saveStudents()
		return true
	}

	async function handleStudentPhotoPaste(event) {
		// Only intercept image paste in feedback mode with a selected student.
		if (currentView !== 'feedback' || !currentStudentId) return

		const clipboardItems = Array.from(event.clipboardData?.items || [])
		const imageItem = clipboardItems.find(item => item.type && item.type.startsWith('image/'))
		if (!imageItem) return

		const file = imageItem.getAsFile()
		if (!file) return

		event.preventDefault()

		const reader = new FileReader()
		reader.onload = async (e) => {
			const result = e.target?.result
			if (typeof result !== 'string') {
				showSuccessNotification('❌ Pasted image could not be read. Please try again.')
				return
			}

			const saved = await savePhotoForCurrentStudent(result)
			if (saved) {
				showSuccessNotification('✅ Student photo pasted and saved.')
			} else {
				showSuccessNotification('❌ Could not save photo. Please select a student and try again.')
			}
		}
		reader.onerror = () => {
			showSuccessNotification('❌ Failed to process pasted image.')
		}
		reader.readAsDataURL(file)
	}

	function handleStudentPhotoPasteBox(event) {
		const clipboardItems = Array.from(event.clipboardData?.items || [])
		const imageItem = clipboardItems.find(item => item.type && item.type.startsWith('image/'))
		if (!imageItem) return

		if (!currentStudentId) {
			event.preventDefault()
			showSuccessNotification('⚠️ Select a student first, then paste the student image.')
			return
		}

		handleStudentPhotoPaste(event)
	}

	function handleGlobalPointerDown(event) {
		const container = studentPickerContainer
		if (!showStudentPicker || !container) return
		if (event.target instanceof Node && !container.contains(event.target)) {
			closeStudentPicker()
		}
	}

	function handleGlobalKeyDown(event) {
		if (event.key === 'Escape' && showStudentPicker) {
			closeStudentPicker()
		}
	}

	// Student Management Functions

	async function saveStudents() {
		// Save students to main data file
		const mainData = {
			subjects,
			students,
			percentageRanges,
			appSettings: {
				aiMarkingSystemInstructions: globalAiSystemInstructions.trim()
			}
		}
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

	async function deleteStudent(studentId) {
		console.log('deleteStudent called with studentId:', studentId)
		const student = students.find(s => s.id === studentId)
		const studentDisplayName = student ? student.displayName : 'this student'
		console.log('Student found:', student, 'Display name:', studentDisplayName)
		
		deletingStudentId = studentId // Set loading state
		
		try {
			// Delete all associated student files via Tauri
			await invoke('delete_all_student_files', { studentId: studentId })
			console.log(`Deleted all files for student: ${studentId}`)
		} catch (error) {
			console.log('Tauri not available, using browser storage cleanup')
			// Fallback: Clean up browser storage
			const keysToRemove = []
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i)
				if (key && (key.startsWith(`student-evaluation-${studentId}-`) || key === `student-paragraphs-${studentId}`)) {
					keysToRemove.push(key)
				}
			}
			keysToRemove.forEach(key => localStorage.removeItem(key))
		}
		
		// Remove student from the students array
		students = students.filter(s => s.id !== studentId)
		saveStudents()
		
		// Clear current student selection if the deleted student was selected
		if (currentStudentId === studentId) {
				currentStudentId = null
				studentName = ''
				studentSubmissionText = ''
				studentPhoto = ''
				// No studentImage - only header photo for assessment
				selectedParagraphs.clear()
				categoryMarks = {}
				manualTotalMarks = currentAssessment?.totalMarks ?? ''
				quickAddText = {}
			}
		
		// Clear loading state and close modal
		deletingStudentId = null
		showDeleteConfirmation = false
		studentToDelete = null
		
		// Show success notification
		showNotification = true
		notificationMessage = `Student deleted successfully. All associated data has been removed.`
		setTimeout(() => { showNotification = false }, 3000)
	}

	async function selectStudent(studentId) {
		// STRICT FILTER: Validate context before selecting student
		if (currentView !== 'feedback') {
			console.error('STRICT FILTER: Cannot select student outside of feedback view')
			return
		}
		
		if (!currentAssessmentId) {
			console.error('STRICT FILTER: Cannot select student without assessment context')
			return
		}
		
		currentStudentId = studentId
		
		// Handle student deselection (empty studentId)
		if (!studentId || studentId === '') {
			console.log('STRICT FILTER: Student deselected - loading assignment-only data')
			// Clear student-specific data
				studentName = ''
				studentSubmissionText = ''
				studentPhoto = ''
				// No studentImage - only header photo for assessment
				selectedParagraphs = new Set()
				categoryMarks = {}
				manualTotalMarks = currentAssessment?.totalMarks ?? ''
				quickAddText = {}
				
				// Reload assignment paragraphs only (no student data)
				await loadAssessmentData(currentSubjectId, currentAssessmentId, false)
				return
			}
		
		const student = students.find(s => s.id === studentId)
		if (student) {
			studentName = student.displayName
			studentPhoto = getStudentPhoto(student)
			// STRICT FILTER: Only load student evaluation data for the current assessment
			console.log(`STRICT FILTER: Selecting student ${studentId} for assessment ${currentAssessmentId}`)
			await loadStudentEvaluation()
		} else {
			// Clear only student-specific data, keep paragraphs and header photo visible
			studentName = ''
			studentSubmissionText = ''
			studentPhoto = ''
			// No studentImage - only header photo for assessment
			// Don't clear paragraphs, selectedParagraphs, or marks - keep them visible
		}
	}

	function getCurrentStudent() {
		return students.find(s => s.id === currentStudentId)
	}

	// Helper function to calculate mark ranges for a category based on percentage ranges
	function getCategoryMarkRanges(categoryMarks, percentageRanges) {
		const numericMarks = Number(categoryMarks)
		if (!Number.isFinite(numericMarks) || !percentageRanges || percentageRanges.length === 0) return []

		return percentageRanges.map(range => {
			const lower = (numericMarks * range.lowerPercentage / 100).toFixed(1)
			const upper = (numericMarks * range.upperPercentage / 100).toFixed(1)
			return {
				color: range.color,
				range: `${parseFloat(lower)}-${parseFloat(upper)}`,
				lower: parseFloat(lower),
				upper: parseFloat(upper)
			}
		}).sort((a, b) => b.lower - a.lower) // Sort from highest to lowest
	}

	// Percentage range management
	function addPercentageRange(color, lowerPercentage, upperPercentage) {
		if (!currentAssessment) return

		const lower = Number(lowerPercentage)
		const upper = Number(upperPercentage)
		if (Number.isNaN(lower) || Number.isNaN(upper)) return

		// Ensure percentageRanges array exists on assessment
		if (!currentAssessment.percentageRanges) {
			currentAssessment.percentageRanges = []
		}

		// Add range to current assessment
		currentAssessment.percentageRanges = [...currentAssessment.percentageRanges, {
			id: Date.now().toString(),
			color: color,
			lowerPercentage: lower,
			upperPercentage: upper
		}]

		// Update assessment in subjects array
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

		refreshCategoryWarnings()
	}

	function deletePercentageRange(id) {
		if (!currentAssessment || !currentAssessment.percentageRanges) return

		// Remove range from current assessment
		currentAssessment.percentageRanges = currentAssessment.percentageRanges.filter(range => range.id !== id)

		// Update assessment in subjects array
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

		refreshCategoryWarnings()
	}

	// Sort students alphabetically by display name
	let sortedStudents = $derived(
		[...students].sort((a, b) => a.displayName.localeCompare(b.displayName))
	)

	// Save student evaluation data
	async function saveStudentEvaluation() {
		if (!currentStudentId || !currentAssessmentId) return

		// STRICT SAVING CRITERIA 2: Only save to Student if student IS selected
		console.log('STRICT SAVING CRITERIA: Saving to student file - student selected')

		// STRICT VALIDATION: Ensure student is actually selected
		if (!currentStudentId) {
			console.log('STRICT SAVING CRITERIA: Cannot save student data when no student is selected')
			return
		}

		// Check for unentered text in quick-add textareas
		const hasUnenteredText = Object.values(quickAddText).some(text => text && text.trim() !== '')
		if (hasUnenteredText) {
			showSuccessNotification('⚠️ Cannot save - you have unentered text in the "Add paragraph" field. Please click "Add paragraph" button or clear the text first.')
			return
		}

		// Save selected paragraphs under student properties (replace old selection data)
		console.log('💾 SAVING: Selected paragraphs to student properties:', {
			studentId: currentStudentId,
			assessmentId: currentAssessmentId,
			selectedParagraphs: Array.from(selectedParagraphs)
		})
		
		students = studentsService.updateStudentSelectedParagraphs(
			students, 
			currentStudentId, 
			currentAssessmentId, 
			Array.from(selectedParagraphs)
		)
		
		// Save updated students data
		await studentsService.saveStudents(students)
		console.log('✅ SAVED: Student data updated with new selections')

		const saveSucceeded = await persistCurrentStudentEvaluationData()

		if (saveSucceeded) {
			showSuccessNotification(getMotivationalMessage('student'))
			await handleStudentSaveCompletion()
		}
	}

	async function handleStudentSaveCompletion() {
		await deselectStudentAfterSave()
	}

	async function deselectStudentAfterSave() {
		if (!currentStudentId) return

		try {
			if (currentView === 'feedback' && currentAssessmentId) {
				await selectStudent('')
			} else {
				currentStudentId = null
				studentName = ''
				studentSubmissionText = ''
				selectedParagraphs = new Set()
				categoryMarks = {}
				manualTotalMarks = currentAssessment?.totalMarks ?? ''
				quickAddText = {}
			}
		} catch (error) {
			console.error('Failed to deselect student after save', error)
			currentStudentId = null
			studentName = ''
			studentSubmissionText = ''
			selectedParagraphs = new Set()
			categoryMarks = {}
			manualTotalMarks = currentAssessment?.totalMarks ?? ''
			quickAddText = {}
		} finally {
			if (!currentStudentId) {
				currentStudentId = null
			}
		}
	}

	// Transfer student data to another student
	async function transferStudentData(targetStudentId) {
		if (!currentStudentId || !targetStudentId || !currentAssessmentId) {
			showSuccessNotification('❌ Transfer cancelled - missing student or assessment information. Please select both source and target students.')
			return
		}

		if (currentStudentId === targetStudentId) {
			showSuccessNotification('❌ Transfer cancelled - cannot transfer data to the same student. Please select a different target student.')
			return
		}

		try {
			console.log('🔄 TRANSFER: Starting data transfer from', currentStudentId, 'to', targetStudentId)
			const paragraphsForContext = ensureParagraphsHaveIds(paragraphs).map(para => ({
				...para,
				subjectId: currentSubjectId,
				assessmentId: currentAssessmentId
			}))

			// 1. Transfer selected paragraphs (stored in student properties)
			const sourceStudent = students.find(s => s.id === currentStudentId)
			let selectedParagraphsToTransfer = []
			
			// Get selected paragraphs from current UI state (selectedParagraphs Set)
			if (selectedParagraphs && selectedParagraphs.size > 0) {
				selectedParagraphsToTransfer = Array.from(selectedParagraphs)
				console.log('🔄 TRANSFER: Using current UI selections:', selectedParagraphsToTransfer)
			} else if (sourceStudent && sourceStudent.selectedParagraphs && sourceStudent.selectedParagraphs[currentAssessmentId]) {
				// Fallback to stored selections if UI state is empty
				selectedParagraphsToTransfer = sourceStudent.selectedParagraphs[currentAssessmentId]
				console.log('🔄 TRANSFER: Using stored selections:', selectedParagraphsToTransfer)
			}
			
			if (selectedParagraphsToTransfer.length > 0) {
				// Update target student's selected paragraphs
				students = studentsService.updateStudentSelectedParagraphs(
					students,
					targetStudentId,
					currentAssessmentId,
					selectedParagraphsToTransfer
				)
				console.log('✅ TRANSFER: Selected paragraphs transferred:', selectedParagraphsToTransfer)
			} else {
				console.log('⚠️ TRANSFER: No selected paragraphs to transfer')
			}

			// 2. Transfer paragraph content for this assessment/subject
			try {
				let existingTargetParagraphs = []
				try {
					const data = await invoke('read_student_paragraphs', { studentId: targetStudentId })
					if (data) {
						existingTargetParagraphs = JSON.parse(data).paragraphs || []
					}
				} catch (readError) {
					console.log('Tauri not available for target paragraphs, using browser storage')
					const data = localStorage.getItem(`student-paragraphs-${targetStudentId}`)
					if (data) {
						existingTargetParagraphs = JSON.parse(data).paragraphs || []
					}
				}

				// Remove any existing paragraphs for this subject/assessment to avoid mixing data
				const preservedParagraphs = existingTargetParagraphs.filter(
					para => para.subjectId !== currentSubjectId || para.assessmentId !== currentAssessmentId
				)
				const mergedParagraphs = [...preservedParagraphs, ...paragraphsForContext]

				const paragraphPayload = {
					studentId: targetStudentId,
					paragraphs: mergedParagraphs,
					savedAt: new Date().toISOString()
				}

				try {
					await invoke('write_student_paragraphs', {
						studentId: targetStudentId,
						data: JSON.stringify(paragraphPayload, null, 2)
					})
					console.log('✅ TRANSFER: Paragraph content transferred (Tauri)')
				} catch (writeError) {
					console.log('Tauri not available, using browser storage for paragraph transfer')
					localStorage.setItem(
						`student-paragraphs-${targetStudentId}`,
						JSON.stringify(paragraphPayload, null, 2)
					)
					console.log('✅ TRANSFER: Paragraph content transferred (localStorage)')
				}
			} catch (paragraphError) {
				console.error('⚠️ TRANSFER: Failed to transfer paragraph content', paragraphError)
			}

			// 3. Transfer evaluation data (marks, etc.)
				const evaluationData = {
					studentId: targetStudentId,
					assessmentId: currentAssessmentId,
					paragraphs: [...paragraphs],
					studentName: students.find(s => s.id === targetStudentId)?.name || '',
					studentSubmissionText: studentSubmissionText.trim(),
					categoryMarks: { ...categoryMarks },
					manualTotalMarks: currentAssessment?.totalMarks ?? manualTotalMarks,
					savedAt: new Date().toISOString()
				}

			// Save evaluation data for target student
			try {
				await invoke('write_student_evaluation', {
					data: JSON.stringify(evaluationData),
					studentId: targetStudentId,
					assessmentId: currentAssessmentId
				})
				console.log('✅ TRANSFER: Evaluation data transferred (Tauri)')
			} catch (error) {
				console.log('Tauri not available, using browser storage for evaluation data')
				const key = `student-evaluation-${targetStudentId}-${currentAssessmentId}`
				localStorage.setItem(key, JSON.stringify(evaluationData))
				console.log('✅ TRANSFER: Evaluation data transferred (localStorage)')
			}

			// 3. Save updated students data
			await studentsService.saveStudents(students)
			console.log('✅ TRANSFER: Students data saved')

			// Show success message
			const sourceName = students.find(s => s.id === currentStudentId)?.name || 'Unknown'
			const targetName = students.find(s => s.id === targetStudentId)?.name || 'Unknown'
			showSuccessNotification(`ℹ️ Transfer complete - selections and marks transferred from ${sourceName} to ${targetName}. Switch to ${targetName} to see the transferred data.`)

		} catch (error) {
			console.error('❌ TRANSFER ERROR:', error)
			showSuccessNotification('❌ Transfer failed - unable to copy selections and marks. Please check data integrity and try again.')
		}
	}

	// Load student evaluation data
	async function loadStudentEvaluation() {
		// STRICT FILTER: Validate context before loading student evaluation
		if (!currentStudentId || !currentAssessmentId) {
			console.log('STRICT FILTER: No student or assessment selected for evaluation')
			return
		}
		
		// STRICT FILTER: Ensure we're in feedback view for the correct assessment
		if (currentView !== 'feedback') {
			console.error('STRICT FILTER: Not in feedback view - cannot load student evaluation')
			return
		}
		
		// STRICT FILTER: Validate assessment context
		if (!currentSubject || !currentSubject.assessments) {
			console.error('STRICT FILTER: No current subject or assessments found for student evaluation')
			return
		}
		
		const assessmentExists = currentSubject.assessments.some(assessment => assessment.id === currentAssessmentId)
		if (!assessmentExists) {
			console.error(`STRICT FILTER: Assessment ${currentAssessmentId} not found in current subject for student evaluation`)
			return
		}

		console.log(`STRICT FILTER: Loading student evaluation for student ${currentStudentId} in assessment ${currentAssessmentId}`)

		// Load assignment paragraphs first
		await loadAssessmentData(currentSubjectId, currentAssessmentId, true) // preserveSelections = true
		const assignmentParagraphs = [...paragraphs]

		// Load student paragraphs for this specific student (without overwriting assignment paragraphs)
		const studentParagraphs = await loadStudentParagraphsForMerging()

		console.log('MERGE DEBUG: Before merging:', {
			assignmentCount: assignmentParagraphs.length,
			studentCount: studentParagraphs.length,
			assignmentParagraphs: assignmentParagraphs.map(p => ({ 
				text: typeof p === 'string' ? p : p.text, 
				color: typeof p === 'string' ? '' : p.color 
			})),
			studentParagraphs: studentParagraphs.map(p => ({ 
				text: typeof p === 'string' ? p : p.text, 
				color: typeof p === 'string' ? '' : p.color 
			}))
		})

		// Check if student paragraphs are identical to assignment paragraphs
		let studentHasChanges = false
		
		// If no student paragraphs exist, treat as identical (merged)
		if (studentParagraphs.length === 0) {
			console.log('MERGE DEBUG: No student paragraphs found - treating as merged with assignment')
			studentHasChanges = false
		} else {
			// CONTENT-BASED COMPARISON: Compare paragraphs by content, not by index
			console.log('MERGE DEBUG: Starting content-based comparison')
			
			// Create normalized versions for comparison
			const normalizedAssignmentParagraphs = assignmentParagraphs.map(para => {
				const text = typeof para === 'string' ? para : para.text
				const color = typeof para === 'object' ? para.color : ''
				return {
					text: text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
					color: color || '',
					original: para
				}
			})
			
			const normalizedStudentParagraphs = studentParagraphs.map(para => {
				const text = typeof para === 'string' ? para : para.text
				const color = typeof para === 'object' ? para.color : ''
				return {
					text: text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
					color: color || '',
					original: para
				}
			})
			
			// Check if all assignment paragraphs have matching student paragraphs
			for (const assignmentPara of normalizedAssignmentParagraphs) {
				const matchingStudentPara = normalizedStudentParagraphs.find(studentPara => 
					studentPara.text === assignmentPara.text && studentPara.color === assignmentPara.color
				)
				
				console.log(`MERGE DEBUG: Looking for match for assignment paragraph:`, {
					assignmentText: assignmentPara.text.substring(0, 50) + '...',
					assignmentColor: assignmentPara.color,
					foundMatch: !!matchingStudentPara,
					studentText: matchingStudentPara ? matchingStudentPara.text.substring(0, 50) + '...' : 'none',
					studentColor: matchingStudentPara ? matchingStudentPara.color : 'none'
				})
				
				if (!matchingStudentPara) {
					studentHasChanges = true
					console.log(`MERGE DEBUG: No matching student paragraph found - student has changes`)
					break
				}
			}
			
			// Also check if there are extra student paragraphs not in assignment
			if (!studentHasChanges) {
				for (const studentPara of normalizedStudentParagraphs) {
					const matchingAssignmentPara = normalizedAssignmentParagraphs.find(assignmentPara => 
						assignmentPara.text === studentPara.text && assignmentPara.color === studentPara.color
					)
					
					if (!matchingAssignmentPara) {
						studentHasChanges = true
						console.log(`MERGE DEBUG: Extra student paragraph found - student has changes`)
						break
					}
				}
			}
		}
		
		let mergedParagraphs
		if (!studentHasChanges) {
			console.log('MERGE DEBUG: Student paragraphs are identical to assignment paragraphs - marking as merged')
			// Mark assignment paragraphs as merged since they're identical to student paragraphs
			mergedParagraphs = assignmentParagraphs.map(para => ({
				...para,
				_source: 'merged'
			}))
			paragraphs = mergedParagraphs
		} else {
			console.log('MERGE DEBUG: Student has changes - merging paragraphs')
			// Merge assignment and student paragraphs (handle index-based differences)
			mergedParagraphs = mergeParagraphs(assignmentParagraphs, studentParagraphs)
			paragraphs = mergedParagraphs
		}

		// Load evaluation data to get selections and marks
		let savedSelectedParagraphs = new Set()
		let savedStudentName = ''
		let savedStudentSubmissionText = ''
		let savedStudentImage = ''
		let savedCategoryMarks = {}
		let savedManualTotalMarks = ''
		let savedQuickAddText = {}

		// First, try to load selected paragraphs from student properties
		const currentStudent = students.find(s => s.id === currentStudentId)
		if (currentStudent) {
			console.log('DEBUG: Current student found:', currentStudent.displayName)
			console.log('DEBUG: Student selectedParagraphs:', currentStudent.selectedParagraphs)
			console.log('DEBUG: Looking for assessmentId:', currentAssessmentId)
			
			const studentSelectedParagraphs = studentsService.getStudentSelectedParagraphs(currentStudent, currentAssessmentId)
			console.log('DEBUG: Retrieved student selected paragraphs:', studentSelectedParagraphs)
			
			if (studentSelectedParagraphs && studentSelectedParagraphs.length > 0) {
				savedSelectedParagraphs = new Set(studentSelectedParagraphs)
				console.log('✅ LOADED: Selected paragraphs from student properties:', Array.from(savedSelectedParagraphs))
			} else {
				console.log('⚠️ No selections found in student properties for assessment:', currentAssessmentId)
			}
		} else {
			console.log('❌ ERROR: Current student not found for ID:', currentStudentId)
		}

		// Then load other evaluation data (marks, etc.) from evaluation file
		try {
			const data = await invoke('read_student_evaluation', { 
				studentId: currentStudentId,
				assessmentId: currentAssessmentId
			})
			if (data) {
				const evaluationData = JSON.parse(data)
				
				// STRICT FILTER: Validate that the loaded data matches the current context
				if (evaluationData.studentId !== currentStudentId || evaluationData.assessmentId !== currentAssessmentId) {
					console.error('STRICT FILTER: Student evaluation data mismatch - ignoring loaded data')
					return
				}
				
				// Only use evaluation file selectedParagraphs if not found in student properties (legacy data)
				if (savedSelectedParagraphs.size === 0 && evaluationData.selectedParagraphs) {
					savedSelectedParagraphs = new Set(evaluationData.selectedParagraphs)
					console.log('🔄 LEGACY: Selected paragraphs from evaluation file (legacy data):', Array.from(savedSelectedParagraphs))
					console.log('⚠️ WARNING: Using legacy data - consider migrating to student properties')
				}
				
				savedStudentName = evaluationData.studentName || ''
				savedStudentSubmissionText = evaluationData.studentSubmissionText || ''
				savedStudentImage = evaluationData.studentImage || evaluationData.studentPhoto || evaluationData.photo || ''
				savedCategoryMarks = evaluationData.categoryMarks || {}
				savedManualTotalMarks = evaluationData.manualTotalMarks || ''
				savedQuickAddText = evaluationData.quickAddText || {}
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-evaluation-${currentStudentId}-${currentAssessmentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const evaluationData = JSON.parse(data)
				
				// STRICT FILTER: Validate that the loaded data matches the current context
				if (evaluationData.studentId !== currentStudentId || evaluationData.assessmentId !== currentAssessmentId) {
					console.error('STRICT FILTER: Student evaluation data mismatch - ignoring loaded data')
					return
				}
				
				// Only use evaluation file selectedParagraphs if not found in student properties (legacy data)
				if (savedSelectedParagraphs.size === 0 && evaluationData.selectedParagraphs) {
					savedSelectedParagraphs = new Set(evaluationData.selectedParagraphs)
					console.log('🔄 LEGACY: Selected paragraphs from localStorage evaluation file (legacy data):', Array.from(savedSelectedParagraphs))
					console.log('⚠️ WARNING: Using legacy data - consider migrating to student properties')
				}
				
				savedStudentName = evaluationData.studentName || ''
				savedStudentSubmissionText = evaluationData.studentSubmissionText || ''
				savedStudentImage = evaluationData.studentImage || evaluationData.studentPhoto || evaluationData.photo || ''
				savedCategoryMarks = evaluationData.categoryMarks || {}
				savedManualTotalMarks = evaluationData.manualTotalMarks || ''
				savedQuickAddText = evaluationData.quickAddText || {}
			}
		}

		console.log('SELECTION DEBUG: Before mapping:', {
			savedSelectedParagraphs: Array.from(savedSelectedParagraphs),
			assignmentCount: assignmentParagraphs.length,
			studentCount: studentParagraphs.length,
			mergedCount: mergedParagraphs.length,
			assignmentIds: assignmentParagraphs.map(p => p?.id),
			studentIds: studentParagraphs.map(p => p?.id),
			mergedIds: mergedParagraphs.map(p => p?.id)
		})

		// Map saved selections to merged paragraph IDs
		const mappedSelections = mapSelectionsToMergedParagraphs(
			savedSelectedParagraphs, 
			assignmentParagraphs, 
			studentParagraphs, 
			mergedParagraphs
		)

		console.log('SELECTION DEBUG: After mapping:', {
			mappedSelections: Array.from(mappedSelections),
			mappedCount: mappedSelections.size,
			savedCount: savedSelectedParagraphs.size
		})

		// Apply the mapped selections and marks
		// Only update selections if mapping was successful (had saved selections and got mapped results)
		// OR if there were no saved selections to begin with
		if (savedSelectedParagraphs.size === 0 || mappedSelections.size > 0) {
			selectedParagraphs = mappedSelections
			console.log('✅ SELECTIONS: Applied mapped selections')
		} else {
			console.log('⚠️ SELECTIONS: Mapping failed - keeping existing selections to prevent data loss')
			console.log('⚠️ SELECTIONS: This may indicate paragraph ID mismatch. Saved IDs:', Array.from(savedSelectedParagraphs))
			console.log('⚠️ SELECTIONS: Available merged IDs:', mergedParagraphs.map(p => p.id))
		}
		// Preserve the student's display name if no saved name exists
		studentName = savedStudentName || getCurrentStudent()?.displayName || ''
		studentSubmissionText = savedStudentSubmissionText
		studentPhoto = savedStudentImage || getStudentPhoto(getCurrentStudent()) || ''
		if (savedStudentImage && currentStudentId) {
			students = students.map(student => (
				student.id === currentStudentId && !getStudentPhoto(student)
					? { ...student, studentImage: savedStudentImage, photo: savedStudentImage }
					: student
			))
		}
		categoryMarks = savedCategoryMarks
		quickAddText = savedQuickAddText
		const assessmentTotalMarks = currentAssessment?.totalMarks
		if (assessmentTotalMarks !== null && assessmentTotalMarks !== undefined && assessmentTotalMarks !== '') {
			manualTotalMarks = assessmentTotalMarks
		} else if (savedManualTotalMarks !== '') {
			updateTotalMarks(savedManualTotalMarks)
		} else {
			manualTotalMarks = ''
		}

		// Selection mapping is now handled by mapSelectionsToMergedParagraphs above

		// Only show notification if we actually loaded some data
		const hasLoadedData = savedSelectedParagraphs.size > 0 || Object.keys(savedCategoryMarks).length > 0 || savedStudentName || savedManualTotalMarks
		
		if (hasLoadedData) {
			showSuccessNotification('Student evaluation data loaded successfully!')
		} else {
			// Don't show notification for empty data - this is normal for new students
			console.log('No saved data found for this student and assessment - this is normal for new students')
		}
	}

	// Export assignment settings to create a new assignment
	async function exportAssignmentSettings() {
		// Reload subjects data to ensure we have the latest state
		await loadSubjects()
		
		console.log('Assignment settings export completed. Subjects reloaded.')
		showSuccessNotification('New assignment created successfully!')
	}

	// Helper function to merge assignment and student paragraphs
	// Uses content-based comparison instead of index-based comparison
	function mergeParagraphs(assignmentParagraphs, studentParagraphs) {
		const merged = []
		
		console.log('MERGE DEBUG: Starting content-based merge with:', {
			assignmentCount: assignmentParagraphs.length,
			studentCount: studentParagraphs.length,
			assignmentParagraphs: assignmentParagraphs.map(p => ({ 
				text: typeof p === 'string' ? p : p.text, 
				color: typeof p === 'string' ? '' : p.color 
			})),
			studentParagraphs: studentParagraphs.map(p => ({ 
				text: typeof p === 'string' ? p : p.text, 
				color: typeof p === 'string' ? '' : p.color 
			}))
		})
		
		// Create normalized versions for comparison
		const normalizedAssignmentParagraphs = assignmentParagraphs.map(para => {
			const text = typeof para === 'string' ? para : para.text
			const color = typeof para === 'object' ? para.color : ''
			return {
				text: text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
				color: color || '',
				original: para
			}
		})
		
		const normalizedStudentParagraphs = studentParagraphs.map(para => {
			const text = typeof para === 'string' ? para : para.text
			const color = typeof para === 'object' ? para.color : ''
			return {
				text: text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
				color: color || '',
				original: para
			}
		})
		
		// Process each assignment paragraph
		for (let i = 0; i < normalizedAssignmentParagraphs.length; i++) {
			const assignmentPara = normalizedAssignmentParagraphs[i]
			
			// Find matching student paragraph by content
			const matchingStudentIndex = normalizedStudentParagraphs.findIndex(studentPara => 
				studentPara.text === assignmentPara.text && studentPara.color === assignmentPara.color
			)
			
			console.log(`MERGE DEBUG: Processing assignment paragraph ${i}:`, {
				assignmentText: assignmentPara.text.substring(0, 50) + '...',
				assignmentColor: assignmentPara.color,
				matchingStudentIndex,
				studentText: matchingStudentIndex >= 0 ? normalizedStudentParagraphs[matchingStudentIndex].text.substring(0, 50) + '...' : 'none'
			})
			
			if (matchingStudentIndex >= 0) {
				// Found matching student paragraph - merge them
				console.log(`MERGE DEBUG: Found matching student paragraph - merging`)
				const assignmentOriginal = assignmentPara.original
				
				if (assignmentOriginal && typeof assignmentOriginal === 'object') {
					merged.push({
						...assignmentOriginal,
						_source: 'merged' // Mark as merged content
					})
				} else {
					merged.push({
						id: generateId(assignmentPara.text, i),
						text: assignmentPara.text,
						color: assignmentPara.color,
						_source: 'merged' // Mark as merged content
					})
				}
				
				// Remove the matched student paragraph from the list
				normalizedStudentParagraphs.splice(matchingStudentIndex, 1)
			} else {
				// No matching student paragraph - add assignment version only
				console.log(`MERGE DEBUG: No matching student paragraph - adding assignment version only`)
				const assignmentOriginal = assignmentPara.original
				
				if (assignmentOriginal && typeof assignmentOriginal === 'object') {
					merged.push({
						...assignmentOriginal,
						_source: 'assignment'
					})
				} else {
					merged.push({
						id: generateId(assignmentPara.text, i),
						text: assignmentPara.text,
						color: assignmentPara.color,
						_source: 'assignment'
					})
				}
			}
		}
		
		// Add any remaining student paragraphs (those that don't match any assignment paragraph)
		for (let i = 0; i < normalizedStudentParagraphs.length; i++) {
			const studentPara = normalizedStudentParagraphs[i]
			console.log(`MERGE DEBUG: Adding unmatched student paragraph:`, {
				studentText: studentPara.text.substring(0, 50) + '...',
				studentColor: studentPara.color
			})
			
			const studentOriginal = studentPara.original
			if (studentOriginal && typeof studentOriginal === 'object') {
				merged.push({
					...studentOriginal,
					id: studentOriginal.id + '_student', // Modify ID to avoid conflicts
					_source: 'student'
				})
			} else {
				merged.push({
					id: generateId(studentPara.text, i) + '_student',
					text: studentPara.text,
					color: studentPara.color,
					_source: 'student'
				})
			}
		}
		
		console.log('MERGE DEBUG: Final merged result:', {
			totalMerged: merged.length,
			assignmentVersions: merged.filter(p => p._source === 'assignment').length,
			studentVersions: merged.filter(p => p._source === 'student').length,
			mergedVersions: merged.filter(p => p._source === 'merged').length,
			mergedParagraphs: merged.map(p => ({ 
				text: typeof p === 'string' ? p : p.text, 
				color: typeof p === 'string' ? '' : p.color,
				source: p._source || 'no-source',
				id: typeof p === 'string' ? 'string' : p.id
			})),
			allIds: merged.map(p => typeof p === 'string' ? 'string' : p.id),
			uniqueIds: [...new Set(merged.map(p => typeof p === 'string' ? 'string' : p.id))],
			duplicateIds: merged.map(p => typeof p === 'string' ? 'string' : p.id).filter((id, index, arr) => arr.indexOf(id) !== index)
		})
		
		// Check for duplicates in merged result
		const mergedTexts = merged.map(p => typeof p === 'string' ? p : p.text)
		const duplicateTexts = mergedTexts.filter((text, index) => mergedTexts.indexOf(text) !== index)
		if (duplicateTexts.length > 0) {
			console.error('MERGE DEBUG: DUPLICATES FOUND IN MERGED RESULT:', duplicateTexts)
		}
		
		// CRITICAL FIX: Ensure all paragraphs have unique IDs
		const uniqueIds = new Set()
		const fixedMerged = merged.map((para, index) => {
			let currentId = typeof para === 'string' ? generateId(para, index) : para.id
			
			// If ID already exists, generate a new unique one
			if (uniqueIds.has(currentId)) {
				currentId = generateId(typeof para === 'string' ? para : para.text, index + 1000) // Add offset to ensure uniqueness
				console.log(`MERGE DEBUG: Fixed duplicate ID for paragraph ${index}:`, currentId)
			}
			
			uniqueIds.add(currentId)
			
			if (typeof para === 'string') {
				return {
					id: currentId,
					text: para,
					color: '',
					originalIndex: index,
					fullText: para
				}
			} else {
				return {
					...para,
					id: currentId
				}
			}
		})
		
		console.log('MERGE DEBUG: After ID fix:', {
			totalParagraphs: fixedMerged.length,
			uniqueIds: [...uniqueIds],
			allIds: fixedMerged.map(p => p.id)
		})
		
		return fixedMerged
	}

	// Helper function to map saved selections to merged paragraph IDs
	function mapSelectionsToMergedParagraphs(savedSelections, assignmentParagraphs, studentParagraphs, mergedParagraphs) {
		const mappedSelections = new Set()

		console.log('DEBUG: mapSelectionsToMergedParagraphs called with:', {
			savedSelections: Array.from(savedSelections),
			assignmentParagraphs: assignmentParagraphs.length,
			studentParagraphs: studentParagraphs.length,
			mergedParagraphs: mergedParagraphs.length
		})

		// Create maps to find paragraph by ID
		const assignmentParagraphMap = new Map()
		assignmentParagraphs.forEach(para => {
			if (para && para.id) {
				assignmentParagraphMap.set(para.id, para)
			}
		})

		const studentParagraphMap = new Map()
		studentParagraphs.forEach(para => {
			if (para && para.id) {
				studentParagraphMap.set(para.id, para)
			}
		})

		const mergedParagraphMap = new Map()
		mergedParagraphs.forEach(para => {
			if (para && para.id) {
				mergedParagraphMap.set(para.id, para)
			}
		})

		console.log('DEBUG: Paragraph maps created:', {
			assignmentMapSize: assignmentParagraphMap.size,
			studentMapSize: studentParagraphMap.size,
			mergedMapSize: mergedParagraphMap.size,
			mergedParagraphIds: Array.from(mergedParagraphMap.keys())
		})

		// Map each saved selection (now treating as IDs)
		for (const savedId of savedSelections) {
			console.log(`DEBUG: Checking saved ID: ${savedId}`)
			// Check if this ID exists in the merged paragraphs
			if (mergedParagraphMap.has(savedId)) {
				console.log(`DEBUG: Found saved ID ${savedId} in merged paragraphs`)
				mappedSelections.add(savedId)
			} else {
				// Try to find by content matching as fallback
				console.log(`DEBUG: Saved ID ${savedId} NOT found - trying content match`)

				// Get the original paragraph from assignment or student lists
				const originalPara = assignmentParagraphMap.get(savedId) || studentParagraphMap.get(savedId)

				if (originalPara) {
					const originalText = (originalPara.text || '').trim()
					const originalColor = originalPara.color || ''

					// Find matching paragraph in merged list by text and color
					const matchingMerged = mergedParagraphs.find(merged => {
						const mergedText = (merged.text || '').trim()
						const mergedColor = merged.color || ''
						return mergedText === originalText && mergedColor === originalColor
					})

					if (matchingMerged) {
						console.log(`DEBUG: Found content match for ${savedId} -> ${matchingMerged.id}`)
						mappedSelections.add(matchingMerged.id)
					} else {
						console.log(`DEBUG: No content match found for ${savedId}`)
					}
				}
			}
		}

		console.log('DEBUG: Final mapped selections:', Array.from(mappedSelections))
		return mappedSelections
	}

	// Save student paragraphs (separate from assessment data)
	async function saveStudentParagraphs() {
		if (!currentStudentId) return

		// Get existing student paragraphs
		let existingStudentParagraphs = []
		try {
			const data = await invoke('read_student_paragraphs', { 
				studentId: currentStudentId
			})
			if (data) {
				const studentData = JSON.parse(data)
				existingStudentParagraphs = studentData.paragraphs || []
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-paragraphs-${currentStudentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const studentData = JSON.parse(data)
				existingStudentParagraphs = studentData.paragraphs || []
			}
		}

		// Add current paragraphs to student paragraphs (avoid duplicates)
		const currentParagraphs = paragraphs.map(para => ({
			...para,
			subjectId: currentSubjectId, // STRICT DATA ISOLATION: Add subject context
			assessmentId: currentAssessmentId // STRICT DATA ISOLATION: Add assessment context
		}))
		
		// Migrate legacy paragraphs by adding missing subjectId/assessmentId
		const migratedExistingParagraphs = existingStudentParagraphs.map(para => {
			if (!para.subjectId || !para.assessmentId) {
				console.log('MIGRATION: Adding subjectId/assessmentId to legacy paragraph:', para.text?.substring(0, 50))
				return {
					...para,
					subjectId: currentSubjectId,
					assessmentId: currentAssessmentId
				}
			}
			return para
		})
		
		const combinedParagraphs = [...migratedExistingParagraphs]
		
		// Add new paragraphs that don't already exist in student storage
		currentParagraphs.forEach(para => {
			const exists = combinedParagraphs.some(existing => 
				existing.text === para.text && existing.color === para.color
			)
			if (!exists) {
				combinedParagraphs.push(para)
			}
		})

		const studentParagraphData = {
			studentId: currentStudentId,
			paragraphs: combinedParagraphs,
			savedAt: new Date().toISOString()
		}

		try {
			await invoke('write_student_paragraphs', { 
				studentId: currentStudentId,
				data: JSON.stringify(studentParagraphData, null, 2)
			})
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-paragraphs-${currentStudentId}`
			localStorage.setItem(key, JSON.stringify(studentParagraphData))
		}
	}

	// Load student paragraphs
	async function loadStudentParagraphs() {
		if (!currentStudentId) return

		try {
			const data = await invoke('read_student_paragraphs', { 
				studentId: currentStudentId
			})
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				// CRITICAL FIX: Only include paragraphs that match current context
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						const matches = para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
						if (!matches) {
							console.log('FILTERED OUT: Paragraph from different assignment:', {
								paraSubjectId: para.subjectId,
								paraAssessmentId: para.assessmentId,
								currentSubjectId,
								currentAssessmentId,
								text: para.text?.substring(0, 50)
							})
						}
						return matches
					}
					// CRITICAL FIX: Exclude legacy paragraphs without context to prevent contamination
					console.log('FILTERED OUT: Legacy paragraph without subjectId/assessmentId:', para.text?.substring(0, 50))
					return false
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				paragraphs = ensureParagraphsHaveIds(filteredParagraphs)
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-paragraphs-${currentStudentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				// For legacy data without subjectId/assessmentId, include them (migration fallback)
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						return para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
					}
					// For legacy paragraphs without context, include them (will be migrated on next save)
					console.log('LEGACY DATA: Including paragraph without subjectId/assessmentId for migration:', para.text?.substring(0, 50))
					return true
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				paragraphs = ensureParagraphsHaveIds(filteredParagraphs)
			}
		}
	}

	// Load student paragraphs for merging (without overwriting paragraphs variable)
	async function loadStudentParagraphsForMerging() {
		if (!currentStudentId) return []

		try {
			const data = await invoke('read_student_paragraphs', { 
				studentId: currentStudentId
			})
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				// CRITICAL FIX: Only include paragraphs that match current context
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						const matches = para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
						if (!matches) {
							console.log('MERGE FILTERED OUT: Paragraph from different assignment:', {
								paraSubjectId: para.subjectId,
								paraAssessmentId: para.assessmentId,
								currentSubjectId,
								currentAssessmentId,
								text: para.text?.substring(0, 50)
							})
						}
						return matches
					}
					// CRITICAL FIX: Exclude legacy paragraphs without context to prevent contamination
					console.log('MERGE FILTERED OUT: Legacy paragraph without subjectId/assessmentId:', para.text?.substring(0, 50))
					return false
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				return ensureParagraphsHaveIds(filteredParagraphs)
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-paragraphs-${currentStudentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				// For legacy data without subjectId/assessmentId, include them (migration fallback)
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						return para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
					}
					// For legacy paragraphs without context, include them (will be migrated on next save)
					console.log('LEGACY DATA: Including paragraph without subjectId/assessmentId for migration:', para.text?.substring(0, 50))
					return true
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				return ensureParagraphsHaveIds(filteredParagraphs)
			}
		}
		return []
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
			return PDR_CATEGORIES
		} else if (isStudio4PDR()) {
			return STUDIO4_CATEGORIES
		} else if (isStudio5PDR()) {
			return STUDIO5_CATEGORIES
		}
		return []
	}

	function toggleParagraph(paragraphId) {
		if (!paragraphId) return
		
		console.log('🔄 toggleParagraph called:', {
			paragraphId,
			currentSelectedCount: selectedParagraphs.size,
			currentSelected: Array.from(selectedParagraphs),
			paragraphExists: paragraphs.find(p => p.id === paragraphId) ? 'YES' : 'NO'
		})
		
		addCheckboxDebug(`🔄 Toggle clicked: ${paragraphId}`)
		addCheckboxDebug(`📋 Current selected: ${Array.from(selectedParagraphs).length} items`)
		
		if (selectedParagraphs.has(paragraphId)) {
			selectedParagraphs.delete(paragraphId)
			addCheckboxDebug(`❌ Removed: ${paragraphId}`)
			console.log('❌ Removed paragraph from selection:', paragraphId)
		} else {
			selectedParagraphs.add(paragraphId)
			addCheckboxDebug(`✅ Added: ${paragraphId}`)
			console.log('✅ Added paragraph to selection:', paragraphId)
		}
		selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
		
		addCheckboxDebug(`📊 Final selected: ${Array.from(selectedParagraphs).length} items`)
		addCheckboxDebug(`📝 Selected IDs: ${Array.from(selectedParagraphs).join(', ')}`)
		
		console.log('📊 Final selection state:', {
			count: selectedParagraphs.size,
			selected: Array.from(selectedParagraphs)
		})
		
		refreshCategoryWarnings()
		
		saveAssessmentData()
	}

	function deleteParagraph(index) {
		// Get the paragraph ID and text before deletion
		const deletedParagraph = paragraphs[index]
		const deletedParagraphId = deletedParagraph?.id
		
		// Remove from paragraphs array (assignment level only)
		paragraphs.splice(index, 1)
		
		// Remove the deleted paragraph ID from selected paragraphs
		if (deletedParagraphId) {
			selectedParagraphs.delete(deletedParagraphId)
			selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
		}
		
		refreshCategoryWarnings()
		
		// Save assignment data (without the deleted paragraph)
		saveAssessmentData()
		
		// Note: Student paragraphs are kept separate and are not affected by deletion
		// The deleted paragraph remains in the student's paragraph collection
	}

	// Edit paragraph functions
	function startEditParagraph(index) {
		editingParagraphIndex = index
		// Extract only the main text content (without category and knowledge area prefixes)
		const extractedText = extractMainTextFromParagraph(paragraphs[index].text)
		// Set as HTML for rich text editor
		editingParagraphText = extractedText
	}

	function cancelEditParagraph() {
		editingParagraphIndex = null
		editingParagraphText = ''
	}

	function saveEditParagraph() {
		if (editingParagraphIndex !== null && editingParagraphText.trim()) {
			// Store HTML content directly for display
			let textToSave = editingParagraphText
			
			// Reconstruct the paragraph text with original prefixes
			const originalText = paragraphs[editingParagraphIndex].text
			const newText = reconstructParagraphText(originalText, textToSave.trim())
			paragraphs[editingParagraphIndex].text = newText
			editingParagraphIndex = null
			editingParagraphText = ''
			
			// Save to both assignment and student storage
			saveAssessmentData()
			if (currentStudentId) {
				saveStudentParagraphs()
			}
		}
	}

	// extractMainTextFromParagraph function is now imported from utils/helpers.js

	// reconstructParagraphText function is now imported from utils/helpers.js

	// getSectionOrder function is now imported from utils/helpers.js

	function getOrderedParagraphs() {
		console.log('🔍 getOrderedParagraphs called with:', {
			paragraphsCount: paragraphs.length,
			paragraphs: paragraphs.map(p => ({ id: p.id, text: p.text?.substring(0, 50) }))
		})
		
		const ordered = paragraphs
			.map((paragraph, originalIndex) => {
				// Handle both string and object formats
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				const paragraphColor = typeof paragraph === 'object' ? paragraph.color : undefined
				const paragraphId = typeof paragraph === 'object' ? paragraph.id : undefined
				return { 
					paragraph: paragraphText, 
					color: paragraphColor || undefined,
					id: paragraphId,
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
		
		console.log('🔍 getOrderedParagraphs result:', {
			orderedCount: ordered.length,
			orderedIds: ordered.map(o => o.id),
			orderedTexts: ordered.map(o => o.paragraph?.substring(0, 30))
		})
		
		return ordered
	}

	// getColorBadgeClass function is now imported from utils/helpers.js

	// getColorHex function is now imported from utils/helpers.js

	// cleanParagraphTextForDisplay function is now imported from utils/helpers.js

	// extractKnowledgeArea function is now imported from utils/helpers.js

	function getGroupedParagraphs() {
		const ordered = getOrderedParagraphs()
		const grouped = {}
		
		// First, initialize all categories from the assessment (even if they have no paragraphs)
		// Sort categories by order field if available
		if (currentAssessment?.categories) {
			const sortedCategories = [...currentAssessment.categories].sort((a, b) => {
				const orderA = a.order !== undefined ? a.order : 999
				const orderB = b.order !== undefined ? b.order : 999
				return orderA - orderB
			})
			
			sortedCategories.forEach(category => {
				const groupKey = category.name
				if (!grouped[groupKey]) {
					grouped[groupKey] = {
						category: category.name,
						knowledgeAreas: {}
					}
				}
			})
		}
		
		// Then process paragraphs and add them to their respective categories
		ordered.forEach(({paragraph, color, id, originalIndex}) => {
			// Get the source information from the paragraph object
			const paragraphObj = paragraphs.find(p => p.id === id)
			const source = paragraphObj?._source
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

			// Determine mark info for this paragraph/color combo
			let paragraphMarkInfo = null
			if (color) {
				const effectiveMode = getEffectiveMarkingMode(finalCategory)
				if (effectiveMode === 'fixed') {
					const colorMarkValue = getCategoryColorMarkValue(finalCategory, color)
					if (colorMarkValue !== undefined) {
						const numericValue = parseNumericMarkValue(colorMarkValue)
						paragraphMarkInfo = { 
							type: 'fixed', 
							value: colorMarkValue, 
							numericValue: Number.isFinite(numericValue) ? numericValue : null,
							color
						}
					}
				} else if (effectiveMode === 'percentage') {
					const categoryObj = currentAssessment?.categories?.find(cat => cat.name === finalCategory)
					const allocatedMarks = categoryObj?.allocatedMarks
					const range = getMarksRange(color, allocatedMarks)
					const bounds = getColorPercentageBounds(color)
					let minMarks = null
					let maxMarks = null
					if (bounds && Number.isFinite(allocatedMarks)) {
						minMarks = Number((allocatedMarks * bounds.lower).toFixed(2))
						maxMarks = Number((allocatedMarks * bounds.upper).toFixed(2))
					}
					if (range) {
						paragraphMarkInfo = { 
							type: 'percentage', 
							value: range,
							min: Number.isFinite(minMarks) ? Math.min(minMarks, maxMarks) : null,
							max: Number.isFinite(maxMarks) ? Math.max(minMarks, maxMarks) : null,
							color
						}
					}
				}
			}
			
			grouped[groupKey].knowledgeAreas[knowledgeAreaKey].push({
				text: cleanText,
				color,
				id,
				originalIndex,
				fullText: paragraph, // Keep original for PDF
				source: source, // Include source information
				markInfo: paragraphMarkInfo
			})
		})
		
		return Object.values(grouped)
	}

	function buildParagraphInfoIndex() {
		const index = {}
		const groupedParagraphs = getGroupedParagraphs()
		groupedParagraphs.forEach(group => {
			Object.values(group.knowledgeAreas || {}).forEach(paragraphsInArea => {
				paragraphsInArea.forEach(paragraphObj => {
					index[paragraphObj.id] = {
						...paragraphObj,
						category: group.category
					}
				})
			})
		})
		return index
	}

	function getCategoryParagraphSequence(group) {
		if (!group?.knowledgeAreas) return []
		return Object.values(group.knowledgeAreas).flat()
	}

	function resolveParagraphMainIndex(entry) {
		if (!entry) return -1
		if (entry.id !== undefined && entry.id !== null && entry.id !== '') {
			return paragraphs.findIndex(paragraph => paragraph?.id === entry.id)
		}
		return Number.isInteger(entry.originalIndex) ? entry.originalIndex : -1
	}

	function findParagraphSequenceIndex(sequence = [], paragraphId, fallbackOriginalIndex) {
		if (paragraphId !== undefined && paragraphId !== null && paragraphId !== '') {
			const byId = sequence.findIndex(item => item.id === paragraphId)
			if (byId !== -1) return byId
		}
		if (Number.isInteger(fallbackOriginalIndex)) {
			return sequence.findIndex(item => item.originalIndex === fallbackOriginalIndex)
		}
		return -1
	}

	function getSelectedTextInVisualOrder() {
		console.log('🔍 DEBUG getSelectedTextInVisualOrder:', {
			selectedParagraphs: Array.from(selectedParagraphs),
			selectedCount: selectedParagraphs.size,
			totalParagraphs: paragraphs.length
		})
		
		// Use the EXACT same order as the UI display (getGroupedParagraphs)
		const groupedParagraphs = getGroupedParagraphs()
		const result = []
		const processedCategories = new Set()
		
		console.log('🔍 Processing groups in UI order:')
		groupedParagraphs.forEach((group, groupIndex) => {
			console.log(`Group ${groupIndex}: ${group.category}`)
			
			Object.keys(group.knowledgeAreas).forEach(knowledgeArea => {
				const paragraphsInArea = group.knowledgeAreas[knowledgeArea]
				console.log(`  Knowledge Area: ${knowledgeArea} with ${paragraphsInArea.length} paragraphs`)
				
				// Skip adding knowledge area headings to PDF - just process the paragraphs
				paragraphsInArea.forEach((paragraphObj, paraIndex) => {
					// Only process selected paragraphs
					if (selectedParagraphs.has(paragraphObj.id)) {
						console.log(`    ✅ Processing selected paragraph ${paraIndex}: ${paragraphObj.id}`)
						
						const paragraphText = paragraphObj.fullText || paragraphObj.text
						let categoryName = 'Other'
						let content = paragraphText
						
						// Extract category from paragraph text
						if (paragraphText.includes(': ')) {
							const parts = paragraphText.split(': ')
							if (parts.length >= 2) {
								categoryName = parts[0]
								content = parts.slice(1).join(': ')
							}
						} else {
							content = cleanParagraphTextForDisplay(paragraphText)
						}
						
						// Remove knowledge area suffix from content (e.g., "- Security Auditing")
						// Knowledge areas often appear at the end with a hyphen
						if (content.includes(' - ')) {
							const parts = content.split(' - ')
							if (parts.length >= 2) {
								const lastPart = parts[parts.length - 1].trim()
								// Check if the last part looks like a knowledge area (not a category)
								if (!lastPart.includes('Sub Objective') && 
									!lastPart.includes('Sub Learning Objective') && 
									!lastPart.includes('Report') && 
									!lastPart.includes('Decision') &&
									!lastPart.includes('Other') &&
									lastPart.length > 0) {
									// Remove the knowledge area part from the end
									content = parts.slice(0, -1).join(' - ').trim()
								}
							}
						}
						
						// Add category header if this is the first time we see this category
						if (!processedCategories.has(categoryName)) {
							const categoryMarksValue = categoryMarks[categoryName] || 0
							const marksText = categoryMarksValue > 0 ? ` [${categoryMarksValue} MARKS]` : ''
							result.push(`${categoryName}: ${marksText}`)
							processedCategories.add(categoryName)
							console.log(`    📝 Added category header: ${categoryName}`)
						}
						
						// Add the content (no knowledge area headings)
						result.push(content)
						console.log(`    📝 Added content: "${content.substring(0, 50)}..."`)
					}
				})
			})
		})
		
		const finalText = result.join('\n\n\n')
		console.log('🔍 getSelectedTextInVisualOrder result:', {
			length: finalText.length,
			text: finalText.substring(0, 200) + (finalText.length > 200 ? '...' : '')
		})

		return finalText
	}

	async function renderAssessmentHtmlToPdf(doc, startY, margin, pageWidth, matchedCategories = new Set()) {
		const htmlContent = normalizeHtmlQuotes(assessmentHtml || '').trim()
		if (!htmlContent) return startY

		const pageHeight = doc.internal.pageSize.getHeight()
		const highlightColor = '#ffe066' // slightly darker yellow highlight
		const pxPerMm = 96 / 25.4 // approximate CSS pixel density
		const maxContentWidthMm = pageWidth - (margin * 2)
		const maxContentWidthPx = maxContentWidthMm * pxPerMm
		const paragraphInfoIndex = buildParagraphInfoIndex()
		const getParagraphCategoryKey = (para) => {
			const info = para?.id ? paragraphInfoIndex[para.id] : null
			if (info?.category) return normalize(info.category)
			const paraText = typeof para === 'string' ? para : para?.text || ''
			if (!paraText) return ''
			const prefix = paraText.split(':')[0]
			return normalize(prefix)
		}
		const container = document.createElement('div')
		container.className = 'pdf-assessment-html'
		container.style.position = 'absolute'
		container.style.left = '-99999px'
		container.style.top = '0'
		container.style.display = 'block'
		container.style.boxSizing = 'border-box'
		container.style.width = `${maxContentWidthPx}px`
		container.style.maxWidth = `${maxContentWidthPx}px`
		container.style.fontFamily = 'Arial, sans-serif'
		container.style.fontSize = '10pt' // Match paragraph font size (10pt from firstPageBodyFontSize)
		container.style.lineHeight = '1.35'
		container.innerHTML = htmlContent

		// Clean up Microsoft Word HTML markup that can break rendering
		container.querySelectorAll('[style*="mso-"]').forEach(el => {
			// Remove mso-specific styles but keep the element and content
			const style = el.getAttribute('style')
			if (style) {
				// Keep only essential styles, remove all mso-* properties
				const cleanStyle = style
					.split(';')
					.filter(prop => !prop.trim().toLowerCase().startsWith('mso-'))
					.join(';')
				if (cleanStyle.trim()) {
					el.setAttribute('style', cleanStyle)
				} else {
					el.removeAttribute('style')
				}
			}
		})

		// Remove mso-bookmark spans that wrap content unnecessarily
		container.querySelectorAll('span[style*="mso-bookmark"]').forEach(span => {
			// Replace span with its content
			const parent = span.parentNode
			while (span.firstChild) {
				parent.insertBefore(span.firstChild, span)
			}
			parent.removeChild(span)
		})

		// Strip inline padding/line-height on cells so our injected styles win
		container.querySelectorAll('th, td').forEach(cell => {
			cell.style.padding = ''
			cell.style.lineHeight = ''

			// Fix text color visibility - ensure text is visible on all backgrounds
			const bgColor = cell.style.backgroundColor || window.getComputedStyle(cell).backgroundColor
			const currentColor = cell.style.color

			// If background is dark (red, green, blue with low RGB values), ensure white text
			// If background is light (yellow, white, light colors), ensure black text
			if (bgColor) {
				const rgb = bgColor.match(/\d+/g)
				if (rgb && rgb.length >= 3) {
					const r = parseInt(rgb[0])
					const g = parseInt(rgb[1])
					const b = parseInt(rgb[2])
					// Calculate brightness using standard formula
					const brightness = (r * 299 + g * 587 + b * 114) / 1000

					// If dark background (brightness < 128), use white text
					// If light background, use black text
					if (brightness < 128) {
						cell.style.color = '#ffffff'
					} else {
						cell.style.color = '#000000'
					}
				}
			} else if (!currentColor || currentColor === 'white' || currentColor === '#ffffff') {
				// If no background but text is white, make it black
				cell.style.color = '#000000'
			}
		})

		// Normalize spacing inside pasted HTML so tables don't blow up the PDF
		const styleElement = document.createElement('style')
		styleElement.textContent = `
			.pdf-assessment-html { width: 100%; box-sizing: border-box; font-size: 10pt; }
			.pdf-assessment-html table { border-collapse: collapse; border-spacing: 0; width: 100%; table-layout: fixed; word-wrap: break-word; }
			.pdf-assessment-html th,
			.pdf-assessment-html td {
				padding: 12px 10px !important;
				line-height: 1.35 !important;
				vertical-align: top !important;
				word-break: break-word !important;
				overflow-wrap: anywhere !important;
				white-space: normal !important;
				hyphens: auto !important;
				box-sizing: border-box !important;
			}
			.pdf-assessment-html p { margin: 0; line-height: 1.4; font-size: inherit; }
			.pdf-assessment-html p + p { margin-top: 6px; }
			.pdf-assessment-html ul, .pdf-assessment-html ol { margin: 0 0 6px 18px; padding-left: 18px; }
			.pdf-assessment-html li { margin: 0; line-height: 1.3; }
			.pdf-assessment-html img { max-width: 100%; height: auto; }
			.pdf-assessment-html * { box-sizing: border-box; }
			.pdf-assessment-html table,
			.pdf-assessment-html th,
			.pdf-assessment-html td {
				border: 1px solid #222 !important;
			}
			.pdf-assessment-html p:not([style*="font-size"]) { font-size: 10pt; }
			.pdf-assessment-html div:not([style*="font-size"]) { font-size: 10pt; }
		`
		container.prepend(styleElement)

		// Auto-highlight rubric cells based on category marks and row names
		try {
			const normalize = (str) => (str || '')
				.toString()
				.replace(/\u00a0/g, ' ')
				.replace(/\([^)]*\)/g, '') // drop parenthetical mark hints
				.replace(/\s+/g, ' ')
				.trim()
				.toLowerCase()

			const extractNumber = (str) => {
				const match = (str || '').match(/(-?\d+(\.\d+)?)/)
				return match ? Number.parseFloat(match[1]) : null
			}

			const marksMap = {}
			Object.entries(categoryMarks || {}).forEach(([name, value]) => {
				const num = Number.parseFloat(value)
				if (Number.isFinite(num)) {
					marksMap[normalize(name)] = num
				}
			})

			// Fallback: derive marks from selected paragraphs/colors
			const colorToMark = { green: 3, lightgreen: 2, yellow: 1, orange: 1, red: 0 }
			const selectedMarkMap = {}
			const selectedCategoryKeys = new Set()
			Object.keys(marksMap).forEach(key => selectedCategoryKeys.add(key))
			const grouped = getGroupedParagraphs()
			grouped.forEach(group => {
				Object.values(group.knowledgeAreas || {}).forEach(paras => {
					paras.forEach(p => {
						if (!selectedParagraphs.has(p.id)) return
						selectedCategoryKeys.add(normalize(group.category))
						const catKey = normalize(group.category)
						let candidate = null
						if (p.markInfo && Number.isFinite(p.markInfo.numericValue)) {
							candidate = p.markInfo.numericValue
						} else if (p.color && colorToMark[p.color] !== undefined) {
							candidate = colorToMark[p.color]
						}
						if (candidate !== null) {
							if (!(catKey in selectedMarkMap) || candidate > selectedMarkMap[catKey]) {
								selectedMarkMap[catKey] = candidate
							}
						}
					})
				})
			})

			Object.entries(selectedMarkMap).forEach(([key, val]) => {
				if (!(key in marksMap)) {
					marksMap[key] = val
				}
			})

			// Build UI-order paragraph cache by category for position lookup
			const groupedParagraphs = getGroupedParagraphs()
			const getCategoryParagraphsInOrder = (catKey) => {
				const result = []
				groupedParagraphs.forEach(group => {
					if (normalize(group.category) !== catKey) return
					Object.values(group.knowledgeAreas || {}).forEach(list => {
						list.forEach(p => result.push(p))
					})
				})
				return result
			}

			const tables = Array.from(container.querySelectorAll('table'))
		tables.forEach(table => {
			const rows = Array.from(table.querySelectorAll('tr'))
			if (!rows.length) return

			const headerCells = Array.from(rows[0].children)
			const dataStartIndex = headerCells.length > 1 ? 1 : 0 // assume first column is row label
			let marksColumnIndex = -1
			headerCells.forEach((cell, idx) => {
				const text = normalize(cell.textContent || '')
				if (text.includes('marks')) {
					marksColumnIndex = idx
				}
			})
			const headerTextsRaw = headerCells.slice(dataStartIndex).map(cell => cell.textContent || '')
			const headerValueCandidates = headerTextsRaw.map(text => extractNumber(text)).filter(val => Number.isFinite(val))
			const headerIsPresent = headerCells.some(cell => cell.tagName === 'TH') || headerValueCandidates.length > 0
			const headerTexts = headerIsPresent ? headerTextsRaw : []
			const headerValues = headerIsPresent ? headerTextsRaw.map(text => extractNumber(text)) : []
			const inferredColumns = Math.max(1, headerCells.length - dataStartIndex)
			// Treat all data columns as mark-bearing columns; any content there counts as a mark line
			const reservedMarkColumns = inferredColumns

				const dataRows = headerIsPresent ? rows.slice(1) : rows

				dataRows.forEach(row => {
					const cells = Array.from(row.children)
					if (cells.length <= dataStartIndex) return
					const rawLabel = cells[0].textContent || ''
				const rowKey = normalize(rawLabel)
				// Allow manual row->category mapping to drive mark lookup/highlighting when labels differ
				const mappedCategoryName = tableRowCategoryMap?.[rowKey]
				const mappedCategoryKey = mappedCategoryName ? normalize(mappedCategoryName) : ''
				const effectiveKey = mappedCategoryKey || rowKey

				// Populate Marks column text if present (keep existing behavior)
				if (marksColumnIndex >= 0 && marksColumnIndex < cells.length) {
					const categoryObj = currentAssessment?.categories?.find(cat =>
						normalize(cat.name) === effectiveKey || normalize(cat.name) === rowKey || normalize(cat.name) === mappedCategoryKey
					)
					const markValue = marksMap[effectiveKey] ?? marksMap[rowKey] ?? marksMap[mappedCategoryKey]
					const allocated = Number.parseFloat(categoryObj?.allocatedMarks)
					const markDisplay = markValue ?? '—'
					cells[marksColumnIndex].textContent = Number.isFinite(allocated) && allocated > 0 ? `${markDisplay} / ${allocated}` : `${markDisplay}`
				}

				// Use ONLY row label + paragraph position -> column mapping for highlighting
				let columnIndex = -1
				const columnMarkMap = currentAssessment?.tableColumnMarkMap || tableColumnMarkMap || {}
				
				if (Object.keys(columnMarkMap).length > 0) {
					// Get all paragraphs for this row/category in UI order
					const categoryParagraphsList = getCategoryParagraphsInOrder(effectiveKey)
					
					// Use the top-most selected paragraph (in UI order)
					const selectedPara = categoryParagraphsList.find(p => selectedParagraphs.has(p.id))
					
					if (selectedPara) {
						// Paragraph position is its index within the full category list (1-based)
						const paragraphPosition = categoryParagraphsList.findIndex(p => p.id === selectedPara.id) + 1
						
						// Look up which column this position should highlight
						const mappedColumnIndex = columnMarkMap[paragraphPosition]
						if (mappedColumnIndex !== undefined && mappedColumnIndex !== null && mappedColumnIndex !== '') {
							columnIndex = parseInt(mappedColumnIndex, 10)
						}
					}
				}

					// Clamp highlighting to the reserved mark columns; cells after that are treated as non-mark paragraphs
					const maxMarkColumnIndex = Math.min(cells.length - 1, dataStartIndex + reservedMarkColumns - 1)
					if (columnIndex > maxMarkColumnIndex) {
						columnIndex = maxMarkColumnIndex
					}

					if (columnIndex > 0 && columnIndex < cells.length) {
						const targetCell = cells[columnIndex]
						targetCell.setAttribute('data-color', 'yellow')
						matchedCategories.add(effectiveKey || rowKey)
					}
				})
			})
		} catch (err) {
			console.error('Auto-highlight rubric cells failed:', err)
		}

		container.querySelectorAll('[data-color]').forEach(el => {
			el.style.backgroundColor = highlightColor
			el.style.color = '#000'
		})

		document.body.appendChild(container)

		let nextY = startY
		try {
			const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
			const naturalWidthMm = canvas.width / pxPerMm
			const naturalHeightMm = canvas.height / pxPerMm
			const maxDrawableHeightMm = pageHeight - (margin * 2)
			const scaleForWidth = maxContentWidthMm / naturalWidthMm
			const scale = scaleForWidth // fill available text width; slice vertically as needed
			const targetWidthMm = maxContentWidthMm
			const targetHeightMm = naturalHeightMm * scale
			const xOffset = margin
			let consumedMm = 0

			while (consumedMm < targetHeightMm - 0.01) {
				if (nextY > pageHeight - margin - 5) {
					doc.addPage()
					nextY = margin
				}

				const availableMm = pageHeight - margin - nextY
				if (availableMm <= 0) {
					doc.addPage()
					nextY = margin
				}

				const drawMm = Math.min(availableMm, targetHeightMm - consumedMm)
				const slicePxTop = Math.round(consumedMm * pxPerMm / scale)
				const slicePxHeight = Math.round(drawMm * pxPerMm / scale)

				const sliceCanvas = document.createElement('canvas')
				sliceCanvas.width = canvas.width
				sliceCanvas.height = slicePxHeight
				const ctx = sliceCanvas.getContext('2d')
				ctx.drawImage(canvas, 0, -slicePxTop)

				const sliceData = sliceCanvas.toDataURL('image/png')
				doc.addImage(sliceData, 'PNG', xOffset, nextY, targetWidthMm, drawMm)

				nextY += drawMm + 2
				consumedMm += drawMm
			}
		} catch (error) {
			console.error('Failed to render assessment HTML into PDF:', error)
		} finally {
			document.body.removeChild(container)
		}

		return nextY
	}


	function getSelectedText() {
		const orderedParagraphs = getOrderedParagraphs()
		
		console.log('🔍 DEBUG getSelectedText:', {
			selectedParagraphs: Array.from(selectedParagraphs),
			selectedCount: selectedParagraphs.size,
			totalParagraphs: paragraphs.length,
			orderedParagraphsCount: orderedParagraphs.length
		})
		
		const selectedOrderedParagraphs = Array.from(selectedParagraphs)
			.sort((a, b) => {
				// Find the ordered positions of these paragraph IDs
				const posA = orderedParagraphs.findIndex(item => item.id === a)
				const posB = orderedParagraphs.findIndex(item => item.id === b)
				console.log(`🔍 DEBUG sorting: ${a} at position ${posA}, ${b} at position ${posB}`)
				return posA - posB
			})
			.map(paragraphId => {
				const paragraph = paragraphs.find(p => p.id === paragraphId)
				console.log(`🔍 DEBUG mapping paragraphId ${paragraphId}:`, paragraph)
				
				if (!paragraph) {
					console.log(`❌ ERROR: Paragraph not found for ID: ${paragraphId}`)
					return null
				}
				
				// Handle both string and object formats
				const paragraphText = typeof paragraph === 'string' ? paragraph : paragraph.text
				const cleanedText = cleanParagraphTextForDisplay(paragraphText)
				console.log(`✅ Mapped paragraph ${paragraphId}: "${cleanedText}"`)
				return cleanedText
			})
			.filter(text => text !== null) // Remove null entries
		
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
		
		const finalText = result.join('\n\n')
		console.log('🔍 DEBUG getSelectedText final result:', {
			selectedOrderedParagraphsCount: selectedOrderedParagraphs.length,
			groupedSections: Object.keys(groupedSections),
			resultLength: result.length,
			finalTextLength: finalText.length,
			finalText: finalText.substring(0, 200) + (finalText.length > 200 ? '...' : '')
		})
		
		return finalText
	}

	function handleImageUpload(event) {
		const file = event.target.files[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = function(e) {
			if (typeof e.target.result === 'string') {
				// No studentImage - only header photo for assessment
				saveAssessmentData()
			}
			}
			reader.readAsDataURL(file)
		}
	}

	// Handle assessment header photo upload
	function handleAssessmentHeaderPhotoUpload(event) {
		const file = event.target.files[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = function(e) {
				if (typeof e.target.result === 'string' && currentAssessment) {
					currentAssessment.headerPhoto = e.target.result
					// Save the updated assessment data - header photo is part of assessment, not subject
					saveAssessmentData()
					// Also save subjects to persist the header photo in the assessment object
					saveSubjects()
				}
			}
			reader.readAsDataURL(file)
		}
	}

	function copyToClipboard() {
		console.log('📋 copyToClipboard called')
		let selectedText = getSelectedTextInVisualOrder()
		
		// Convert HTML to plain text for clipboard
		if (selectedText.includes('<')) {
			const tempDiv = document.createElement('div')
			tempDiv.innerHTML = selectedText
			selectedText = tempDiv.textContent || tempDiv.innerText || ''
		}
		
		console.log('📋 copyToClipboard result:', {
			length: selectedText.length,
			text: selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''),
			isEmpty: selectedText.trim() === ''
		})
		
		if (selectedText.trim() === '') {
			showSuccessNotification('ℹ️ Copy cancelled - no paragraphs selected or text is empty. Please select paragraphs first.')
			return
		}
		
		navigator.clipboard.writeText(selectedText)
			.then(() => showSuccessNotification('ℹ️ Text copied to clipboard - selected paragraphs ready for pasting'))
			.catch(() => showSuccessNotification('❌ Copy failed - unable to access clipboard. Please try again or copy manually.'))
	}

		async function generatePDF() {
			console.log('📄 generatePDF called')
		// Check for unentered text in quick-add textareas
		if (currentStudentId) {
			const hasUnenteredText = Object.values(quickAddText).some(text => text && text.trim() !== '')
			if (hasUnenteredText) {
				showSuccessNotification('⚠️ Cannot generate PDF - you have unentered text in the "Add paragraph" field. Please click "Add paragraph" button or clear the text first.')
				return
			}
		}

			let selectedText = getSelectedTextInVisualOrder()
			
		// Convert HTML to plain text for PDF
		if (selectedText.includes('<')) {
			const tempDiv = document.createElement('div')
			tempDiv.innerHTML = selectedText
			selectedText = tempDiv.textContent || tempDiv.innerText || ''
		}
		
			console.log('📄 generatePDF result:', {
				length: selectedText.length,
				text: selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''),
				isEmpty: selectedText.trim() === ''
			})
			
			if (!selectedText || selectedText.trim() === '') {
				showSuccessNotification('ℹ️ PDF generation cancelled - no paragraphs selected or text is empty. Please select paragraphs first.')
				return
			}
			
			// Check for marks warning: category marks > 0 but total marks is 0 or empty
			const calculatedTotal = getTotalMarks()
			const { hasValue: hasAssessmentTotal } = getAssessmentTotalInfo()
			if (calculatedTotal > 0 && !hasAssessmentTotal) {
				showTotalMarksWarning = true
				return
			}

		const defaultMargin = 25 // Slightly larger margin for better breathing room
		const needsLandscape = shouldUseLandscapeForHtml(assessmentHtml, defaultMargin)
		const doc = new jsPDF({ orientation: 'portrait' }) // keep first page portrait; switch later if needed
		const headingText = 'Feedback Report'
		const headingFontSize = 16
		
		// Page dimensions
		const margin = defaultMargin
		const pageWidth = doc.internal.pageSize.getWidth()
		const maxLineWidth = pageWidth - (margin * 2)

		// Prepare heading metrics up-front so spacing is consistent
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(headingFontSize)
		const headingMetrics = doc.getTextDimensions
			? doc.getTextDimensions(headingText)
			: { h: doc.internal.getLineHeight() }
		const headingHeight = headingMetrics?.h || doc.internal.getLineHeight()

		const drawHeading = () => {
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(headingFontSize)
			doc.text(headingText, pageWidth / 2, margin, { align: 'center' })
		}
		
		const runPdf = async (startY) => {
			await generateRestOfPDF(doc, startY, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name, needsLandscape)
		}
		
		// Add full-width header image if available
		if (currentAssessment?.headerPhoto) {
			try {
				await new Promise((resolve) => {
					const img = new Image()
					img.onload = async function() {
						const aspectRatio = img.width / img.height
						
						// Use full width with margins (not edge to edge)
						let imageWidth = pageWidth - (margin * 2)
						let imageHeight = imageWidth / aspectRatio
						
						// Position with margin from top and sides
						const xPosition = margin
						const yPosition = margin
						
						doc.addImage(currentAssessment.headerPhoto, 'JPEG', xPosition, yPosition, imageWidth, imageHeight)
						
						// Draw heading beneath the image
						const headingY = yPosition + imageHeight + headingHeight + 2
						doc.setFont('helvetica', 'bold')
						doc.setFontSize(headingFontSize)
						doc.text(headingText, pageWidth / 2, headingY, { align: 'center' })
						
						// Continue with the rest of the PDF generation
						let currentY = headingY + 10
						await runPdf(currentY)
						resolve()
					}
					img.onerror = async function() {
						drawHeading()
						await runPdf(margin + headingHeight + 6)
						resolve()
					}
					img.src = currentAssessment.headerPhoto
				})
				return
			} catch (error) {
				console.log('Could not add image to PDF:', error)
			}
		}
		
		// If no image, continue with normal PDF generation (with heading and margin)
		drawHeading()
		await runPdf(margin + headingHeight + 6)
	}

	async function generateRestOfPDF(doc, yPosition, margin, pageWidth, maxLineWidth, selectedText, studentName, subjectName, assessmentName, useLandscapeForContent = false) {
		// Try to set a font that's closer to Oxygen (Arial or Helvetica)
		try {
			doc.setFont('helvetica', 'normal')
		} catch (e) {
		// Fallback to default font if helvetica is not available
			console.log('Helvetica not available, using default font')
		}
		
		// Header info anchored at bottom-left of first page
		const pageHeight = doc.internal.pageSize.getHeight()
		const headerLines = []
		if (subjectName) headerLines.push({ text: `Subject: ${subjectName}`, color: [0, 0, 0] })
		if (assessmentName) headerLines.push({ text: `Assessment: ${assessmentName}`, color: [0, 0, 0] })
		if (studentName) headerLines.push({ text: `Student: ${studentName}`, color: [0, 0, 0] })
		const totalMarks = getTotalMarks()
		const { value: assessmentTotal, hasValue: hasAssessmentTotal } = getAssessmentTotalInfo()
		if (totalMarks > 0) {
			const manualTotal = hasAssessmentTotal ? `/${assessmentTotal}` : ''
			headerLines.push({ text: `Total Marks: ${totalMarks}${manualTotal}`, color: [255, 0, 0] })
		}
		const lineSpacing = 10
		const headerHeight = headerLines.length * lineSpacing
		let headerY = pageHeight - margin - headerHeight
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(10)
		headerLines.forEach(({ text, color }) => {
			doc.setTextColor(...color)
			doc.text(text, margin, headerY)
			headerY += lineSpacing
		})
		doc.setTextColor(0, 0, 0)
		
		const contentTopMargin = margin // Keep top padding consistent with page margins
		const addContentPage = () => {
			if (useLandscapeForContent) {
				doc.addPage('a4', 'landscape')
			} else {
				doc.addPage()
			}
		}

		// Move all report content to a new page after the header block
		addContentPage()
		yPosition = contentTopMargin
		let contentPageWidth = doc.internal.pageSize.getWidth()
		let pageHeightBody = doc.internal.pageSize.getHeight()
		let contentMaxLineWidth = contentPageWidth - (margin * 2)
		const contentStartPage = typeof doc.internal.getCurrentPageInfo === 'function'
			? doc.internal.getCurrentPageInfo().pageNumber
			: doc.internal.getNumberOfPages()
		
		// Reset font to normal for content
		doc.setFont('helvetica', 'normal')
		
		// Render assessment HTML (as-is) into the PDF before content
		const matchedCategoriesFromTable = new Set()
		const afterTableY = await renderAssessmentHtmlToPdf(doc, yPosition, margin, contentPageWidth, matchedCategoriesFromTable)
		// Keep table close to the first point without squeezing the rest of the content
		const gapAfterTable = 2
		yPosition = Math.max(margin, afterTableY - gapAfterTable)

		const hasAssessmentHtml = (assessmentHtml || '').trim().length > 0
		const normalizeCategoryName = (name) => (name || '').toString().replace(/\u00a0/g, ' ').trim().toLowerCase()

		const categoriesWithMarks = new Set()
		const mappedCategories = new Set()
		const categoriesWithParagraphMarks = new Set()
		const categoriesWithUnmarkedSelections = new Set()
		const paragraphInfoIndex = buildParagraphInfoIndex()
		const paragraphsToSkip = new Set()
		const normalizeLine = (val) => (val || '').toString().replace(/\u00a0/g, ' ').trim()

		if (hasAssessmentHtml) {
			Object.entries(categoryMarks || {}).forEach(([name, val]) => {
				const num = parseFloat(val)
				if (Number.isFinite(num)) {
					categoriesWithMarks.add(normalizeCategoryName(name))
				}
			})
			Object.values(currentAssessment?.tableRowCategoryMap || {}).forEach(value => {
				mappedCategories.add(normalizeCategoryName(value))
			})
		}

		// Track categories that have selected paragraphs without a mark badge/value
		selectedParagraphs.forEach(id => {
			const info = paragraphInfoIndex[id]
			const para = info || paragraphs.find(p => p.id === id)
			if (!para) return
			const text = typeof para === 'string' ? para : para.text || ''
			const categoryText = info?.category || (text.includes(': ') ? text.split(': ')[0] : '')
			const normalized = normalizeCategoryName(categoryText)
			const markInfo = info?.markInfo || (typeof para === 'object' ? para.markInfo : undefined)
			const hasNumericMark = !!markInfo && [markInfo.numericValue, markInfo.value, markInfo.min, markInfo.max]
				.some(val => Number.isFinite(parseNumericMarkValue(val)))
			const hasRangeMark = !!markInfo && !!parseNumericRange(markInfo.value)
			const hasParaMark = hasNumericMark || hasRangeMark
			const categoryCovered = matchedCategoriesFromTable.has(normalized) || mappedCategories.has(normalized) || categoriesWithMarks.has(normalized) || categoriesWithParagraphMarks.has(normalized)
			if (categoryCovered && hasParaMark) {
				const cleaned = cleanParagraphTextForDisplay(info?.fullText || text)
				const normalizedText = normalizeLine(cleaned)
				const normalizedRaw = normalizeLine(text)
				if (normalizedText.length > 0) paragraphsToSkip.add(normalizedText)
				if (normalizedRaw.length > 0) paragraphsToSkip.add(normalizedRaw)
			}
			if (hasParaMark) {
				categoriesWithParagraphMarks.add(normalized)
			} else {
				categoriesWithUnmarkedSelections.add(normalized)
			}
		})

		const isCategoryCoveredByTable = (normalizedCategory) => {
			if (!hasAssessmentHtml) return false
			// If any selected paragraph in this category has no mark/range, render it under the table
			if (categoriesWithUnmarkedSelections.has(normalizedCategory)) return false
			// Table match/mapping or entered marks/paragraph marks treat it as covered
			if (matchedCategoriesFromTable.has(normalizedCategory) || mappedCategories.has(normalizedCategory)) return true
			if (categoriesWithMarks.has(normalizedCategory) || categoriesWithParagraphMarks.has(normalizedCategory)) return true
			return false
		}

		// Content with comfortable spacing and bold category names
		const firstPageBodyFontSize = 10
		const nextPagesBodyFontSize = 10
		const firstPageLineHeight = 5
		const nextPagesLineHeight = 5 // Tighter spacing to reduce paragraph gaps
		let lineHeight = nextPagesLineHeight
		let currentBodyFontSize = nextPagesBodyFontSize
		const applyBodyFontForCurrentPage = () => {
			const currentPageNumber = typeof doc.internal.getCurrentPageInfo === 'function'
				? doc.internal.getCurrentPageInfo().pageNumber
				: doc.internal.getNumberOfPages()
			const contentPageIndex = Math.max(1, currentPageNumber - contentStartPage + 1)
			const isSecondOrLater = contentPageIndex >= 2
			currentBodyFontSize = isSecondOrLater ? nextPagesBodyFontSize : firstPageBodyFontSize
			lineHeight = isSecondOrLater ? nextPagesLineHeight : firstPageLineHeight
			doc.setFontSize(currentBodyFontSize)
		}
		applyBodyFontForCurrentPage()
		let currentCategory = null
		let skipCurrentCategory = false
		
		// Split the text into lines and process each line
		const rawLines = selectedText.split('\n')
		while (rawLines.length && rawLines[0].trim() === '') {
			rawLines.shift()
		}
		const textLines = []
		rawLines.forEach((line) => {
			const trimmed = line.trim()
			if (trimmed === '' && (textLines[textLines.length - 1] || '').trim() === '') return
			textLines.push(line)
		})
		
		const blankLineGap = () => lineHeight * 0.35
		const headerGap = () => lineHeight * 0.7
		const paragraphGap = () => lineHeight * 0.35
		let previousBlank = false
		for (let i = 0; i < textLines.length; i++) {
			const line = textLines[i]
			// Check if we need a new page
			if (yPosition > pageHeightBody - margin) {
				addContentPage()
				contentPageWidth = doc.internal.pageSize.getWidth()
				pageHeightBody = doc.internal.pageSize.getHeight()
				contentMaxLineWidth = contentPageWidth - (margin * 2)
				applyBodyFontForCurrentPage()
				yPosition = contentTopMargin
			}
			const isBlank = line.trim() === ''
			// Skip blanks entirely when current category is being skipped
			if (skipCurrentCategory && isBlank) {
				continue
			}
			// Skip empty lines but keep comfortable spacing between points
			if (isBlank) {
				if (!previousBlank) {
					yPosition += blankLineGap()
				}
				previousBlank = true
				continue
			}
			previousBlank = false
			
			// Check if this line is a category header
			// A line ending with ':' is treated as a header for bold formatting
			const trimmedLine = line.trim()
			const endsWithColon = trimmedLine.endsWith(':')

			// Check if it's an assessment-specific category (for skip logic)
			const isAssessmentCategory = trimmedLine.includes('Sub Objective') ||
				trimmedLine.includes('Sub Learning Objective') ||
				trimmedLine.includes('Report') ||
				trimmedLine.includes('Decision')

			if (endsWithColon) {
				// Extract category name (everything before the colon)
				const categoryName = line.split(':')[0].trim()
				currentCategory = normalizeCategoryName(categoryName)

				// Only skip if it's an assessment-specific category covered by table
				const shouldSkip = isAssessmentCategory && isCategoryCoveredByTable(currentCategory)
				if (shouldSkip) {
					skipCurrentCategory = true
					continue
				}
				skipCurrentCategory = false

				// Bold font for ALL category headers (any line ending with ':')
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(currentBodyFontSize) // Same size as other content

				doc.text(`${categoryName}:`, margin, yPosition)

				// Reset font to normal for content
				doc.setFont('helvetica', 'normal')
				doc.setFontSize(currentBodyFontSize) // Back to regular size
				yPosition += headerGap() // Controlled gap after headers
			} else {
				if (skipCurrentCategory) continue
				if (paragraphsToSkip.has(normalizeLine(line))) continue
				// Regular content - split long lines
				const wrappedLines = doc.splitTextToSize(line, contentMaxLineWidth)
				wrappedLines.forEach((wrappedLine) => {
					if (yPosition > pageHeightBody - margin) {
						addContentPage()
						contentPageWidth = doc.internal.pageSize.getWidth()
						pageHeightBody = doc.internal.pageSize.getHeight()
						contentMaxLineWidth = contentPageWidth - (margin * 2)
						applyBodyFontForCurrentPage()
						yPosition = contentTopMargin
					}
					doc.text(wrappedLine, margin, yPosition)
					yPosition += lineHeight
				})
				yPosition += paragraphGap() // slight gap between paragraphs
			}
		}
		
		// Generate filename with subject, assessment, and student name
	let filename = 'Feedback-report'
	if (subjectName) filename += `-${subjectName.replace(/[^a-zA-Z0-9]/g, '-')}`
	if (assessmentName) filename += `-${assessmentName.replace(/[^a-zA-Z0-9]/g, '-')}`
	if (studentName) filename += `-${studentName.replace(/[^a-zA-Z0-9]/g, '-')}`
	filename += '.pdf'

	// Try to save to assessment folder using Tauri, fallback to browser download
	try {
		// Get PDF as byte array
		const pdfData = doc.output('arraybuffer')
		const pdfBytes = new Uint8Array(pdfData)

		// Save to assessment-specific folder via Tauri
		const savedPath = await invoke('save_pdf_to_folder', {
			pdfData: Array.from(pdfBytes),
			subjectName: subjectName || null,
			assessmentName: assessmentName || null,
			studentName: studentName || null
		})

		showSuccessNotification(`✅ PDF saved to: ${savedPath}`)
	} catch (error) {
		// Fallback to browser download if Tauri is not available
		console.log('Tauri not available, using browser download', error)
		doc.save(filename)
		showSuccessNotification('ℹ️ PDF generated and downloaded - feedback document ready with selected paragraphs and marks')
	}

	// Auto-save student evaluation data when generating PDF
	if (currentStudentId) {
		saveStudentEvaluation()
	}
}


	onMount(() => {
		loadSubjects()
		initializeDarkMode()

		window.addEventListener('paste', handleStudentPhotoPaste)
		window.addEventListener('pointerdown', handleGlobalPointerDown)
		window.addEventListener('keydown', handleGlobalKeyDown)
		return () => {
			window.removeEventListener('paste', handleStudentPhotoPaste)
			window.removeEventListener('pointerdown', handleGlobalPointerDown)
			window.removeEventListener('keydown', handleGlobalKeyDown)
		}
	})
</script>

<!-- Header -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">Feedback Manager v3.3.4</a>
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
				<li class="nav-item">
					<button
						class="btn btn-outline-light btn-sm ms-2"
						onclick={openHelpPage}
						title="Help"
						aria-label="Open help page"
					>
						<i class="bi bi-question-circle me-1"></i>Help
					</button>
				</li>
				<li class="nav-item">
					<button
						class="btn btn-outline-light btn-sm ms-2"
						onclick={() => showCheckboxDebug = !showCheckboxDebug}
						title="Toggle Checkbox Debug"
						aria-label="Toggle Checkbox Debug"
					>
						<i class="bi bi-check-square"></i>
					</button>
				</li>
				<li class="nav-item">
					<button
						class="btn btn-outline-light btn-sm ms-2"
						onclick={() => showAboutModal = true}
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

<main class="mt-4">
	<div class="container-fluid mb-4">
		<div class="row">
			<!-- Sidebar -->
			<div class="col-lg-3 col-md-4 col-12 mb-4 app-sidebar-column">
				<Sidebar
					{subjects}
					{currentSubject}
					{currentAssessment}
					{currentView}
					{showMobileSidebar}
					{showCalculator}
					percentageRanges={currentAssessment?.percentageRanges || []}
					{categoryMarks}
					onSelectSubject={selectSubject}
					onSelectAssessment={selectAssessment}
					onGoBackToSubjects={goBackToSubjects}
					onGoBackToAssessments={goBackToAssessments}
					onToggleMobileSidebar={() => showMobileSidebar = !showMobileSidebar}
					onToggleShowAddSubject={() => showAddSubject = !showAddSubject}
					onToggleShowAddAssessment={() => showAddAssessment = !showAddAssessment}
					onToggleView={toggleCalculatorView}
					onCopyToClipboard={copyToClipboard}
					onGeneratePDF={generatePDF}
					onSaveStudentEvaluation={saveStudentEvaluation}
					onLoadStudentEvaluation={loadStudentEvaluation}
					onTransferStudentData={() => showStudentTransferModal = true}
					onSaveAssignmentData={() => saveAssessmentData({ force: Boolean(currentStudentId), skipSelections: true })}
					onExportAssignmentSettings={() => showExportModal = true}
					onAddPercentageRange={addPercentageRange}
					onDeletePercentageRange={deletePercentageRange}
					currentStudentId={currentStudentId}
					{studentName}
					{studentPhoto}
				/>
			</div>

			<!-- Main Content -->
			<div class="col-lg-9 col-md-8 col-12 d-flex flex-column app-main-column">
				<!-- Breadcrumb Navigation -->
				{#if currentView !== 'help'}
					<Breadcrumb 
						{currentView}
						{currentSubject}
						{currentAssessment}
						onNavigate={handleBreadcrumbNavigation}
					/>
				{/if}

				{#if currentView === 'subjects'}
					<div class="row">
						<div class="col-12">
							<div class="d-flex justify-content-between align-items-center mb-4">
								<div>
									<h1 class="display-6 mb-2">Subjects</h1>
									<p class="lead text-muted">Manage your subjects and assessments</p>
			</div>
								<button 
									class="btn btn-primary btn-sm"
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
								students={students}
								subjectName={currentSubject?.name || 'Unknown Subject'}
								subjectId={currentSubjectId || ''}
								onSelectAssessment={(assessment) => {
									// STRICT FILTER: Clear ALL data before entering assessment feedback page
									initializeEmptyData()
									
									// Set new assessment context
									currentAssessment = assessment
									currentAssessmentId = assessment.id
									console.log('Selected assessment:', assessment.name, 'Categories:', assessment.categories?.length || 0, assessment.categories)
									updateView('feedback')
									
									// Load ONLY data for this specific assessment
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
								addCheckboxDebug={addCheckboxDebug}
							/>
						</div>
					</div>
				{:else if currentView === 'help'}
					<div class="row">
						<div class="col-12">
							<div class="d-flex justify-content-between align-items-center mb-4">
								<div>
									<h1 class="display-6 mb-2">Help</h1>
									<p class="lead text-body-secondary mb-0">How to use rubric table cell highlighting in PDF</p>
								</div>
								<button
									class="btn btn-outline-secondary"
									onclick={closeHelpPage}
								>
									<i class="bi bi-arrow-left me-2"></i>Back
								</button>
							</div>

							<div class="card border-info mb-3">
								<div class="card-header bg-info text-white">
									<strong>Quick Steps</strong>
								</div>
								<div class="card-body">
									<ol class="mb-0">
										<li class="mb-2">Open an assessment, go to <strong>Feedback</strong>, then open the <strong>Settings</strong> tab.</li>
										<li class="mb-2">In <strong>Assessment HTML (included in PDF)</strong>, paste your rubric table HTML.</li>
										<li class="mb-2">In <strong>Match table rows to categories</strong>, map each row label to the matching category.</li>
										<li class="mb-2">In <strong>Map paragraph position to table columns</strong>, choose which column is highlighted for 1st, 2nd, 3rd paragraph, and so on.</li>
										<li class="mb-2">Select at least one paragraph in a category (from Enter Data). The first selected paragraph in that category is used for position mapping.</li>
										<li>Click <strong>Print to Download</strong> to generate the PDF. The mapped rubric cell is highlighted automatically.</li>
									</ol>
								</div>
							</div>

							<div class="card border-primary mb-3">
								<div class="card-header bg-primary text-white">
									<strong>Useful HTML Snippet</strong>
								</div>
								<div class="card-body">
									<p class="mb-2">Use this snippet when you need quick horizontal spacing in your pasted table HTML:</p>
									<code class="d-block border rounded p-2 bg-body-tertiary user-select-all">{TABLE_HTML_SPACER_SNIPPET}</code>
									<p class="small text-body-secondary mb-0 mt-2">You can also use the <strong>Insert snippet</strong> button in Assessment HTML settings to add it automatically.</p>
								</div>
							</div>

							<div class="card border-warning mb-3">
								<div class="card-header bg-warning text-dark">
									<strong>Important Notes</strong>
								</div>
								<div class="card-body">
									<ul class="mb-0">
										<li class="mb-2">Highlighting is applied in the generated PDF render, not as a live color fill in the on-page HTML editor.</li>
										<li class="mb-2">If row labels differ from category names, row mapping is required.</li>
										<li class="mb-2">If no paragraph is selected for a category, no highlight is applied for that row.</li>
										<li>After changing mappings, use <strong>Save Assignment</strong> before generating PDF.</li>
									</ul>
								</div>
							</div>

							<div class="card border-secondary">
								<div class="card-header bg-secondary text-white">
									<strong>Troubleshooting</strong>
								</div>
								<div class="card-body">
									<ul class="mb-0">
										<li class="mb-2">Nothing highlighted: check row mapping + column mapping + paragraph selection.</li>
										<li class="mb-2">Wrong cell highlighted: verify paragraph order in that category and adjust position-to-column mapping.</li>
										<li>Marks column not updating: ensure category marks are entered and row mapping matches the category.</li>
									</ul>
								</div>
							</div>
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
										class="btn btn-outline-secondary btn-sm"
										onclick={() => updateView('assessments')}
									>
										<i class="bi bi-arrow-left me-2"></i>Back to Assessments
									</button>
								</div>
						</div>
					</div>

					<div class="row mb-3">
						<div class="col-12">
							<div class="feedback-tab-bar d-flex flex-wrap gap-2">
								<button type="button" class="btn btn-sm {activeFeedbackTab === 'enter-data' ? 'btn-primary' : 'btn-outline-secondary'}" onclick={() => activeFeedbackTab = 'enter-data'}>
									<i class="bi bi-pencil-square me-1"></i>Enter Data
								</button>
								<button type="button" class="btn btn-sm {activeFeedbackTab === 'settings' ? 'btn-primary' : 'btn-outline-secondary'}" onclick={() => activeFeedbackTab = 'settings'}>
									<i class="bi bi-gear me-1"></i>Settings
								</button>
							</div>
						</div>
					</div>

					<div class:disabled-tab-content={activeFeedbackTab !== 'settings'}>

						<!-- Assessment Header Photo Section -->
						<div class="row mb-3">
							<div class="col-12">
								<div class="card border-primary">
									<div class="card-header bg-primary text-white py-2">
										<h5 class="card-title mb-0">
											<i class="bi bi-image me-2"></i>Assessment Header Photo
										</h5>
									</div>
									<div class="card-body py-2">
										<div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-3">
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
													style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0;"
												>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Assessment HTML (for PDF) -->
						<div class="row mb-3">
							<div class="col-12">
								<div class="card border-warning">
									<div class="card-header bg-warning text-dark py-2">
										<div class="d-flex align-items-center justify-content-between">
											<h5 class="card-title mb-0">
												<i class="bi bi-table me-2"></i>Assessment HTML (included in PDF)
											</h5>
											<button
												class="btn btn-sm btn-light"
												onclick={() => showAssessmentHtml = !showAssessmentHtml}
												aria-label={showAssessmentHtml ? 'Hide HTML input' : 'Show HTML input'}
											>
												{showAssessmentHtml ? 'Hide' : 'Show'}
											</button>
										</div>
									</div>
									{#if showAssessmentHtml}
										<div class="card-body py-2">
									<label class="form-label fw-bold" for="assessmentHtmlInput">Paste HTML snippet (e.g., rubric table):</label>
									<p class="text-muted mb-2 small">If you want a table-based result in the PDF, paste your HTML table below, then click Generate PDF.</p>
									<div class="alert alert-secondary py-2">
										<div class="d-flex flex-column flex-md-row align-items-start gap-2">
											<div class="flex-grow-1">
												<div class="small fw-semibold">Useful spacer snippet</div>
												<code class="d-block small user-select-all">{TABLE_HTML_SPACER_SNIPPET}</code>
											</div>
											<button
												type="button"
												class="btn btn-outline-secondary btn-sm"
												onclick={insertTableHtmlSpacerSnippet}
											>
												<i class="bi bi-plus-square me-1"></i>Insert snippet
											</button>
										</div>
									</div>
									<textarea
										id="assessmentHtmlInput"
										class="form-control"
												rows="6"
												bind:value={assessmentHtml}
												oninput={(e) => {
													assessmentHtml = e.target.value
													if (currentAssessment) {
														currentAssessment.rubricHtml = assessmentHtml
														if (!currentAssessment.tableRowCategoryMap) {
															currentAssessment.tableRowCategoryMap = {}
														}
													}
												}}
												placeholder="&lt;table&gt;...&lt;/table&gt;"
											></textarea>
											{#if tableRowLabels.length}
												<div class="mt-3">
													<div class="d-flex align-items-center justify-content-between mb-2">
														<span class="fw-bold">Match table rows to categories</span>
														<span class="text-muted small">{tableRowLabels.length} row{tableRowLabels.length !== 1 ? 's' : ''} detected</span>
													</div>
													<div class="table-responsive">
														<table class="table table-sm table-bordered mb-0">
															<thead class="table-light">
																<tr>
																	<th style="width: 40%;">Row Label</th>
																	<th>Match to Category</th>
																</tr>
															</thead>
															<tbody>
																{#each tableRowLabels as label (label)}
																	{@const normalizedLabel = normalizeCategoryLabel(label)}
																	<tr>
																		<td class="align-middle">
																			<small class="fw-semibold text-break">{label}</small>
																		</td>
																		<td>
																			<select
																				class="form-select form-select-sm"
																				value={tableRowCategoryMap[normalizedLabel] || ''}
																				onchange={(e) => {
																					const selected = e.currentTarget.value
																					const key = normalizedLabel
																					const updated = { ...tableRowCategoryMap }
																					if (selected) {
																						updated[key] = selected
																					} else {
																						delete updated[key]
																					}
																					tableRowCategoryMap = updated
																					if (currentAssessment) {
																						currentAssessment.tableRowCategoryMap = updated
																					}
																					saveAssessmentData({ force: true, skipSelections: true })
																				}}
																			>
																				<option value="">Auto (match by name)</option>
																				{#each (currentAssessment?.categories || []) as cat (cat.id)}
																					<option value={cat.name}>{cat.name}</option>
																				{/each}
																			</select>
																		</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												</div>
											{/if}
											{#if tableColumnHeaders.length}
												<div class="mt-3">
													<div class="d-flex align-items-center justify-content-between mb-2">
														<span class="fw-bold">Map paragraph position to table columns</span>
														<span class="text-muted small">Map which paragraph (1st, 2nd, etc.) highlights which column</span>
													</div>
													<div class="table-responsive">
														<table class="table table-sm table-bordered mb-2">
															<thead class="table-light">
																<tr>
																	<th style="width: 150px;">Paragraph Position</th>
																	<th>Highlights Column</th>
																</tr>
															</thead>
															<tbody>
																{#each Array(5).fill(0).map((_, i) => i + 1) as position (position)}
																	<tr>
																		<td class="text-center align-middle">
																			<span class="badge bg-info">{position}{position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} paragraph</span>
																		</td>
																		<td>
																			<select
																				class="form-select form-select-sm"
																				bind:value={tableColumnMarkMap[position]}
																				onchange={() => saveAssessmentData({ force: true, skipSelections: true })}
																			>
																				<option value="">Select column...</option>
																				{#each tableColumnHeaders as header (header.index)}
																					<option value={header.index}>{header.text}</option>
																				{/each}
																			</select>
																		</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
													<div class="alert alert-info mt-1 mb-0 py-2 small">
														<i class="bi bi-info-circle me-1"></i>
														Column highlighting happens automatically based on marks or paragraph colors (green=high, yellow=medium, red=low).
													</div>
												</div>
											{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

						<div class="row mb-3">
							<div class="col-12">
								<div class="card border-secondary">
									<div class="card-header bg-light py-2">
										<h5 class="card-title mb-0">
											<i class="bi bi-stars me-2"></i>AI Marking Context
										</h5>
									</div>
									<div class="card-body py-3">
									<div class="row g-3">
										<div class="col-12">
											<div class="alert alert-light border mb-0 py-2 small">
												<span class="badge text-bg-dark me-2">System</span>Global AI behaviour rules
												<span class="badge text-bg-info ms-3 me-2">Prompt</span>Assessment-specific instructions
												<span class="badge text-bg-secondary ms-3 me-2">RAG</span>Uploaded reference files and rubric context
											</div>
										</div>
										<div class="col-12">
											<label for="globalAiSystemInstructions" class="form-label fw-bold d-flex align-items-center gap-2">
												<span>Global AI Marking Instructions</span>
												<span class="badge text-bg-dark">System</span>
											</label>
											<textarea
												id="globalAiSystemInstructions"
												class="form-control form-control-sm"
												rows="3"
												bind:value={globalAiSystemInstructions}
												placeholder="Example: Always be strict, concise, evidence-based, and do not reward partially implied knowledge."
												onchange={persistGlobalAiSettings}
											></textarea>
											<div class="form-text">System instructions control how the model behaves across every assessment.</div>
										</div>
										<div class="col-md-4">
											<label for="academicLevelInput" class="form-label fw-bold">Academic Level</label>
												<input
													id="academicLevelInput"
													type="text"
													class="form-control form-control-sm"
													bind:value={currentAssessment.academicLevel}
													placeholder="e.g. NZQF Level 6"
													onchange={persistAssessmentAiSettings}
												>
											</div>
											<div class="col-md-8">
												<label for="questionTextInput" class="form-label fw-bold">Assessment Question or Brief</label>
												<textarea
													id="questionTextInput"
													class="form-control form-control-sm"
													rows="3"
													bind:value={currentAssessment.questionText}
													placeholder="Paste the assessment question, brief, or task prompt here..."
													onchange={persistAssessmentAiSettings}
												></textarea>
											</div>
										<div class="col-12">
											<label for="moderationNotesInput" class="form-label fw-bold d-flex align-items-center gap-2">
												<span>Assessment-Specific Marking Instructions</span>
												<span class="badge text-bg-info">Prompt</span>
											</label>
											<textarea
												id="moderationNotesInput"
												class="form-control form-control-sm"
												rows="3"
												bind:value={currentAssessment.aiModerationNotes}
												placeholder="Example: For this assessment, prioritise industry terminology and penalise missing references."
												onchange={persistAssessmentAiSettings}
											></textarea>
											<div class="form-text">Prompt instructions apply only to this assessment. They are not RAG files and they are not global system rules.</div>
										</div>
										<div class="col-12">
											<div class="border rounded p-3 bg-body-tertiary">
												<div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-2">
													<div>
														<div class="fw-bold d-flex align-items-center gap-2">
															<span>Assessment Reference Uploads</span>
															<span class="badge text-bg-secondary">RAG</span>
														</div>
														<div class="small text-muted">Upload shared assessment documents for retrieval context: {getSupportedUploadLabel()}.</div>
													</div>
												</div>
													<div class="row g-2 align-items-end">
														<div class="col-md-4">
															<label for="assessmentDocumentType" class="form-label fw-bold small">Document Type</label>
															<select id="assessmentDocumentType" class="form-select form-select-sm" bind:value={selectedAssessmentDocumentType}>
																{#each ASSESSMENT_DOCUMENT_TYPES as option}
																	<option value={option.value}>{option.label}</option>
																{/each}
															</select>
														</div>
														<div class="col-md-8">
															<label for="assessmentDocumentUpload" class="form-label fw-bold small">Upload Files</label>
															<input
																id="assessmentDocumentUpload"
																type="file"
																class="form-control form-control-sm"
																accept=".pdf,.docx,.txt,.md,.html,.htm,.csv,.json"
																multiple
																onchange={handleAssessmentReferenceUpload}
																disabled={uploadingAssessmentDocument}
															>
														</div>
													</div>
													{#if assessmentReferenceDocuments.length > 0}
														<div class="list-group list-group-flush mt-3 border rounded">
															{#each assessmentReferenceDocuments as document}
																<div class="list-group-item d-flex flex-column flex-lg-row justify-content-between gap-2 align-items-lg-start">
																	<div>
																		<div class="fw-semibold">{document.name}</div>
																	<div class="small text-muted">{getDocumentTypeLabel(document.documentType)} | {document.extractedText ? document.extractedText.length.toLocaleString() : 0} characters</div>
																	</div>
																	<button class="btn btn-outline-danger btn-sm" type="button" aria-label={`Remove ${document.name}`} onclick={() => removeAssessmentReferenceDocument(document.id)}>
																		<i class="bi bi-trash"></i>
																	</button>
																</div>
															{/each}
														</div>
													{/if}
												</div>
											</div>
											<div class="col-12 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2">
												<div class="small text-muted">
													Vector retrieval index: {assessmentVectorIndex?.createdAt ? `built ${new Date(assessmentVectorIndex.createdAt).toLocaleString()}` : 'not built yet'}
												</div>
												<button
													class="btn btn-outline-secondary btn-sm"
													type="button"
													onclick={buildAssessmentRetrievalIndex}
													disabled={buildingAssessmentVectorIndex}
												>
													{#if buildingAssessmentVectorIndex}
														<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
														Building index...
													{:else}
														<i class="bi bi-diagram-3 me-1"></i>Build Retrieval Index
													{/if}
												</button>
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
									<!-- Category Marking Mode Display -->
									<div class="mb-3">
										<div class="form-label fw-bold">Category Type:</div>
										{#if selectedCategory}
											{@const categoryMode = getCategoryMarkingMode(selectedCategory)}
											<div class="alert alert-light border d-flex align-items-center mb-0">
												<i class="bi bi-info-circle me-2 text-primary"></i>
												<div>
													<strong>{selectedCategory}</strong> uses 
													<strong>
														{categoryMode === 'percentage' ? 'percentage' : categoryMode === 'fixed' ? 'fixed' : 'manual'}
													</strong>
													marking. Change this in the Categories list above if needed.
												</div>
											</div>
										{:else}
											<div class="alert alert-info d-flex align-items-center mb-0" role="alert">
												<i class="bi bi-info-circle me-2"></i>
												<span>Select a category to view its marking type.</span>
											</div>
										{/if}
									</div>

									<!-- Percentage Mode Instruction -->
									{#if selectedCategory && currentCategoryMarkingMode === 'percentage'}
										<div class="alert alert-info d-flex align-items-center mb-3" role="alert">
											<i class="bi bi-lightbulb me-2"></i>
											<div>
												<strong>How to use Percentage Mode:</strong>
												<div class="small mt-1">Add color ranges in Calculator sidebar once (click <i class="bi bi-calculator"></i> icon). Ranges automatically apply to {selectedCategory}.</div>
											</div>
										</div>
									{/if}

										<!-- Assessment Mark Ranges Display - Only for Percentage Mode -->
										{#if selectedCategory}
											{@const selectedCategoryAllocatedMarks = getCategoryAllocatedMarks(selectedCategory)}
											{#if currentCategoryMarkingMode === 'percentage' && selectedCategoryAllocatedMarks && currentAssessment?.percentageRanges && currentAssessment.percentageRanges.length > 0}
												<div class="mb-3 border rounded p-3 bg-light mark-range-panel">
													<h6 class="fw-bold mb-2 text-primary">
														<i class="bi bi-bar-chart-fill me-2"></i>Mark Ranges for {selectedCategory}
													</h6>
													<div class="d-flex flex-wrap gap-2">
														{#each getCategoryMarkRanges(selectedCategoryAllocatedMarks, currentAssessment.percentageRanges) as markRange}
															<div class="badge p-2" style="background-color: {markRange.color}; color: white; font-size: 0.85rem;">
																{markRange.range}
															</div>
														{/each}
													</div>
													<small class="text-muted d-block mt-2">
														<i class="bi bi-info-circle me-1"></i>Ranges calculated from {selectedCategoryAllocatedMarks} marks for this category. Adjust color percentages via the calculator sidebar.
													</small>
												</div>
											{/if}
										{/if}

									<!-- Category and Knowledge Area Selection -->
									{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
										<div class="row g-2 mb-3">
											<div class="col-12">
												<label for="knowledgeAreaSelect" class="form-label fw-bold">Select Knowledge Area:</label>
												<select
													id="knowledgeAreaSelect"
													class="form-select"
													bind:value={selectedKnowledgeArea}
												>
													<option value="">Choose a knowledge area...</option>
													{#each (currentAssessment?.knowledgeAreas || []) as area}
														<option value={area}>{area}</option>
													{/each}
												</select>
											</div>
											<div class="col-12">
												<label for="categorySelect" class="form-label fw-bold mb-1">Select Category:</label>
												<select
													id="categorySelect"
													class="form-select"
													bind:value={selectedCategory}
												>
													<option value="">Choose a category...</option>
													{#each (currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999))) as category}
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
										</div>
									{/if}

									{#if needsCategorySelection() && !selectedCategory}
										<div class="alert alert-warning d-flex align-items-center mb-3" role="alert">
											<i class="bi bi-exclamation-triangle-fill me-2"></i>
											<strong>Warning:</strong> Please select a category first to properly organize this paragraph.
										</div>
									{/if}

										<!-- Color Selection -->
										<div class="mb-3">
											<label for="colorSelect" class="form-label fw-bold">Paragraph Color:</label>
											<select id="colorSelect" class="form-select" bind:value={selectedColor}>
												<option value="">⚪ No Color</option>
												<option value="red">🔴 Red</option>
												<option value="orange">🟠 Orange</option>
												<option value="yellow">🟡 Yellow</option>
												<option value="lightgreen" style="color: #20c997;">🟢 Light Green</option>
												<option value="green">🟢 Green</option>
											</select>
											<small class="text-muted">Selected: {selectedColor || 'No Color'} ({selectedColor ? getColorHex(selectedColor) : 'None'})</small>
										</div>

									<!-- Mark Input for Fixed Mode -->
									{#if currentCategoryMarkingMode === 'fixed' && selectedColor && selectedCategory}
										<div class="mb-3">
											<label for="colorMarkInput" class="form-label fw-bold">Mark for this Color:</label>
											<input
												id="colorMarkInput"
												type="text"
												class="form-control"
												bind:value={selectedColorMark}
												placeholder="Enter mark value..."
												onchange={handleColorMarkChange}
											>
											<small class="text-muted">
												Category: {selectedCategory}
												{#if currentAssessment.categories?.find(c => c.name === selectedCategory)?.allocatedMarks}
													(Max: {currentAssessment.categories?.find(c => c.name === selectedCategory)?.allocatedMarks} marks)
												{/if}
											</small>
										</div>
									{/if}

									<div class="mb-3">
										<label for="paragraphInput" class="form-label fw-bold">New paragraph:</label>
										<div class="input-group input-group-sm">
											<textarea 
												id="paragraphInput" 
												class="form-control form-control-sm" 
												rows="4" 
												bind:value={newParagraph} 
												placeholder="Type your paragraph here..."
											></textarea>
											<button class="btn btn-primary btn-sm" type="button" onclick={addParagraph} style="min-width: 120px;">
												<i class="bi bi-plus-circle me-2"></i>Add Paragraph
											</button>
											<div class="mx-1"></div>
											<button 
												class="btn btn-outline-info btn-sm" 
												type="button" 
												onclick={() => showImportModal = true}
												title="Import paragraphs from other assignments"
												style="min-width: 120px;"
											>
												<i class="bi bi-download me-2"></i>Import
											</button>
										</div>
									</div>
									
									<!-- Categories and Knowledge Areas Management -->
									<div class="mb-3">
										<div class="d-flex justify-content-between align-items-center mb-3">
											<div class="d-flex align-items-center gap-2">
												<button
													class="btn btn-link p-0 text-decoration-none text-dark"
													onclick={() => showCategoriesKnowledgeSection = !showCategoriesKnowledgeSection}
													title={showCategoriesKnowledgeSection ? 'Collapse' : 'Expand'}
													aria-label={showCategoriesKnowledgeSection ? 'Collapse assessment configuration' : 'Expand assessment configuration'}
												>
													<i class="bi bi-{showCategoriesKnowledgeSection ? 'dash' : 'plus'}-square me-1"></i>
												</button>
												<div class="form-label fw-bold mb-0">Assessment Configuration:</div>
												<small class="text-muted">{currentAssessment?.categories?.length || 0} categories, {(currentAssessment?.knowledgeAreas || []).length} areas</small>
											</div>
											<button
												class="btn btn-outline-secondary btn-sm"
												onclick={() => showAddCategoryKnowledgeArea = !showAddCategoryKnowledgeArea}
											>
												<i class="bi bi-plus-circle me-1"></i>Add Category or Knowledge Area
											</button>
										</div>

										{#if showCategoriesKnowledgeSection}
											<!-- Knowledge Areas Section -->
											<div class="mb-3">
												<div class="form-label fw-bold">Knowledge Areas:</div>
												{#if showAddCategoryKnowledgeArea}
											<!-- Add Knowledge Area Form -->
											<div class="mb-3">
												<label for="knowledgeAreaName" class="form-label">Knowledge Area Name:</label>
												<div class="input-group">
													<input
														id="knowledgeAreaName"
														type="text"
														class="form-control form-control-sm"
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
										{#if (currentAssessment?.knowledgeAreas || []).length > 0}
											<div class="mb-2">
												<div class="d-flex flex-wrap gap-1">
													{#each (currentAssessment?.knowledgeAreas || []) as area}
														<div class="d-flex align-items-center bg-light border rounded px-1 py-0 small">
															<span class="text-muted me-1">{area}</span>
																<button 
																class="btn btn-sm p-0 border-0 text-danger" style="font-size: 0.5rem; line-height: 0.8; padding: 0.05rem 0.1rem;"
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
											<div class="form-label fw-bold mb-0">Categories:</div>
											<small class="text-muted">{currentAssessment?.categories?.length || 0} categories</small>
										</div>
										
										{#if showAddCategoryKnowledgeArea}
											<!-- Add Category Form -->
											<div class="mb-3">
													<div class="input-group">
														<input
															id="categoryName"
															type="text"
															class="form-control form-control-sm"
														placeholder="Enter category name..."
														bind:value={newCategoryName}
														onkeydown={(e) => {
															if (e.key === 'Enter') {
																e.preventDefault();
																addCategory();
															}
														}}
													>
													<select
														id="categoryMarkingMode"
															class="form-select form-select-sm"
															bind:value={newCategoryMarkingMode}
															style="width: 140px;"
														>
															<option value="none">Type: None</option>
															<option value="percentage">Type: Percentage</option>
															<option value="fixed">Type: Fixed</option>
														</select>
														{#if newCategoryMarkingMode === 'percentage'}
															<input
																type="number"
																class="form-control form-control-sm"
																placeholder="Marks"
																min="0"
																step="0.5"
																style="max-width: 120px;"
																bind:value={newCategoryAllocatedMarks}
															>
														{/if}
														<button 
															class="btn btn-outline-primary"
															onclick={addCategory}
															disabled={
																!newCategoryName.trim() ||
																(newCategoryMarkingMode === 'percentage' && (newCategoryAllocatedMarks === '' || Number.isNaN(parseFloat(newCategoryAllocatedMarks)) || parseFloat(newCategoryAllocatedMarks) <= 0))
															}
														>
															<i class="bi bi-plus-circle me-1"></i>Add
														</button>
												</div>
												<small class="text-muted">Select the category type to determine how its paragraphs are marked.</small>
											</div>
										{/if}
										
										<!-- Categories List - Compact Horizontal -->
										{#if currentAssessment?.categories && currentAssessment.categories.length > 0}
											<div class="mb-2">
												<div class="d-flex flex-wrap gap-1">
													{#each (currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999))) as category, index}
														<div class="d-flex align-items-center bg-light border rounded px-2 py-1 small">
															<span class="text-muted me-1">
																{category.name}
																{#if category.allocatedMarks}
																	<span class="text-primary">({category.allocatedMarks})</span>
																{/if}
																{#if category.markingMode}
																	<span class="badge bg-info text-white" style="font-size: 0.6rem; padding: 0.1rem 0.3rem;">
																		{category.markingMode === 'percentage' ? '%' : category.markingMode === 'fixed' ? '123' : '⊗'}
																	</span>
																{/if}
															</span>
															<button
																class="btn btn-sm p-0 border-0 text-primary me-1"
																style="font-size: 0.7rem; line-height: 0.8; padding: 0.05rem 0.2rem;"
																onclick={() => openCategoryEditModal(category)}
																title="Edit category marking mode"
																aria-label="Edit category marking mode"
															>
																<i class="bi bi-pencil"></i>
															</button>
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
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Assessment Header Photo Display (if uploaded) -->
					{#if currentAssessment?.headerPhoto}
						<div class="row mb-3">
							<div class="col-12">
								<div class="card border-primary">
									<div class="card-header bg-primary text-white py-2">
										<h5 class="card-title mb-0">
											<i class="bi bi-image me-2"></i>Assessment Header Photo
										</h5>
									</div>
									<div class="card-body p-0">
										<div class="text-center">
											<img 
												src={currentAssessment.headerPhoto} 
												alt="Assessment Header" 
												class="rounded-bottom w-100" style="max-height: 600px; object-fit: contain;"
											>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
					</div>

					<div class:disabled-tab-content={activeFeedbackTab !== 'enter-data'}>
					<!-- Student Info Section -->
					<div class="row mb-3">
						<div class="col-12">
							<div class="card border-info">
								<div class="card-header bg-info text-white py-2">
									<h5 class="card-title mb-0">
										<i class="bi bi-person-circle me-2"></i>Student Information
									</h5>
								</div>
								<div class="card-body py-2">
									<div class="row g-3 ai-marking-context-grid">
										<div class="col-12">
											<div class="d-flex flex-column flex-md-row gap-3 align-items-start mb-3">
												<div>
													<div
														class="student-photo-paste-box {studentPhoto ? 'has-photo' : ''}"
														tabindex="0"
														role="button"
														aria-label="Paste student image"
														title="Click here and press Cmd+V to paste a student image"
														onclick={(e) => e.currentTarget.focus()}
														onkeydown={(e) => {
															if (e.key === 'Enter' || e.key === ' ') {
																e.preventDefault()
																e.currentTarget.focus()
															}
														}}
														onpaste={handleStudentPhotoPasteBox}
													>
														{#if studentPhoto}
															<img src={studentPhoto} alt="Student" class="student-photo-preview">
														{:else}
															<div class="student-photo-paste-content">
																<i class="bi bi-image fs-5"></i>
																<div class="student-photo-paste-hint mt-1">Cmd+V</div>
															</div>
														{/if}
													</div>
												</div>
												<div class="flex-grow-1 w-100">
											<label for="studentSelect" class="form-label fw-bold">Student:</label>
											<div class="d-flex gap-2">
												<div class="student-picker flex-grow-1" bind:this={studentPickerContainer}>
													<button
														id="studentSelect"
														type="button"
														class="student-picker-toggle"
														onclick={toggleStudentPicker}
														aria-expanded={showStudentPicker}
														aria-haspopup="listbox"
													>
														<div class="student-picker-trigger">
															{#if currentStudentId && studentPhoto}
																<img src={studentPhoto} alt="Selected student" class="student-picker-avatar-image">
															{:else}
																<span class="student-picker-avatar-placeholder">
																	{#if currentStudentId}
																		{getStudentInitials(getCurrentStudent())}
																	{:else}
																		<i class="bi bi-person"></i>
																	{/if}
																</span>
															{/if}
															<span class="student-picker-label">{currentStudentId ? (getCurrentStudent()?.displayName || 'Selected student') : 'Select a student...'}</span>
														</div>
														<i class="bi bi-chevron-down small"></i>
													</button>

													{#if showStudentPicker}
														<div class="student-picker-menu shadow-sm">
															<div class="student-picker-search border-bottom p-2">
																<input
																	type="text"
																	class="form-control form-control-sm"
																	placeholder="Search students..."
																	bind:value={studentPickerSearch}
																	onclick={(e) => e.stopPropagation()}
																>
															</div>
															<div class="student-picker-options" role="listbox">
																<button type="button" class="student-picker-option {currentStudentId ? '' : 'is-active'}" onclick={() => chooseStudentFromPicker('')}>
																	<span class="student-picker-avatar-placeholder"><i class="bi bi-person"></i></span>
																	<span class="student-picker-option-label">Select a student...</span>
																	{#if !currentStudentId}
																		<i class="bi bi-check2 student-picker-check"></i>
																	{/if}
																</button>
																{#if getFilteredStudents().length === 0}
																	<div class="student-picker-empty">No matching students</div>
																{:else}
																	{#each getFilteredStudents() as student}
																		<button
																			type="button"
																			class="student-picker-option {student.id === currentStudentId ? 'is-active' : ''}"
																			onclick={() => chooseStudentFromPicker(student.id)}
																		>
																			{#if getDisplayedStudentPhoto(student)}
																				<img src={getDisplayedStudentPhoto(student)} alt={student.displayName} class="student-picker-avatar-image">
																			{:else}
																				<span class="student-picker-avatar-placeholder">{getStudentInitials(student)}</span>
																			{/if}
																			<span class="student-picker-option-label">{student.displayName}</span>
																			{#if student.id === currentStudentId}
																				<i class="bi bi-check2 student-picker-check"></i>
																			{/if}
																		</button>
																	{/each}
																{/if}
															</div>
														</div>
													{/if}
												</div>
												<button
													class="btn btn-outline-primary"
													type="button"
													onclick={() => showAddStudent = true}
													title="Add new student"
													aria-label="Add new student"
												>
													<i class="bi bi-person-plus"></i>
												</button>
												<button
													class="btn btn-outline-secondary"
													type="button"
													onclick={() => showStudentManager = true}
													title="Manage students"
													aria-label="Manage students"
												>
													<i class="bi bi-gear"></i>
												</button>
											</div>
											{#if currentStudentId}
												<div class="mt-2">
													<div class="alert alert-info py-2 mb-0">
														<i class="bi bi-person-check me-2"></i>
														<strong>Selected Student:</strong> {getCurrentStudent()?.displayName || 'Loading...'}
													</div>
												</div>
											{/if}
												</div>
											</div>
											<div class="mt-3">
												<label for="studentSubmissionInput" class="form-label fw-bold d-flex align-items-center gap-2">
													<span>Student Submission or Evidence Notes</span>
													<span class="badge text-bg-primary">Input</span>
												</label>
											<textarea
												id="studentSubmissionInput"
												class="form-control form-control-sm student-submission-input"
												rows="5"
												bind:value={studentSubmissionText}
												placeholder="Paste the student's submission, viva notes, or assessor evidence here for AI-assisted marking..."
												disabled={!currentStudentId}
											></textarea>
												<div class="border rounded p-3 bg-body-tertiary mt-3">
													<div class="fw-bold d-flex align-items-center gap-2">
														<span>Student Uploads</span>
														<span class="badge text-bg-primary">Input</span>
													</div>
													<div class="small text-muted mb-2">Upload answer/report or extra evidence files. These are saved with this assessment.</div>
													<div class="row g-2 align-items-end">
														<div class="col-md-4">
															<label for="studentDocumentType" class="form-label fw-bold small">File Type</label>
													<select id="studentDocumentType" class="form-select form-select-sm" bind:value={selectedStudentDocumentType} disabled={!currentStudentId || uploadingStudentDocument}>
																{#each STUDENT_DOCUMENT_TYPES as option}
																	<option value={option.value}>{option.label}</option>
																{/each}
															</select>
														</div>
														<div class="col-md-8">
															<label for="studentDocumentUpload" class="form-label fw-bold small">Upload Files</label>
															<input
																id="studentDocumentUpload"
																type="file"
																class="form-control form-control-sm"
																accept=".pdf,.docx,.txt,.md,.html,.htm,.csv,.json"
														multiple
														onchange={handleStudentSubmissionUpload}
														disabled={!currentStudentId || uploadingStudentDocument}
													>
												</div>
											</div>
											{#if !currentStudentId}
												<div class="small text-body-secondary mt-2">Select a student to enable student document uploads.</div>
											{/if}
													{#if studentSubmissionDocuments.length > 0}
														<div class="list-group list-group-flush mt-3 border rounded">
															{#each studentSubmissionDocuments as document}
																<div class="list-group-item d-flex flex-column flex-lg-row justify-content-between gap-2 align-items-lg-start">
																	<div>
																		<div class="fw-semibold">{document.name}</div>
																		<div class="small text-muted">{getDocumentTypeLabel(document.documentType, 'student')} | {document.extractedText ? document.extractedText.length.toLocaleString() : 0} characters</div>
																	</div>
																	<button class="btn btn-outline-danger btn-sm" type="button" aria-label={`Remove ${document.name}`} onclick={() => removeStudentSubmissionDocument(document.id)}>
																		<i class="bi bi-trash"></i>
																	</button>
																</div>
															{/each}
														</div>
													{/if}
												</div>
												<div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 mt-2">
													<div class="text-muted small">AI uses this text, uploaded student files, the rubric, shared assessment files, and prior saved feedback for the same assessment.</div>
													<button
														class="btn btn-outline-primary btn-sm"
														type="button"
														onclick={draftFeedbackWithAI}
														disabled={!currentStudentId || aiDraftingFeedback}
													>
														{#if aiDraftingFeedback}
															<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
															Drafting feedback...
														{:else}
															<i class="bi bi-magic me-1"></i>Draft Feedback with AI
														{/if}
													</button>
												</div>
											</div>
											{#if aiDraftOverallFeedback}
												<div class="alert alert-secondary mt-3 mb-0 py-2">
													<div class="fw-bold mb-1">AI Overall Feedback</div>
													{#if aiRetrievalMode}
														<div class="small text-muted mb-1">Retrieval mode: {aiRetrievalMode}</div>
													{/if}
													<div>{aiDraftOverallFeedback}</div>
													{#if aiDraftRetrievedContext.length > 0}
														<div class="mt-2 small text-muted">
															Retrieved sources: {aiDraftRetrievedContext.map(item => item.source).join(' | ')}
														</div>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

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
											<label for="total-marks-input" class="form-label text-white mb-0 fw-bold">Total Marks:</label>
											<input
												type="number"
													class="form-control form-control-sm"
													id="total-marks-input"
													style="width: 110px;"
													placeholder="0"
													value={manualTotalMarks ?? ''}
													oninput={(e) => updateTotalMarks(e.currentTarget.value)}
													min="0"
													step="0.5"
												>
											{#if currentAssessment}
												<div class="text-white-50 small ms-1">
													({currentAssessment.totalMarks ?? 0} allocated)
												</div>
											{/if}
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
														<div class="d-flex align-items-center w-100 mb-2">
															<div class="flex-grow-1">
																<h6 class="mb-0 fw-bold">
																	{#if group.category && group.category !== 'No Knowledge Area'}
																		{group.category}
																	{/if}
																</h6>
															</div>
															{#if group.category}
																<div class="d-flex align-items-center gap-2">
									<div class="d-flex align-items-center gap-2">
										<input 
											type="number" 
											class="form-control form-control-sm w-auto" 
											id="marks-{group.category}"
											style="width: 70px;"
											placeholder="0"
											value={categoryMarks[group.category] || ''}
											oninput={(e) => updateCategoryMarks(group.category, e.currentTarget.value)}
											min="0"
											step="0.5"
										>
										{#if currentAssessment.categories.find(cat => cat.name === group.category)?.allocatedMarks}
											<span class="text-white-50 small fw-bold">
												/ {currentAssessment.categories.find(cat => cat.name === group.category).allocatedMarks}
											</span>
										{/if}
									</div>
																	<!-- Category reordering buttons (only in assignment mode) -->
											{#if !currentStudentId}
												{@const sortedCategories = normalizeCategoryOrder(currentAssessment.categories)}
												{@const categoryIndex = sortedCategories.findIndex(cat => normalizeCategoryName(cat.name) === normalizeCategoryName(group.category))}
												<div class="d-flex flex-column">
													<button 
														class="btn btn-sm btn-outline-light" 
														style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
														onclick={() => moveCategoryUp(group.category)}
														title="Move category up"
														aria-label="Move category up"
														disabled={categoryIndex <= 0}
													>
														<i class="bi bi-chevron-up"></i>
													</button>
													<button 
														class="btn btn-sm btn-outline-light" 
														style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
														onclick={() => moveCategoryDown(group.category)}
														title="Move category down"
														aria-label="Move category down"
														disabled={categoryIndex === -1 || categoryIndex >= sortedCategories.length - 1}
													>
																				<i class="bi bi-chevron-down"></i>
																			</button>
																		</div>
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
																	{#if categoryWarnings[group.category]?.type === 'missingMarks'}
																		Warning: Paragraphs selected for this category but no marks entered. Please enter marks to include them in the final report.
																	{:else if categoryWarnings[group.category]?.type === 'markMismatch'}
																		Warning: Entered marks ({categoryMarks[group.category] || 0}) do not match the selected paragraph's mark range ({categoryWarnings[group.category].expected}). Adjust marks or paragraph selection.
																	{:else}
																		Warning: No paragraphs selected for this category. Marks entered will not be included in the final report.
																	{/if}
																</small>
															</div>
														</div>
													{/if}
													<div class="card-body p-0">
														{#if Object.keys(group.knowledgeAreas).length === 0}
															<div class="text-center py-4 px-3">
																<i class="bi bi-journal-text text-muted mb-2" style="font-size: 2rem;"></i>
																<p class="text-muted mb-0">No paragraphs in this category yet</p>
																<small class="text-muted">Add paragraphs using the form above</small>
															</div>
														{:else}
											{#each Object.entries(group.knowledgeAreas) as [knowledgeArea, paragraphs]}
												{@const categoryParagraphSequence = getCategoryParagraphSequence(group)}
												{#if knowledgeArea !== 'No Knowledge Area'}
																	<div class="bg-light border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
																		<small class="text-muted fw-bold mb-0">
																			<i class="bi bi-bookmark me-1"></i>{knowledgeArea}
																		</small>
																		{#if !currentStudentId}
																			<button
																				type="button"
																				class="btn btn-link btn-sm text-decoration-none"
																				onclick={() => startNewParagraphFor(group.category, knowledgeArea)}
																				title="Add a paragraph to this knowledge area"
																			>
																				<i class="bi bi-plus-circle me-1"></i>Add paragraph here
																			</button>
																		{/if}
																	</div>
											{/if}
											{#each paragraphs as {text, color, id, originalIndex, fullText, source, markInfo}, displayIndex}
												{@const categorySequenceIndex = findParagraphSequenceIndex(categoryParagraphSequence, id, originalIndex)}
										<div 
											class="paragraph-item border-bottom p-3 {originalIndex === paragraphs[paragraphs.length - 1].originalIndex ? '' : 'border-bottom'}"
											class:selected-paragraph={selectedParagraphs.has(id)}
										>
																	<div class="d-flex align-items-start">
																		{#if currentStudentId}
																			<div class="form-check me-3 d-flex align-items-center">
																				<input 
																					class="form-check-input" 
																					type="checkbox" 
																					id="paragraph-{id}"
																					aria-label="Select paragraph"
																					checked={selectedParagraphs.has(id)}
																					onchange={() => {
																						addCheckboxDebug(`🖱️ Checkbox clicked: ${id}`)
																						addCheckboxDebug(`🔍 Is selected? ${selectedParagraphs.has(id)}`)
																						
																						// Check for duplicate IDs in current paragraphs
																						const duplicateIds = paragraphs.map(p => p.id).filter((pid, index, arr) => arr.indexOf(pid) !== index)
																						if (duplicateIds.length > 0) {
																							addCheckboxDebug(`⚠️ DUPLICATE IDs found: ${duplicateIds.join(', ')}`)
																						}
																						
																						// Check DOM elements
																						const domElements = document.querySelectorAll(`#paragraph-${id}`)
																						if (domElements.length > 1) {
																							addCheckboxDebug(`⚠️ Multiple DOM elements with ID: ${id} (${domElements.length} found)`)
																						}
																						
																						toggleParagraph(id)
																					}}
																					style="width: 1.2rem; height: 1.2rem; margin-top: 0;"
																				>
																			</div>
																		{/if}
																		<!-- Color indicator between checkbox and text -->
																		{#if color}
																			<div class="me-3 d-flex align-items-center">
																				<div class="rounded border" style="width: 16px; height: 16px; background-color: {getColorHex(color)};" title="Color: {color} ({getColorHex(color)})"></div>
																			</div>
																		{:else}
																			<div class="me-3 d-flex align-items-center">
																				<div class="rounded border bg-light" style="width: 16px; height: 16px;" title="No Color"></div>
																			</div>
																		{/if}
																		<!-- Marks display (percentage range or fixed mark) -->
																		{#if color && markInfo}
																			{#if markInfo.type === 'fixed'}
																				<!-- Fixed mark mode - show specific mark -->
																				<div class="me-3 d-flex align-items-center">
																					<span class="badge bg-primary text-white small" title="Fixed mark for {color} color">
																						{Number.isFinite(Number(markInfo.value)) ? `${markInfo.value} marks` : markInfo.value}
																					</span>
																				</div>
																			{:else if markInfo.type === 'percentage'}
																				<!-- Percentage mode - show marks range -->
																				<div class="me-3 d-flex align-items-center">
																					<span class="badge bg-info text-white small" title="Marks range for {color} color (percentage mode)">
																						{markInfo.value}
																					</span>
																				</div>
																			{/if}
																		{/if}
																		<div class="flex-grow-1 me-3">
																			{#if editingParagraphIndex === originalIndex}
																				<RichTextEditor 
																					value={editingParagraphText}
																					onChange={(newText) => editingParagraphText = newText}
																					readonly={false}
																					rows={3}
																					placeholder="Edit paragraph text..."
																				/>
																			{:else}
																				<div class="d-flex align-items-start">
																					<div class="flex-grow-1">
																						<div class="mb-0 fs-6 lh-base" style="white-space: pre-wrap;">{@html text}</div>
																					</div>
																					{#if source && source !== undefined && source !== 'merged'}
																						<div class="ms-2">
																							{#if source === 'assignment'}
																								<span class="badge bg-primary" title="Assignment paragraph">
																									<i class="bi bi-file-text me-1"></i>Assignment
																								</span>
																							{:else if source === 'student'}
																								<span class="badge bg-success" title="Student paragraph">
																									<i class="bi bi-person me-1"></i>{(studentName || 'Student').split(' ')[0]}
																								</span>
																							{/if}
																						</div>
																					{/if}
																				</div>
																			{/if}
																		</div>
																		<div class="d-flex gap-1">
																			{#if editingParagraphIndex === originalIndex}
																				<button 
																					class="btn btn-success btn-sm" 
																					onclick={saveEditParagraph}
																					title="Save changes"
																					aria-label="Save changes"
																				>
																					<i class="bi bi-check"></i>
																				</button>
																				<button 
																					class="btn btn-outline-secondary btn-sm" 
																					onclick={cancelEditParagraph}
																					title="Cancel editing"
																					aria-label="Cancel editing"
																				>
																					<i class="bi bi-x"></i>
																				</button>
																			{:else}
																				<!-- Copy to Quick Add button (only in student mode) -->
																				{#if currentStudentId}
																					<button
																						class="btn btn-outline-info btn-sm"
																						onclick={() => copyToQuickAdd(text, group.category)}
																						title="Copy to quick add box for customization"
																						aria-label="Copy to quick add"
																					>
																						<i class="bi bi-files"></i>
																					</button>
																				{/if}
																				<!-- Paragraph reordering buttons (only in assignment mode) -->
													{#if !currentStudentId}
														<button
															class="btn btn-outline-secondary btn-sm"
															onclick={() => moveParagraphUp(id, categorySequenceIndex, categoryParagraphSequence)}
															title="Move paragraph up"
															aria-label="Move paragraph up"
															disabled={categorySequenceIndex <= 0}
														>
																<i class="bi bi-chevron-up"></i>
															</button>
														<button
															class="btn btn-outline-secondary btn-sm"
															onclick={() => moveParagraphDown(id, categorySequenceIndex, categoryParagraphSequence)}
															title="Move paragraph down"
															aria-label="Move paragraph down"
															disabled={categorySequenceIndex === -1 || categorySequenceIndex >= categoryParagraphSequence.length - 1}
														>
																<i class="bi bi-chevron-down"></i>
															</button>
													{/if}
															<button
																class="btn btn-outline-primary btn-sm"
																onclick={() => sendParagraphToAiInput(text, group.category, knowledgeArea)}
																title="Edit paragraph"
																aria-label="Edit paragraph"
															>
																					<i class="bi bi-pencil"></i>
																				</button>
																				<button
																					class="btn btn-outline-danger btn-sm"
																					onclick={() => deleteParagraph(originalIndex)}
																					title="Delete paragraph"
																					aria-label="Delete paragraph"
																				>
																					<i class="bi bi-trash"></i>
																				</button>
																			{/if}
																		</div>
																	</div>
																</div>
															{/each}
														{/each}
														{/if}
													</div>
													<div class="card-footer bg-light border-top">
														<div class="d-flex flex-wrap align-items-center gap-2 mb-2">
															{#if (currentAssessment?.knowledgeAreas || []).length > 0}
															<select
																class="form-select form-select-sm"
																	style="min-width: 180px;"
																	value={quickAddKnowledgeArea[group.category] || ''}
																	onchange={(e) => {
																		quickAddKnowledgeArea = {
																			...quickAddKnowledgeArea,
																			[group.category]: e.currentTarget.value
																		}
																	}}
																>
																	<option value="">No knowledge area</option>
																	{#each (currentAssessment?.knowledgeAreas || []) as area}
																		<option value={area}>{area}</option>
																	{/each}
																</select>
															{/if}
														</div>
													<div class="d-flex flex-column gap-2 w-100">
													<div class="d-flex flex-wrap gap-2 align-items-start">
														<button
															class="btn btn-outline-secondary btn-sm"
															type="button"
															onclick={() => applyBoldToQuickAdd(group.category)}
															title="Apply bold to selected text"
														>
															<i class="bi bi-type-bold me-1"></i>Bold
														</button>
														<div class="d-flex align-items-center gap-1">
															<input
																type="color"
																class="form-control form-control-color form-control-sm"
																value={quickAddColorPicker[group.category] || '#0d6efd'}
																onchange={(e) => {
																	quickAddColorPicker = {
																		...quickAddColorPicker,
																		[group.category]: e.currentTarget.value
																	}
																}}
																title="Pick text colour"
																style="width: 2.6rem; height: 2rem; padding: 0.15rem;"
															>
															<button
																class="btn btn-outline-secondary btn-sm"
																type="button"
																onclick={() => applyColorToQuickAdd(group.category, quickAddColorPicker[group.category])}
																title="Apply selected colour to selected text"
															>
																<i class="bi bi-palette me-1"></i>Colour
															</button>
														</div>
															<button
																class="btn btn-outline-primary btn-sm"
																type="button"
																onclick={() => improveTextWithAI(group.category)}
																disabled={improvingText[group.category] || improvingTextWithRag[group.category] || evidenceCheckingText[group.category] || !quickAddText[group.category]?.trim()}
																title="Improve English with AI"
															>
																{#if improvingText[group.category]}
																	<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
																	Improving...
																{:else}
																	<i class="bi bi-stars me-1"></i>Improve with AI
																{/if}
															</button>
															<button
																class="btn btn-outline-info btn-sm"
																type="button"
																onclick={() => improveTextWithRag(group.category)}
																disabled={improvingText[group.category] || improvingTextWithRag[group.category] || evidenceCheckingText[group.category] || !quickAddText[group.category]?.trim()}
																title="Expand draft using rubric and RAG context"
															>
																{#if improvingTextWithRag[group.category]}
																	<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
																	Improving with RAG...
																{:else}
																	<i class="bi bi-diagram-3 me-1"></i>Improve with RAG
																{/if}
															</button>
															<button
																class="btn btn-outline-warning btn-sm"
																type="button"
																onclick={() => runEvidenceCheck(group.category)}
																disabled={improvingText[group.category] || improvingTextWithRag[group.category] || evidenceCheckingText[group.category] || !currentStudentId}
																title="Generate evidence-based report from student notes and uploads"
															>
																{#if evidenceCheckingText[group.category]}
																	<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
																	Checking evidence...
																{:else}
																	<i class="bi bi-clipboard2-check me-1"></i>Evidence Check
																{/if}
															</button>
													<button
														class={`btn btn-sm ${isDarkMode ? 'btn-outline-light' : 'btn-outline-dark'}`}
										type="button"
										onclick={() => viewFinalPrompt(group.category, 'ai')}
										disabled={!quickAddText[group.category]?.trim()}
										title="View final prompt for Improve with AI"
									>
										<i class="bi bi-eye me-1"></i>View Improve Prompt
									</button>
															<button
																class={`btn btn-sm ${isDarkMode ? 'btn-outline-light' : 'btn-outline-dark'}`}
																type="button"
																onclick={() => viewFinalPrompt(group.category, 'rag')}
																disabled={!quickAddText[group.category]?.trim()}
																title="View final prompt for Improve with RAG"
															>
																<i class="bi bi-eye-fill me-1"></i>View RAG Prompt
															</button>
															<button
																class="btn btn-outline-secondary btn-sm"
																type="button"
																onclick={() => quickAddParagraph(group.category)}
																title="Add a paragraph to this category"
															>
																<i class="bi bi-plus-circle me-1"></i>Add paragraph
															</button>
															<button
																class="btn btn-link btn-sm text-decoration-none p-0 align-self-center"
																type="button"
																onclick={() => startNewParagraphFor(group.category, quickAddKnowledgeArea[group.category])}
															>
																Use main editor
															</button>
															{#if currentStudentId}
																<label class="form-check small mb-0 align-self-center">
																	<input
																		type="checkbox"
																		class="form-check-input me-1"
																		bind:checked={quickAddToAssessmentWhenStudentSelected}
																	/>
																<span class="form-check-label text-body-secondary">
																	Save to assessment
																</span>
																</label>
															{/if}
														</div>
														<textarea
														id={quickAddInputId(group.category)}
														class="form-control form-control-sm {aiImprovedText[group.category] ? 'ai-improved-text' : ''}"
														rows="2"
																placeholder={`Add paragraph to ${group.category}...`}
																value={quickAddText[group.category] || ''}
																oninput={(e) => {
																	quickAddText = {
																		...quickAddText,
																		[group.category]: e.currentTarget.value
																	}
																	// Clear AI-improved flag when user manually edits
															if (aiImprovedText[group.category]) {
																aiImprovedText = { ...aiImprovedText, [group.category]: false }
															}
														}}
													></textarea>
														<div class="border rounded p-2">
															<div class="d-flex align-items-center justify-content-between gap-2">
																<label for={quickAddInstructionInputId(group.category)} class="form-label small fw-semibold d-flex align-items-center gap-2 mb-0">
																	<span>Instructions for this answer</span>
																	<span class="badge text-bg-info">Per-answer</span>
																</label>
																<button
																	type="button"
																	class="btn btn-outline-secondary btn-sm"
																	onclick={() => toggleQuickAddInstructionPanel(group.category)}
																	aria-expanded={isQuickAddInstructionExpanded(group.category)}
																	aria-controls={quickAddInstructionSectionId(group.category)}
																	title={isQuickAddInstructionExpanded(group.category) ? 'Collapse instructions' : 'Expand instructions'}
																>
																	<i class={`bi ${isQuickAddInstructionExpanded(group.category) ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
																	{isQuickAddInstructionExpanded(group.category) ? 'Collapse' : 'Expand'}
																</button>
															</div>
															{#if isQuickAddInstructionExpanded(group.category)}
																<div id={quickAddInstructionSectionId(group.category)} class="mt-2">
																	<textarea
																		id={quickAddInstructionInputId(group.category)}
																		class="form-control form-control-sm"
																		rows="2"
																placeholder="e.g. be concise and direct, focus on missing evidence"
																value={quickAddAiInstructions[group.category] || ''}
																oninput={(e) => {
																	setCategoryAiInstruction(group.category, e.currentTarget.value)
																	schedulePersistCategoryAiInstruction(group.category)
																}}
																onblur={() => persistCategoryAiInstruction(group.category)}
															></textarea>
																	<div class="form-text">Only for this answer. Not global system behaviour.</div>
																</div>
															{/if}
														</div>
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

											<!-- Total Marks Display -->
											{#if getTotalMarks() > 0}
												<div class="total-marks-display mt-3 pt-3 border-top">
													<div class="d-flex justify-content-between align-items-center">
														<span class="fw-bold">Total Marks:</span>
														<span class="fw-bold text-danger fs-5">{getTotalMarks()}</span>
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
					</div>

				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Visual Debug Panel for Checkbox Issue -->
{#if showCheckboxDebug}
	<div class="container-fluid mt-4 mb-4">
		<div class="row">
			<div class="col-12">
				<div class="card border-warning">
					<div class="card-header bg-warning text-dark">
						<h5 class="mb-0">
							<i class="bi bi-check-square me-2"></i>Checkbox Debug Panel
							<button 
								class="btn btn-sm btn-outline-dark float-end" 
								onclick={() => showCheckboxDebug = false}
								aria-label="Close checkbox debug panel"
							>
								<i class="bi bi-x"></i>
							</button>
						</h5>
					</div>
					<div class="card-body">
						<div class="row mb-3">
							<div class="col-md-6">
								<button 
									class="btn btn-sm btn-outline-secondary me-2" 
									onclick={() => checkboxDebugInfo = []}
								>
									<i class="bi bi-trash me-1"></i>Clear Debug Log
								</button>
								<button 
									class="btn btn-sm btn-warning" 
									onclick={regenerateParagraphIds}
								>
									<i class="bi bi-arrow-clockwise me-1"></i>Fix Duplicate IDs
								</button>
								<button 
									class="btn btn-sm btn-info ms-2" 
									onclick={debugSelectionState}
								>
									<i class="bi bi-bug me-1"></i>Debug Selection State
								</button>
								<button 
									class="btn btn-sm btn-warning ms-2" 
									onclick={checkForDuplicateIds}
								>
									<i class="bi bi-exclamation-triangle me-1"></i>Check Duplicate IDs
								</button>
							</div>
							<div class="col-md-6 text-end">
								<small class="text-muted">
									Selected: {selectedParagraphs.size} | 
									Total Paragraphs: {paragraphs.length}
								</small>
							</div>
						</div>
						<div style="max-height: 300px; overflow-y: auto; background-color: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 0.9em;">
							{#if checkboxDebugInfo.length === 0}
								<p class="text-muted mb-0">No debug messages yet. Try clicking a checkbox.</p>
							{:else}
								{#each checkboxDebugInfo as message}
									<div class="mb-1">{message}</div>
								{/each}
							{/if}
						</div>
						<div class="mt-3">
							<h6>Current Paragraph IDs:</h6>
							<div style="max-height: 100px; overflow-y: auto; background-color: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.8em;">
								{#each paragraphs as para, index}
									<div class="mb-1">
										<span class="badge {selectedParagraphs.has(para.id) ? 'bg-success' : 'bg-secondary'} me-2">
											{selectedParagraphs.has(para.id) ? '✓' : '○'}
										</span>
										{index}: {para.id}
									</div>
								{/each}
							</div>
						</div>
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
	
	:global(.app-sidebar-column),
	:global(.app-main-column) {
		display: flex;
		flex-direction: column;
		min-height: calc(100vh - 200px);
	}
	
	:global(.app-main-column > .row) {
		display: flex;
		flex-direction: column;
	}
	
	/* Autosave animation */
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* AI-improved text styling - works in both light and dark themes */
	:global(.ai-improved-text) {
		background-color: #e8f5e9 !important; /* Light green background for light theme */
		border-color: #4caf50 !important; /* Green border */
		color: #1b5e20 !important; /* Dark green text */
	}

	/* Dark theme support */
	:global([data-bs-theme="dark"] .ai-improved-text) {
		background-color: #1b3a1f !important; /* Dark green background for dark theme */
		border-color: #66bb6a !important; /* Lighter green border */
		color: #a5d6a7 !important; /* Light green text */
	}
	
	:global(.app-main-column > .row > .col-12) {
		display: flex;
		flex-direction: column;
	}
	
	:global(.col-xl-3, .col-lg-4, .col-md-6, .col-sm-12) {
		display: flex;
		align-items: flex-start;
		margin-bottom: 1rem;
	}
	
	/* Content area adjustments */
	:global(.app-sidebar-column .p-3.border.bg-light) {
		min-height: calc(100vh - 160px);
		flex: 1;
		display: flex;
		flex-direction: column;
		margin-top: 1rem;
		margin-bottom: 1rem;
	}
	
	/* Ensure full width for content areas */
	:global(.app-main-column .content-area) {
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

	:global(.ai-marking-context-grid) {
		flex-direction: row !important;
		align-items: flex-start;
	}

	:global(.ai-marking-context-grid > .col-md-4),
	:global(.ai-marking-context-grid > .col-md-8),
	:global(.ai-marking-context-grid > .col-12) {
		display: block;
		min-height: auto;
		height: auto;
	}

	.student-photo-paste-box {
		width: 92px;
		height: 92px;
		border: 2px dashed #86b7fe;
		border-radius: 0.65rem;
		background: #f8fbff;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem;
		cursor: pointer;
		overflow: hidden;
	}

	.student-photo-paste-box:focus {
		outline: none;
		border-color: #0d6efd;
		box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
	}

	.student-photo-paste-box.has-photo {
		background: #ffffff;
		border-style: solid;
	}

	.student-photo-paste-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		color: #0d6efd;
	}

	.student-photo-paste-hint {
		font-size: 0.72rem;
		font-weight: 600;
		line-height: 1.1;
	}

	.student-photo-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 0.5rem;
	}

	.student-picker {
		position: relative;
	}

	.student-picker-toggle {
		width: 100%;
		min-height: 38px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--bs-border-color, #ced4da);
		border-radius: 0.375rem;
		background: var(--bs-body-bg, #fff);
		color: inherit;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		text-align: left;
	}

	.student-picker-trigger {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
		flex: 1;
	}

	.student-picker-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.student-picker-menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		z-index: 30;
		background: var(--bs-body-bg, #fff);
		border: 1px solid var(--bs-border-color, #ced4da);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.student-picker-options {
		max-height: 320px;
		overflow-y: auto;
		padding: 0.35rem;
	}

	.student-picker-option {
		width: 100%;
		border: 0;
		background: transparent;
		border-radius: 0.45rem;
		padding: 0.5rem 0.625rem;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		text-align: left;
	}

	.student-picker-option:hover,
	.student-picker-option.is-active {
		background: rgba(13, 110, 253, 0.1);
	}

	.student-picker-option-label {
		flex: 1;
		min-width: 0;
	}

	.student-picker-check {
		color: #0d6efd;
		font-size: 1rem;
	}

	.student-picker-empty {
		padding: 0.75rem;
		text-align: center;
		color: #6c757d;
		font-size: 0.9rem;
	}

	.student-picker-avatar-image,
	.student-picker-avatar-placeholder {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	.student-picker-avatar-image {
		object-fit: cover;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.student-picker-avatar-placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #e9f2ff;
		color: #0d6efd;
		font-size: 0.72rem;
		font-weight: 700;
	}

	.disabled-tab-content {
		display: none;
	}

	.prompt-preview-pre {
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.85rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
	}

	.student-submission-input {
		resize: none;
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
	
	/* Loading spinner animation */
	.spin {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
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

<!-- Category Edit Modal -->
{#if showCategoryEditModal && editingCategory}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-primary text-white">
					<h5 class="modal-title">
						<i class="bi bi-pencil me-2"></i>Edit Category: {editingCategory.name}
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => { showCategoryEditModal = false; editingCategory = null; }} aria-label="Close category edit modal"></button>
				</div>
					<div class="modal-body">
						<div class="mb-3">
							<div class="form-label fw-bold">Category Marking Mode:</div>
							<select class="form-select" bind:value={editingCategory.markingMode}>
								<option value="none">None - No color marking</option>
								<option value="percentage">Percentage - Use percentage ranges</option>
								<option value="fixed">Fixed - Set specific marks per color</option>
							</select>
							{#if editingCategory.markingMode === 'percentage'}
								<div class="mt-2">
									<label class="form-label small mb-1" for="editAllocatedMarks">Category Marks</label>
									<input
										id="editAllocatedMarks"
										type="number"
										class="form-control"
										min="0"
										step="0.5"
										placeholder="Enter total marks for this category"
										bind:value={editingCategory.allocatedMarks}
									>
								</div>
							{/if}
							<small class="text-muted d-block mt-2">
								<i class="bi bi-info-circle me-1"></i>This setting applies only to <strong>{editingCategory.name}</strong>.
							</small>
						</div>
					</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => { showCategoryEditModal = false; editingCategory = null; }}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-primary" onclick={saveCategoryEdit}>
						<i class="bi bi-check-circle me-2"></i>Save Changes
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- AI Draft Review Modal -->
{#if showAiDraftReviewModal}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-xl modal-dialog-scrollable">
			<div class="modal-content">
				<div class="modal-header bg-dark text-white">
					<h5 class="modal-title">
						<i class="bi bi-stars me-2"></i>Review AI Draft
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={closeAiDraftReviewModal} aria-label="Close AI draft review"></button>
				</div>
				<div class="modal-body">
					<div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-3">
						<div>
							<div class="fw-bold">Overall Feedback</div>
							<div class="text-muted small">Retrieval mode: {aiRetrievalMode || 'unknown'}</div>
						</div>
						{#if aiDraftRetrievedContext.length > 0}
							<div class="small text-muted">Sources: {aiDraftRetrievedContext.map(item => item.source).join(' | ')}</div>
						{/if}
					</div>
					{#if aiDraftOverallFeedback}
						<div class="alert alert-secondary py-2">{aiDraftOverallFeedback}</div>
					{/if}
					{#if aiDraftReviewItems.length === 0}
						<div class="alert alert-warning mb-0">No reviewable AI criterion suggestions were produced.</div>
					{:else}
						<div class="d-flex flex-column gap-3">
							{#each aiDraftReviewItems as item, index}
								<div class="card border-0 shadow-sm bg-light">
									<div class="card-body">
										<div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-2">
											<div>
												<h6 class="mb-1">{item.matchedCategoryName}</h6>
												<div class="small text-muted">AI criterion: {item.criterion_name}</div>
											</div>
											<div class="text-lg-end">
												<div class="fw-bold">Suggested Mark: {item.awarded_mark ?? 'None'}</div>
											</div>
										</div>
										{#if item.judgement}
											<p class="mb-2"><strong>Judgement:</strong> {item.judgement}</p>
										{/if}
										{#if item.evidence.length > 0}
											<p class="mb-2"><strong>Evidence:</strong> {item.evidence.join(' | ')}</p>
										{/if}
										{#if item.improvement_advice}
											<p class="mb-2"><strong>Improvement advice:</strong> {item.improvement_advice}</p>
										{/if}
										{#if item.suggested_feedback}
											<div class="mb-3">
												<div class="fw-bold mb-1">Suggested Feedback</div>
																<div class="border rounded bg-body-tertiary p-2" style="white-space: pre-wrap;">{item.suggested_feedback}</div>
											</div>
										{/if}
										<div class="d-flex flex-wrap gap-3">
											<label class="form-check mb-0">
												<input type="checkbox" class="form-check-input" checked={item.applyMark} onchange={() => toggleAiDraftReviewItem(index, 'applyMark')}>
												<span class="form-check-label">Apply mark</span>
											</label>
											<label class="form-check mb-0">
												<input type="checkbox" class="form-check-input" checked={item.applyFeedback} onchange={() => toggleAiDraftReviewItem(index, 'applyFeedback')}>
												<span class="form-check-label">Apply feedback text</span>
											</label>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={closeAiDraftReviewModal}>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button type="button" class="btn btn-primary" onclick={applyAiDraftReviewSelections} disabled={aiDraftReviewItems.length === 0}>
						<i class="bi bi-check-circle me-2"></i>Apply Selected Suggestions
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Prompt Preview Modal -->
{#if showPromptPreviewModal}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-xl modal-dialog-scrollable">
			<div class="modal-content">
				<div class="modal-header bg-dark text-white">
					<h5 class="modal-title">
						<i class="bi bi-eye me-2"></i>{promptPreviewTitle || 'Final Prompt Preview'}
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={closePromptPreviewModal} aria-label="Close prompt preview"></button>
				</div>
				<div class="modal-body">
					<div class="small text-muted mb-3">This is the final prompt payload prepared to send to the OpenAI API.</div>
					<div class="d-flex flex-column gap-3">
						{#each promptPreviewMessages as message, index}
							<div class="border rounded p-3 bg-light">
								<div class="fw-bold text-uppercase small mb-2">Message {index + 1} - {message.role}</div>
								<pre class="mb-0 prompt-preview-pre">{message.content}</pre>
							</div>
						{/each}
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={closePromptPreviewModal}>Close</button>
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
					<button type="button" class="btn-close btn-close-white" onclick={() => showAddStudent = false} aria-label="Close add student modal"></button>
				</div>
				<div class="modal-body">
					<div class="mb-3">
						<label for="newStudentName" class="form-label fw-bold">Student Name:</label>
						<input 
							id="newStudentName"
							type="text" 
							class="form-control form-control-sm" 
							bind:value={newStudentName}
							placeholder="Enter student name"
						>
					</div>
					<div class="mb-3">
						<label for="newStudentId" class="form-label fw-bold">Student ID:</label>
						<input 
							id="newStudentId"
							type="text" 
							class="form-control form-control-sm" 
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
					<button type="button" class="btn-close btn-close-white" onclick={() => showStudentManager = false} aria-label="Close student manager"></button>
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
											aria-label="Select this student"
										>
											<i class="bi bi-check-circle"></i>
										</button>
										<button 
											class="btn btn-outline-danger btn-sm"
											onclick={() => { studentToDelete = student; showDeleteConfirmation = true; }}
											title="Delete this student"
											disabled={deletingStudentId === student.id}
										>
											{#if deletingStudentId === student.id}
												<i class="bi bi-arrow-clockwise spin"></i>
											{:else}
												<i class="bi bi-trash"></i>
											{/if}
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

<!-- Student Transfer Modal -->
<StudentTransferModal 
	show={showStudentTransferModal}
	students={students}
	currentStudentId={currentStudentId}
	currentStudentName={studentName}
	onClose={() => showStudentTransferModal = false}
	onTransfer={transferStudentData}
/>

<!-- Import Paragraphs Modal -->
<ImportParagraphsModal 
	show={showImportModal}
	subjects={subjects}
	currentSubjectId={currentSubjectId}
	currentAssessmentId={currentAssessmentId}
	on:close={() => showImportModal = false}
	on:import={importParagraphs}
/>

<!-- Assignment Export Modal -->
<AssignmentExportModal
	showModal={showExportModal}
	{currentSubject}
	{currentAssessment}
	{subjects}
	onClose={() => showExportModal = false}
	onExportComplete={exportAssignmentSettings}
/>

<!-- About Modal -->
<AboutModal
	bind:show={showAboutModal}
	onClose={() => showAboutModal = false}
/>

<!-- Success Notification Toast -->
{#if showNotification}
	<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;">
		<div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
			<div class={`toast-header ${notificationVariant === 'danger' ? 'bg-danger' : 'bg-success'} text-white`}>
				<i class={`bi ${notificationVariant === 'danger' ? 'bi-exclamation-circle' : 'bi-check-circle'} me-2`}></i>
				<strong class="me-auto">{notificationVariant === 'danger' ? 'Error' : 'Success'}</strong>
				<button type="button" class="btn-close btn-close-white" onclick={() => showNotification = false} aria-label="Close notification"></button>
			</div>
			<div class="toast-body">
				{notificationMessage}
			</div>
		</div>
	</div>
{/if}


<!-- Delete Student Confirmation Modal -->
{#if showDeleteConfirmation && studentToDelete}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Confirm Student Deletion
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => { showDeleteConfirmation = false; studentToDelete = null; }} aria-label="Close delete confirmation"></button>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger d-flex align-items-center mb-3" role="alert">
						<i class="bi bi-exclamation-triangle-fill me-2" style="font-size: 1.2rem;"></i>
						<div>
							<strong>Warning!</strong> This action cannot be undone.
						</div>
					</div>
					
					<p class="mb-3">
						Are you sure you want to delete <strong>{studentToDelete.displayName}</strong>?
					</p>
					
					<p class="mb-3 text-muted">
						This will permanently delete:
					</p>
					
					<ul class="list-unstyled mb-4">
						<li class="mb-2">
							<i class="bi bi-person-x text-danger me-2"></i>
							Student information and profile
						</li>
						<li class="mb-2">
							<i class="bi bi-file-text-x text-danger me-2"></i>
							All evaluation data and feedback
						</li>
						<li class="mb-2">
							<i class="bi bi-journal-x text-danger me-2"></i>
							All feedback paragraphs and comments
						</li>
						<li class="mb-2">
							<i class="bi bi-clipboard-x text-danger me-2"></i>
							All assessment marks and grades
						</li>
					</ul>
					
					<div class="alert alert-info d-flex align-items-center" role="alert">
						<i class="bi bi-info-circle me-2"></i>
						<div>
							If this student is currently selected, the selection will be cleared.
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button 
						type="button" 
						class="btn btn-secondary" 
						onclick={() => { showDeleteConfirmation = false; studentToDelete = null; }}
						disabled={deletingStudentId === studentToDelete?.id}
					>
						<i class="bi bi-x-circle me-2"></i>Cancel
					</button>
					<button 
						type="button" 
						class="btn btn-danger"
						onclick={() => deleteStudent(studentToDelete.id)}
						disabled={deletingStudentId === studentToDelete?.id}
					>
						{#if deletingStudentId === studentToDelete?.id}
							<i class="bi bi-arrow-clockwise spin me-2"></i>Deleting...
						{:else}
							<i class="bi bi-trash me-2"></i>Delete Student
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
