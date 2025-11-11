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
	import RichTextEditor from './lib/RichTextEditor.svelte'
	import StudentTransferModal from './lib/StudentTransferModal.svelte'
	import ImportParagraphsModal from './lib/ImportParagraphsModal.svelte'
	import AssignmentExportModal from './lib/AssignmentExportModal.svelte'
	import AboutModal from './lib/AboutModal.svelte'
	
	// Import utility functions
	import { getColorBadgeClass, getColorHex, cleanParagraphTextForDisplay, extractKnowledgeArea, getSectionOrder, generateId, ensureParagraphsHaveIds, ensureCategoriesHaveOrder, extractMainTextFromParagraph, reconstructParagraphText } from './utils/helpers.js'
	import { getMotivationalMessage } from './utils/motivationalMessages.js'
	
	// Import data services
	import { studentsService } from './services/dataService.js'
	
	// Import constants
	import { PDR_CATEGORIES, STUDIO4_CATEGORIES, STUDIO5_CATEGORIES } from './utils/constants.js'
	
	// Import CSS
	import './styles/reset.css'
	import './styles/design-system.css'
	import './styles/fixed-components.css'
	import './styles/subject-manager.css'
	import './styles/assessment-manager.css'
	import './styles/dark-mode.css'

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
	// No studentImage - only header photo for assessment
	let selectedColor = $state('red')
	let selectedColorMark = $state('') // Mark for the selected color (fixed mode)
	let newCategoryName = $state('')
	let newCategoryKnowledgeArea = $state('')
	let newCategoryAllocatedMarks = $state('')
	let newKnowledgeAreaName = $state('')
	// Note: knowledgeAreas are now stored as assignment properties (currentAssessment.knowledgeAreas)
	let categoryMarks = $state({}) // Store marks for each category
	let manualTotalMarks = $state('') // Store manually entered total marks
	let showTotalMarksWarning = $state(false) // Show warning modal
	let categoryWarnings = $state({}) // Store warnings for each category
	let showNotification = $state(false) // Show success notification
	let notificationMessage = $state('') // Notification message
	let deletingStudentId = $state(null) // Track which student is being deleted
	let showStudentTransferModal = $state(false) // Show student transfer modal
	let showImportModal = $state(false) // Show import paragraphs modal
	let showExportModal = $state(false) // Show export assignment settings modal
	let showAboutModal = $state(false) // Show about modal
	
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
	let newSubjectName = $state('')
	let newAssessmentName = $state('')
	let newStudentName = $state('')
	let newStudentId = $state('')
	let showMobileSidebar = $state(false)
	let showCalculator = $state(false) // Calculator toggle state
	let currentView = $state('subjects') // 'subjects', 'assessments', 'feedback'
	let isDarkMode = $state(false) // Dark mode toggle state
	
	// Force reactivity for debugging
	$effect(() => {
		console.log('Current view changed to:', currentView)
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

	// Removed debouncedAutosave function to prevent data contamination

	// Removed autosave effect to prevent data contamination

	// Removed autosave effect for subject/student data to prevent data contamination

	// Handle student selection changes
	$effect(() => {
		if (currentStudentId && currentView === 'feedback' && currentAssessmentId) {
			const student = students.find(s => s.id === currentStudentId)
			if (student) {
				studentName = student.displayName
			}
		} else if (!currentStudentId && currentView === 'feedback' && currentAssessmentId) {
			// STRICT DATA SEPARATION RULE 1: Student deselected - ensure we show assignment-only data
			console.log('STRICT DATA SEPARATION: Student deselected via reactive effect - loading assignment-only data')
			studentName = ''
			// No studentImage - only header photo for assessment
			selectedParagraphs = new Set()
			categoryMarks = {}
			manualTotalMarks = ''
			
			// Reload assignment paragraphs only (no student data)
			loadAssessmentData(currentSubjectId, currentAssessmentId, false)
		}
	})
	
	// Function to update view
	function updateView(newView) {
		currentView = newView
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

	// Category and topic selection
	let selectedCategory = $state('')
	let selectedTopic = $state('')
	let selectedKnowledgeArea = $state('')
	
	// pdrCategories is now imported from utils/constants.js

	// studio4Categories is now imported from utils/constants.js

	// studio5Categories is now imported from utils/constants.js

	// generateId function is now imported from utils/helpers.js

	// Ensure paragraphs have IDs (migration function for existing data)
	// ensureParagraphsHaveIds function is now imported from utils/helpers.js

	// ensureCategoriesHaveOrder function is now imported from utils/helpers.js


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
	}

	async function saveSubjects() {
		const data = { subjects, students, percentageRanges }
		
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
				// Always clear student data when loading assignment data
				studentName = ''
				// No studentImage - only header photo for assessment
				
				// Load assessment header photo if available
				if (currentAssessment && parsed.headerPhoto) {
					currentAssessment.headerPhoto = parsed.headerPhoto
				}
				// Reset all marks to zero
				categoryMarks = {}
				manualTotalMarks = ''
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
					// Always clear student data when loading assignment data
					studentName = ''
					// No studentImage - only header photo for assessment
					
					// Load assessment header photo if available
					if (currentAssessment && parsed.headerPhoto) {
						currentAssessment.headerPhoto = parsed.headerPhoto
					}
					// Reset all marks to zero
					categoryMarks = {}
					manualTotalMarks = ''
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
		// No studentImage - only header photo for assessment
		categoryMarks = {}
		manualTotalMarks = ''
		
		// Clear student selection to prevent cross-contamination
		currentStudentId = null
		
		// Clear any cached data that might be from other assessments
		// This ensures a clean slate when entering any assessment
		console.log('STRICT DATA SEPARATION: All data cleared before entering assessment')
	}

	async function saveAssessmentData() {
		if (!currentSubjectId || !currentAssessmentId) return
		
		// STRICT SAVING CRITERIA 1: Only save to Assessment if student is NOT selected
		if (currentStudentId) {
			console.log('STRICT SAVING CRITERIA: Cannot save assessment data when student is selected - use saveStudentEvaluation instead')
			return
		}
		
		// STRICT VALIDATION: Ensure no student-specific data is being saved to assessment
		console.log('STRICT SAVING CRITERIA: Saving to assessment file - no student selected')

		const data = {
			paragraphs,
			selectedParagraphs: Array.from(selectedParagraphs),
			// Assignment data should never contain student-specific information
			studentName: '',
			// No studentImage - only header photo for assessment
			headerPhoto: currentAssessment?.headerPhoto || '',
			categoryMarks,
			manualTotalMarks
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
			let paragraphText = newParagraph.trim()
			
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

		// For fixed marking mode, store the mark and category
		if (currentAssessment?.markingMode === 'fixed' && selectedColorMark && selectedCategory) {
			newPara.mark = parseFloat(selectedColorMark)
			newPara.category = selectedCategory
		}

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

			const newCategory = {
				id: Date.now().toString(),
				name: newCategoryName.trim(),
				knowledgeLevel: newCategoryKnowledgeArea.trim() || undefined,
				allocatedMarks: newCategoryAllocatedMarks ? parseFloat(newCategoryAllocatedMarks) : undefined,
				order: currentAssessment.categories.length, // Set order as the next index
				colorMarks: {} // For fixed marking mode: { colorName: markValue }
			}

			currentAssessment.categories = [...currentAssessment.categories, newCategory]
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

	// Category reordering functions
	function moveCategoryUp(categoryId) {
		if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
		
		const categories = currentAssessment.categories
		const currentCategory = categories.find(cat => cat.id === categoryId)
		if (!currentCategory) return
		
		const currentOrder = currentCategory.order || 0
		const previousCategory = categories.find(cat => (cat.order || 0) === currentOrder - 1)
		
		if (previousCategory) {
			// Swap order values
			const tempOrder = currentCategory.order
			currentCategory.order = previousCategory.order
			previousCategory.order = tempOrder
			
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

	function moveCategoryDown(categoryId) {
		if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
		
		const categories = currentAssessment.categories
		const currentCategory = categories.find(cat => cat.id === categoryId)
		if (!currentCategory) return
		
		const currentOrder = currentCategory.order || 0
		const nextCategory = categories.find(cat => (cat.order || 0) === currentOrder + 1)
		
		if (nextCategory) {
			// Swap order values
			const tempOrder = currentCategory.order
			currentCategory.order = nextCategory.order
			nextCategory.order = tempOrder
			
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

	// Paragraph reordering functions
	function moveParagraphUp(paragraphIndex) {
		if (currentStudentId) return // Only in assignment mode
		
		if (paragraphIndex > 0) {
			// Swap with previous paragraph
			[paragraphs[paragraphIndex], paragraphs[paragraphIndex - 1]] = [paragraphs[paragraphIndex - 1], paragraphs[paragraphIndex]]
			
			// Update order values
			paragraphs.forEach((para, index) => {
				if (typeof para === 'object' && para.id) {
					para.order = index
				}
			})
			
			saveAssessmentData()
		}
	}

	function moveParagraphDown(paragraphIndex) {
		if (currentStudentId) return // Only in assignment mode
		
		if (paragraphIndex < paragraphs.length - 1) {
			// Swap with next paragraph
			[paragraphs[paragraphIndex], paragraphs[paragraphIndex + 1]] = [paragraphs[paragraphIndex + 1], paragraphs[paragraphIndex]]
			
			// Update order values
			paragraphs.forEach((para, index) => {
				if (typeof para === 'object' && para.id) {
					para.order = index
				}
			})
			
			saveAssessmentData()
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

	function checkCategoryHasSelectedParagraphs(category) {
		// Check if any selected paragraphs belong to this category
		for (const selectedId of selectedParagraphs) {
			const paragraph = paragraphs.find(p => p.id === selectedId)
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

	// Calculate marks range based on color and allocated marks
	function getMarksRange(color, allocatedMarks) {
		if (!allocatedMarks || allocatedMarks <= 0) return null
		
		// Define percentage ranges for each color
		const colorRanges = {
			'green': { min: 0.8, max: 1.0 },      // 80-100%
			'lightgreen': { min: 0.65, max: 0.79 }, // 65-79%
			'yellow': { min: 0.5, max: 0.64 },     // 50-64%
			'orange': { min: 0.4, max: 0.49 },     // 40-49%
			'red': { min: 0.0, max: 0.39 }         // 0-39%
		}
		
		const range = colorRanges[color]
		if (!range) return null
		
		const minMarks = Math.round(allocatedMarks * range.min * 100) / 100
		const maxMarks = Math.round(allocatedMarks * range.max * 100) / 100
		
		return `${minMarks}-${maxMarks}`
	}

	function updateTotalMarks(totalMarks) {
		manualTotalMarks = totalMarks
		// Autosave will handle saving automatically
	}

	// Notification Functions
	function showSuccessNotification(message) {
		console.log('NOTIFICATION DEBUG: Showing notification:', message)
		notificationMessage = message
		showNotification = true
		setTimeout(() => {
			console.log('NOTIFICATION DEBUG: Auto-hiding notification')
			showNotification = false
		}, 3000) // Auto-hide after 3 seconds
	}

	// Student Management Functions

	async function saveStudents() {
		// Save students to main data file
		const mainData = { subjects, students }
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
			// No studentImage - only header photo for assessment
			selectedParagraphs.clear()
			categoryMarks = {}
			manualTotalMarks = ''
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
			// No studentImage - only header photo for assessment
			selectedParagraphs = new Set()
			categoryMarks = {}
			manualTotalMarks = ''
			
			// Reload assignment paragraphs only (no student data)
			await loadAssessmentData(currentSubjectId, currentAssessmentId, false)
			return
		}
		
		const student = students.find(s => s.id === studentId)
		if (student) {
			studentName = student.displayName
			// STRICT FILTER: Only load student evaluation data for the current assessment
			console.log(`STRICT FILTER: Selecting student ${studentId} for assessment ${currentAssessmentId}`)
			await loadStudentEvaluation()
		} else {
			// Clear only student-specific data, keep paragraphs and header photo visible
			studentName = ''
			// No studentImage - only header photo for assessment
			// Don't clear paragraphs, selectedParagraphs, or marks - keep them visible
		}
	}

	function getCurrentStudent() {
		return students.find(s => s.id === currentStudentId)
	}

	// Helper function to calculate mark ranges for a category based on percentage ranges
	function getCategoryMarkRanges(categoryMarks, percentageRanges) {
		if (!categoryMarks || !percentageRanges || percentageRanges.length === 0) return []

		return percentageRanges.map(range => {
			const lower = (categoryMarks * range.lowerPercentage / 100).toFixed(1)
			const upper = (categoryMarks * range.upperPercentage / 100).toFixed(1)
			return {
				color: range.color,
				range: `${lower}-${upper}`,
				lower: parseFloat(lower),
				upper: parseFloat(upper)
			}
		}).sort((a, b) => b.lower - a.lower) // Sort from highest to lowest
	}

	// Percentage range management
	function addPercentageRange(value, color, lowerPercentage, upperPercentage) {
		if (!currentAssessment) return

		const calculatedLower = (value * lowerPercentage / 100).toFixed(2)
		const calculatedUpper = (value * upperPercentage / 100).toFixed(2)

		// Ensure percentageRanges array exists on assessment
		if (!currentAssessment.percentageRanges) {
			currentAssessment.percentageRanges = []
		}

		// Add range to current assessment
		currentAssessment.percentageRanges = [...currentAssessment.percentageRanges, {
			id: Date.now().toString(),
			value: value,
			color: color,
			lowerPercentage: lowerPercentage,
			upperPercentage: upperPercentage,
			calculatedLower: parseFloat(calculatedLower),
			calculatedUpper: parseFloat(calculatedUpper)
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

		// Still save other evaluation data (marks, etc.) in separate file for compatibility
		const evaluationData = {
			studentId: currentStudentId,
			assessmentId: currentAssessmentId,
			paragraphs: [...paragraphs],
			// selectedParagraphs: removed - now stored in student properties only
			studentName: studentName,
			// No studentImage - only header photo for assessment
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
			showSuccessNotification(getMotivationalMessage('student'))
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-evaluation-${currentStudentId}-${currentAssessmentId}`
			localStorage.setItem(key, JSON.stringify(evaluationData))
			showSuccessNotification(getMotivationalMessage('student'))
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

			// 2. Transfer evaluation data (marks, etc.)
			const evaluationData = {
				studentId: targetStudentId,
				assessmentId: currentAssessmentId,
				paragraphs: [...paragraphs],
				studentName: students.find(s => s.id === targetStudentId)?.name || '',
				categoryMarks: { ...categoryMarks },
				manualTotalMarks: manualTotalMarks,
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
		let savedStudentImage = ''
		let savedCategoryMarks = {}
		let savedManualTotalMarks = ''

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
				// No studentImage - only header photo for assessment
				savedCategoryMarks = evaluationData.categoryMarks || {}
				savedManualTotalMarks = evaluationData.manualTotalMarks || ''
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
				// No studentImage - only header photo for assessment
				savedCategoryMarks = evaluationData.categoryMarks || {}
				savedManualTotalMarks = evaluationData.manualTotalMarks || ''
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
			mappedCount: mappedSelections.size
		})

		// Apply the mapped selections and marks
		selectedParagraphs = mappedSelections
		// Preserve the student's display name if no saved name exists
		studentName = savedStudentName || getCurrentStudent()?.displayName || ''
		// No studentImage - only header photo for assessment
		categoryMarks = savedCategoryMarks
		manualTotalMarks = savedManualTotalMarks

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
				console.log(`DEBUG: Saved ID ${savedId} NOT found in merged paragraphs`)
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
		// Get the paragraph ID and text before deletion
		const deletedParagraph = paragraphs[index]
		const deletedParagraphId = deletedParagraph?.id
		
		// Extract category from the paragraph text
		let deletedCategory = ''
		if (deletedParagraph?.text && deletedParagraph.text.includes(': ')) {
			const parts = deletedParagraph.text.split(': ')
			if (parts.length >= 2) {
				deletedCategory = parts[0].trim()
			}
		}
		
		// Remove from paragraphs array (assignment level only)
		paragraphs.splice(index, 1)
		
		// Remove the deleted paragraph ID from selected paragraphs
		if (deletedParagraphId) {
			selectedParagraphs.delete(deletedParagraphId)
			selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
		}
		
		// Check if this was the last paragraph in the category
		if (deletedCategory && currentAssessment?.categories) {
			// Count remaining paragraphs in this category
			const remainingParagraphsInCategory = paragraphs.filter(para => {
				if (para.text && para.text.includes(': ')) {
					const parts = para.text.split(': ')
					if (parts.length >= 2) {
						const category = parts[0].trim()
						return category === deletedCategory
					}
				}
				return false
			})
			
			// If no paragraphs remain in this category, remove the category
			if (remainingParagraphsInCategory.length === 0) {
				console.log(`🗑️ No paragraphs remaining in category "${deletedCategory}". Removing category.`)
				
				// Remove category from assessment
				const categoryToRemove = currentAssessment.categories.find(cat => cat.name === deletedCategory)
				if (categoryToRemove) {
					currentAssessment.categories = currentAssessment.categories.filter(cat => cat.id !== categoryToRemove.id)
					
					// Update the current subject's assessments
					if (currentSubject) {
						const subjectIndex = subjects.findIndex(s => s.id === currentSubject.id)
						if (subjectIndex !== -1) {
							const assessmentIndex = subjects[subjectIndex].assessments.findIndex(a => a.id === currentAssessment.id)
							if (assessmentIndex !== -1) {
								subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
								console.log(`✅ Removed category "${deletedCategory}" from assessment. Remaining categories: ${currentAssessment.categories.length}`)
								saveSubjects()
							}
						}
					}
					
					// Remove category marks and warnings
					if (categoryMarks[deletedCategory] !== undefined) {
						delete categoryMarks[deletedCategory]
						categoryMarks = {...categoryMarks} // trigger reactivity
					}
					if (categoryWarnings[deletedCategory] !== undefined) {
						delete categoryWarnings[deletedCategory]
						categoryWarnings = {...categoryWarnings} // trigger reactivity
					}
					
					// Show notification
					showSuccessNotification(`Category "${deletedCategory}" was automatically removed as it had no remaining paragraphs.`)
				}
			}
		}
		
		// Update warnings for all categories with marks
		Object.keys(categoryMarks).forEach(category => {
			if (categoryMarks[category] && categoryMarks[category].trim() !== '') {
				const hasSelectedParagraphs = checkCategoryHasSelectedParagraphs(category)
				categoryWarnings[category] = !hasSelectedParagraphs
			}
		})
		categoryWarnings = {...categoryWarnings} // trigger reactivity
		
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
			
			grouped[groupKey].knowledgeAreas[knowledgeAreaKey].push({
				text: cleanText,
				color,
				id,
				originalIndex,
				fullText: paragraph, // Keep original for PDF
				source: source // Include source information
			})
		})
		
		return Object.values(grouped)
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

	function generatePDF() {
		console.log('📄 generatePDF called')
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
		
		// Add full-width header image if available
		if (currentAssessment?.headerPhoto) {
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
					
					doc.addImage(currentAssessment.headerPhoto, 'JPEG', xPosition, yPosition, imageWidth, imageHeight)
					
					// Continue with the rest of the PDF generation
					let currentY = yPosition + imageHeight + 15
					generateRestOfPDF(doc, currentY, margin, pageWidth, maxLineWidth, selectedText, studentName, currentSubject?.name, currentAssessment?.name)
				}
				img.src = currentAssessment.headerPhoto
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
				// Get allocated marks for this category
				const allocatedMarks = currentAssessment?.categories?.find(cat => cat.name === categoryName)?.allocatedMarks
				const marksText = categoryMarksValue > 0 ? 
					allocatedMarks ? ` [${categoryMarksValue}/${allocatedMarks} Marks]` : ` [${categoryMarksValue} Marks]` : ''
				
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
		showSuccessNotification('ℹ️ PDF generated and downloaded - feedback document ready with selected paragraphs and marks')
		
		// Auto-save student evaluation data when generating PDF
		if (currentStudentId) {
			saveStudentEvaluation()
		}
	}


	onMount(() => {
		loadSubjects()
		initializeDarkMode()
	})
</script>

<!-- Header -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">Feedback Manager v3.2.3</a>
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
			<div class="col-lg-3 col-md-4 col-12 mb-4">
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
					onSaveAssignmentData={saveAssessmentData}
					onExportAssignmentSettings={() => showExportModal = true}
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
														<strong>Selected Student:</strong> {getCurrentStudent()?.displayName || 'Loading...'}
													</div>
												</div>
											{/if}
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

									<!-- Mark Input for Fixed Mode -->
									{#if currentAssessment?.markingMode === 'fixed' && selectedColor && selectedCategory}
										<div class="mb-3">
											<label for="colorMarkInput" class="form-label fw-bold">Mark for this Color:</label>
											<input
												id="colorMarkInput"
												type="number"
												class="form-control"
												bind:value={selectedColorMark}
												placeholder="Enter mark value..."
												min="0"
												max={currentAssessment.categories?.find(c => c.name === selectedCategory)?.allocatedMarks || 100}
												step="0.5"
											>
											<small class="text-muted">
												Category: {selectedCategory}
												{#if currentAssessment.categories?.find(c => c.name === selectedCategory)?.allocatedMarks}
													(Max: {currentAssessment.categories?.find(c => c.name === selectedCategory)?.allocatedMarks} marks)
												{/if}
											</small>
										</div>
									{/if}
									
									<!-- Categories and Knowledge Areas Management -->
									<div class="mb-3">
										<div class="d-flex justify-content-between align-items-center mb-3">
											<div class="d-flex align-items-center gap-2">
												<button
													class="btn btn-link p-0 text-decoration-none text-dark"
													onclick={() => showCategoriesKnowledgeSection = !showCategoriesKnowledgeSection}
													title={showCategoriesKnowledgeSection ? 'Collapse' : 'Expand'}
												>
													<i class="bi bi-{showCategoriesKnowledgeSection ? 'dash' : 'plus'}-square me-1"></i>
												</button>
												<label class="form-label fw-bold mb-0">Assessment Configuration:</label>
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
												<label class="form-label fw-bold">Knowledge Areas:</label>
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

											<!-- Assessment Total Marks -->
											<div class="mb-3">
										<label for="assessmentTotalMarks" class="form-label fw-bold">Assessment Total Marks:</label>
										<input
											id="assessmentTotalMarks"
											type="number"
											class="form-control form-control-sm"
											placeholder="Enter total marks for this assessment..."
											bind:value={currentAssessment.totalMarks}
											min="0"
											step="0.5"
										>
										<small class="text-muted">This is the maximum marks for this assessment</small>
									</div>

									<!-- Marking Mode Selection -->
									<div class="mb-3">
										<label class="form-label fw-bold">Marking Mode:</label>
										<div class="btn-group w-100" role="group">
											<input
												type="radio"
												class="btn-check"
												name="markingMode"
												id="markingModeNone"
												value="none"
												bind:group={currentAssessment.markingMode}
											>
											<label class="btn btn-outline-primary btn-sm" for="markingModeNone">
												<i class="bi bi-x-circle me-1"></i>None
											</label>

											<input
												type="radio"
												class="btn-check"
												name="markingMode"
												id="markingModePercentage"
												value="percentage"
												bind:group={currentAssessment.markingMode}
											>
											<label class="btn btn-outline-primary btn-sm" for="markingModePercentage">
												<i class="bi bi-percent me-1"></i>Percentage
											</label>

											<input
												type="radio"
												class="btn-check"
												name="markingMode"
												id="markingModeFixed"
												value="fixed"
												bind:group={currentAssessment.markingMode}
											>
											<label class="btn btn-outline-primary btn-sm" for="markingModeFixed">
												<i class="bi bi-123 me-1"></i>Fixed
											</label>
										</div>
										<small class="text-muted d-block mt-1">
											{#if currentAssessment.markingMode === 'none'}
												<i class="bi bi-info-circle me-1"></i>No color marking system
											{:else if currentAssessment.markingMode === 'percentage'}
												<i class="bi bi-info-circle me-1"></i>Percentage ranges apply uniformly across all categories
											{:else}
												<i class="bi bi-info-circle me-1"></i>Set specific marks for each color when entering paragraphs
											{/if}
										</small>
									</div>

									<!-- Percentage Mode Instruction -->
									{#if currentAssessment.markingMode === 'percentage'}
										<div class="alert alert-info d-flex align-items-center mb-3" role="alert">
											<i class="bi bi-lightbulb me-2"></i>
											<div>
												<strong>How to use Percentage Mode:</strong>
												<div class="small mt-1">Add color ranges in Calculator sidebar once (click <i class="bi bi-calculator"></i> icon). Ranges will automatically apply to all categories.</div>
											</div>
										</div>
									{/if}

									<!-- Assessment Mark Ranges Display - Only for Percentage Mode -->
									{#if currentAssessment.markingMode === 'percentage' && currentAssessment.totalMarks > 0 && currentAssessment?.percentageRanges && currentAssessment.percentageRanges.length > 0}
										<div class="mb-3 border rounded p-3 bg-light">
											<h6 class="fw-bold mb-2 text-primary">
												<i class="bi bi-bar-chart-fill me-2"></i>Assessment Mark Ranges
											</h6>
											<div class="d-flex flex-wrap gap-2">
												{#each getCategoryMarkRanges(currentAssessment.totalMarks, currentAssessment.percentageRanges) as markRange}
													<div class="badge p-2" style="background-color: {markRange.color}; color: white; font-size: 0.85rem;">
														{markRange.range}
													</div>
												{/each}
											</div>
											<small class="text-muted d-block mt-2">
												<i class="bi bi-info-circle me-1"></i>These mark ranges apply to the overall assessment (Total: {currentAssessment.totalMarks} marks)
											</small>
										</div>
									{/if}

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
													<input
														id="categoryAllocatedMarks"
														type="number"
														class="form-control form-control-sm"
														placeholder="Marks"
														bind:value={newCategoryAllocatedMarks}
														min="0"
														step="0.5"
														style="width: 100px;"
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
												<div class="d-flex flex-column gap-2">
													{#each (currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999))) as category, index}
														<div class="border rounded p-2 bg-light">
															<div class="d-flex align-items-center justify-content-between mb-1">
																<span class="fw-bold small">
																	{category.name}
																	{#if category.allocatedMarks}
																		<span class="text-primary">({category.allocatedMarks} marks)</span>
																	{/if}
																</span>
																<button
																	class="btn btn-sm p-0 border-0 text-danger"
																	onclick={() => removeCategory(category.id)}
																	title="Delete category"
																	aria-label="Delete category"
																>
																	<i class="bi bi-trash"></i>
																</button>
															</div>

															{#if category.allocatedMarks && currentAssessment.markingMode === 'percentage'}
																<!-- Percentage-based Mark Ranges -->
																{#if currentAssessment?.percentageRanges && currentAssessment.percentageRanges.length > 0}
																	<div class="d-flex flex-wrap gap-1">
																		{#each getCategoryMarkRanges(category.allocatedMarks, currentAssessment.percentageRanges) as markRange}
																			<span class="badge" style="background-color: {markRange.color}; color: white; font-size: 0.7rem;">
																				{markRange.range}
																			</span>
																		{/each}
																	</div>
																{/if}
															{/if}
														</div>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</div>

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
													{#each (currentAssessment?.knowledgeAreas || []) as area}
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
											</div>
										</div>
									</div>
								{/if}

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
										class="form-control form-control-sm w-auto" 
										id="marks-{group.category}"
										style="width: 60px;"
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
																	<!-- Category reordering buttons (only in assignment mode) -->
																	{#if !currentStudentId}
																		{@const categoryObj = currentAssessment.categories.find(cat => cat.name === group.category)}
																		{@const categoryIndex = currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999)).findIndex(cat => cat.name === group.category)}
																		<div class="d-flex flex-column">
																			<button 
																				class="btn btn-sm btn-outline-light" 
																				style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
																				onclick={() => moveCategoryUp(categoryObj.id)}
																				title="Move category up"
																				disabled={categoryIndex === 0}
																			>
																				<i class="bi bi-chevron-up"></i>
																			</button>
																			<button 
																				class="btn btn-sm btn-outline-light" 
																				style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
																				onclick={() => moveCategoryDown(categoryObj.id)}
																				title="Move category down"
																				disabled={categoryIndex === currentAssessment.categories.length - 1}
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
																	Warning: No paragraphs selected for this category. Marks entered will not be included in the final report.
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
																{#if knowledgeArea !== 'No Knowledge Area'}
																	<div class="bg-light border-bottom px-3 py-2">
																		<small class="text-muted fw-bold">
																			<i class="bi bi-bookmark me-1"></i>{knowledgeArea}
																		</small>
																	</div>
																{/if}
																{#each paragraphs as {text, color, id, originalIndex, fullText, source, mark, category}}
																<div class="border-bottom p-3 {originalIndex === paragraphs[paragraphs.length - 1].originalIndex ? '' : 'border-bottom'}">
																	<div class="d-flex align-items-start">
																		{#if currentStudentId}
																			<div class="form-check me-3 d-flex align-items-center">
																				<input 
																					class="form-check-input" 
																					type="checkbox" 
																					id="paragraph-{id}"
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
																				<label class="form-check-label fw-bold ms-2" for="paragraph-{id}">
																					Select
																				</label>
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
																	{#if currentStudentId && color}
																		{#if mark !== undefined}
																			<!-- Fixed mark mode - show specific mark -->
																			<div class="me-3 d-flex align-items-center">
																				<span class="badge bg-primary text-white small" title="Fixed mark for {color} color">
																					{mark} marks
																				</span>
																			</div>
																		{:else}
																			<!-- Percentage mode - show marks range -->
																			{@const categoryObj = currentAssessment?.categories?.find(cat => cat.name === group.category)}
																			{@const marksRange = getMarksRange(color, categoryObj?.allocatedMarks)}
																			{#if marksRange}
																				<div class="me-3 d-flex align-items-center">
																					<span class="badge bg-secondary text-white small" title="Marks range for {color} color">
																						{marksRange}
																					</span>
																				</div>
																			{/if}
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
																					{#if source && source !== undefined}
																						<div class="ms-2">
																							{#if source === 'assignment'}
																								<span class="badge bg-primary" title="Assignment version">
																									<i class="bi bi-file-text me-1"></i>Assignment
																								</span>
																							{:else if source === 'student'}
																								<span class="badge bg-success" title="Student version">
																									<i class="bi bi-person me-1"></i>Student
																								</span>
																							{:else if source === 'merged'}
																								<span class="badge bg-info" title="Merged content (identical assignment and student versions)">
																									<i class="bi bi-arrow-down-up me-1"></i>Merged
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
																				<!-- Paragraph reordering buttons (only in assignment mode) -->
																				{#if !currentStudentId}
																					<button 
																						class="btn btn-outline-secondary btn-sm" 
																						onclick={() => moveParagraphUp(originalIndex)}
																						title="Move paragraph up"
																						aria-label="Move paragraph up"
																						disabled={originalIndex === 0}
																					>
																						<i class="bi bi-chevron-up"></i>
																					</button>
																					<button 
																						class="btn btn-outline-secondary btn-sm" 
																						onclick={() => moveParagraphDown(originalIndex)}
																						title="Move paragraph down"
																						aria-label="Move paragraph down"
																						disabled={originalIndex === paragraphs.length - 1}
																					>
																						<i class="bi bi-chevron-down"></i>
																					</button>
																				{/if}
																				<button 
																					class="btn btn-outline-primary btn-sm" 
																					onclick={() => startEditParagraph(originalIndex)}
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
	
	:global(.col-lg-3, .col-lg-9, .col-md-4, .col-md-8) {
		display: flex;
		flex-direction: column;
		min-height: calc(100vh - 200px);
	}
	
	:global(.col-lg-9 .row) {
		display: flex;
		flex-direction: column;
	}
	
	/* Autosave animation */
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
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


<!-- Delete Student Confirmation Modal -->
{#if showDeleteConfirmation && studentToDelete}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header bg-danger text-white">
					<h5 class="modal-title">
						<i class="bi bi-exclamation-triangle me-2"></i>Confirm Student Deletion
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => { showDeleteConfirmation = false; studentToDelete = null; }}></button>
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

