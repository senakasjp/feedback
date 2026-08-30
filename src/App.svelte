<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount, untrack } from 'svelte'
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
	import { debugInfo, debugLog, isVerboseDebugEnabled } from './utils/debug.js'
	
	// Import data services
	import { studentsService } from './services/dataService.js'
	import { buildImproveEnglishPromptPreview, improveEnglish, isOpenAIConfigured, transcribeAudioBlob } from './services/openaiService.js'
	import { buildAssessmentVectorIndex, buildImproveFeedbackWithRagPromptPreview, generateEvidenceCheckReport, generateStructuredMarkingDraft, findCriterionByName, improveFeedbackWithRag, isAssessmentVectorIndexCurrent } from './services/aiMarkingService.js'
	import { AI_CHAT_MODEL_OPTIONS, AI_PROVIDER_OPTIONS, AI_REASONING_EFFORT_OPTIONS, DEFAULT_AI_CHAT_MODEL, DEFAULT_AI_PROVIDER, DEFAULT_AI_REASONING_EFFORT, getAiModelLabel, getModelsForProvider, getProviderForModel, getReasoningEffortLabel, getSupportedReasoningEfforts, sanitizeAiChatModel, sanitizeAiProvider, sanitizeReasoningEffort } from './services/aiModelService.js'
	import { getProvider as getLlmProvider, getStoredApiKey, isProviderConfigured, setStoredApiKey } from './services/llmProviders.js'
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
	const AI_MODEL_STORAGE_KEY = 'feedback-ai-selected-model-v1'
	const AI_REASONING_STORAGE_KEY = 'feedback-ai-reasoning-effort-v1'
	const AI_PROVIDER_STORAGE_KEY = 'feedback-ai-selected-provider-v1'
	const TABLE_HTML_SPACER_SNIPPET = '<div style="margin-top: 20px;"></div>'
	const TABLE_HTML_TICK_SNIPPET = '<td style="border: 1px solid #333; padding: 10px; text-align: center;">&#10003;</td>'
	const TABLE_HTML_CROSS_SNIPPET = '<td style="border: 1px solid #333; padding: 10px; text-align: center;">&#10007;</td>'
	const console = { ...globalThis.console, log: debugLog, info: debugInfo }

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
	let assignmentParagraphSnapshot = $state([])
	let selectedParagraphs = $state(new Set())
	let missingParagraphCategories = $state(new Set()) // Category names with no paragraphs added, flagged when generating a PDF
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
	let lockPdfPortrait = $state(false)
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
	let quickAddIncludeCommonPrompt = $state({}) // Per-category: whether the assessment's common AI prompt applies (default true)
	let showCommonPromptBox = $state(false)
	let quickAddInstructionAssessmentKey = $state('')
	let quickAddInstructionExpanded = $state({})
	const quickAddInstructionSaveTimers = {}
	let quickAddColorPicker = $state({})
	let speechRecordingCategory = $state('')
	let speechTranscribingByCategory = $state({})
	let activeSpeechRecorder = null
	let activeSpeechStream = null
	let activeSpeechStopFn = null
	let speechUploadTargetCategory = $state('')
	let speechUploadInput = null
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
	let promptPreviewRequestPayload = $state(null)
	let showAppLogModal = $state(false)
	let appLogEntries = $state([])
	let activeFeedbackTab = $state('enter-data')
	let lastStudentEffectAssessmentId = $state(null)
	let lastStudentEffectStudentId = $state(null)
	
	// Visual debug for checkbox issue
	let showCheckboxDebug = $state(false)
	let checkboxDebugInfo = $state([])
	let paragraphLookup = $derived.by(() => buildParagraphLookup())
	let assessmentCategoryLookup = $derived.by(() => buildAssessmentCategoryLookup())
	let orderedParagraphs = $derived.by(() => buildOrderedParagraphs())
	let groupedParagraphs = $derived.by(() => buildGroupedParagraphs())
	let paragraphInfoIndex = $derived.by(() => buildParagraphInfoIndex())
	let groupedParagraphCaches = $derived.by(() => buildGroupedParagraphCaches())
	
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
	let showEditingParagraphSaveWarning = $state(false)
	let editingParagraphSaveWarningTimer = null

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
	let showAiModelSettings = $state(false)
	let aiModelSettingsContainer = $state(null)
	let selectedAiProvider = $state(DEFAULT_AI_PROVIDER)
	let apiKeyDrafts = $state({})
	let selectedAiModel = $state(DEFAULT_AI_CHAT_MODEL)
	let selectedAiReasoningEffort = $state(DEFAULT_AI_REASONING_EFFORT)
	let aiModelSettingsReady = $state(false)
	let manualAiModelInput = $state(DEFAULT_AI_CHAT_MODEL)
	const MAX_APP_LOG_ENTRIES = 500
	const originalConsoleMethods = {
		log: console.log.bind(console),
		info: console.info.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console),
		debug: console.debug.bind(console)
	}

	// Force reactivity for debugging
	$effect(() => {
		console.log('Current view changed to:', currentView)
	})

	function serializeLogValue(value) {
		if (value instanceof Error) {
			return value.stack || `${value.name}: ${value.message}`
		}
		if (typeof value === 'string') {
			return value
		}
		if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
			return String(value)
		}
		if (typeof value === 'function') {
			return `[Function ${value.name || 'anonymous'}]`
		}
		if (typeof value === 'object') {
			try {
				const seen = new WeakSet()
				return JSON.stringify(value, (key, nestedValue) => {
					if (nestedValue instanceof Error) {
						return nestedValue.stack || `${nestedValue.name}: ${nestedValue.message}`
					}
					if (typeof nestedValue === 'object' && nestedValue !== null) {
						if (seen.has(nestedValue)) {
							return '[Circular]'
						}
						seen.add(nestedValue)
					}
					return nestedValue
				}, 2)
			} catch {
				return Object.prototype.toString.call(value)
			}
		}
		return String(value)
	}

	function addAppLog(level, ...values) {
		const message = values.map(value => serializeLogValue(value)).join(' ')
		const entry = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			timestamp: new Date().toISOString(),
			level: String(level || 'info').toLowerCase(),
			message
		}
		untrack(() => {
			const nextEntries = Array.isArray(appLogEntries) ? appLogEntries.slice(-(MAX_APP_LOG_ENTRIES - 1)) : []
			nextEntries.push(entry)
			appLogEntries = nextEntries
		})
	}

	$effect(() => {
		if (appLogEntries.length > MAX_APP_LOG_ENTRIES) {
			appLogEntries = appLogEntries.slice(-MAX_APP_LOG_ENTRIES)
		}
	})

	function clearAppLogs() {
		appLogEntries = []
		addAppLog('info', 'Application logs cleared by user.')
	}

	async function copyAppLogs() {
		const logText = appLogEntries
			.slice(-MAX_APP_LOG_ENTRIES)
			.map(entry => `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`)
			.join('\n')

		if (!logText.trim()) {
			showSuccessNotification('⚠️ No log entries available to copy.')
			return
		}

		try {
			await navigator.clipboard.writeText(logText)
			showSuccessNotification(`✅ Copied ${appLogEntries.length} log entries.`)
		} catch (error) {
			addAppLog('error', 'Failed to copy application logs.', error)
			showSuccessNotification(`❌ Failed to copy logs: ${error.message}`)
		}
	}

	function installAppLogging() {
		;['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
			console[method] = (...args) => {
				const shouldCapture = method === 'warn' || method === 'error' || isVerboseDebugEnabled()
				if (shouldCapture) {
					addAppLog(method, ...args)
				}
				originalConsoleMethods[method](...args)
			}
		})

		const handleWindowError = (event) => {
			addAppLog('error', 'Window error:', event.error || event.message || 'Unknown error')
		}

		const handleUnhandledRejection = (event) => {
			addAppLog('error', 'Unhandled promise rejection:', event.reason || 'Unknown rejection reason')
		}

		window.addEventListener('error', handleWindowError)
		window.addEventListener('unhandledrejection', handleUnhandledRejection)
		if (isVerboseDebugEnabled()) {
			addAppLog('info', 'Application logging initialized.')
		}

		return () => {
			console.log = originalConsoleMethods.log
			console.info = originalConsoleMethods.info
			console.warn = originalConsoleMethods.warn
			console.error = originalConsoleMethods.error
			console.debug = originalConsoleMethods.debug
			window.removeEventListener('error', handleWindowError)
			window.removeEventListener('unhandledrejection', handleUnhandledRejection)
		}
	}

	function isStudentOwnedParagraph(paragraph) {
		if (!paragraph || typeof paragraph !== 'object') return false
		if (paragraph._source === 'student') return true
		if (typeof paragraph.id === 'string' && paragraph.id.endsWith('_student')) return true
		return false
	}

	function resolveParagraphOwner(source = '', paragraphId = '') {
		if (source === 'student') return 'student'
		if (source === 'assignment') return 'assignment'
		if (source === 'merged') return 'assignment'
		if (typeof paragraphId === 'string' && paragraphId.endsWith('_student')) return 'student'
		return 'assignment'
	}

	function getParagraphOwnerLabel(source = '', paragraphId = '') {
		const owner = resolveParagraphOwner(source, paragraphId)
		if (owner === 'student') {
			const selectedStudent = getCurrentStudent()
			return getStudentFirstNameLabel(studentName || selectedStudent?.displayName || selectedStudent?.name || 'Student')
		}
		return 'Assignment'
	}

	function formatParagraphSavedDate(createdAt) {
		if (!createdAt) return ''
		const parsed = new Date(createdAt)
		if (Number.isNaN(parsed.getTime())) return ''
		return parsed.toLocaleString([], {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

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

	function initializeAiModelSettings() {
		const savedModel = localStorage.getItem(AI_MODEL_STORAGE_KEY)
		const nextModel = sanitizeAiChatModel(savedModel || DEFAULT_AI_CHAT_MODEL)
		const savedProvider = localStorage.getItem(AI_PROVIDER_STORAGE_KEY)
		const savedReasoningEffort = localStorage.getItem(AI_REASONING_STORAGE_KEY)

		selectedAiProvider = sanitizeAiProvider(savedProvider || getProviderForModel(nextModel))
		selectedAiModel = nextModel
		manualAiModelInput = nextModel
		selectedAiReasoningEffort = sanitizeReasoningEffort(nextModel, savedReasoningEffort || DEFAULT_AI_REASONING_EFFORT)
		apiKeyDrafts = Object.fromEntries(AI_PROVIDER_OPTIONS.map(option => [option.value, getStoredApiKey(option.value)]))
		aiModelSettingsReady = true
	}

	$effect(() => {
		if (!aiModelSettingsReady) return
		localStorage.setItem(AI_MODEL_STORAGE_KEY, selectedAiModel)
		localStorage.setItem(AI_PROVIDER_STORAGE_KEY, selectedAiProvider)
		localStorage.setItem(AI_REASONING_STORAGE_KEY, selectedAiReasoningEffort)
	})

	function toggleAiModelSettings() {
		showAiModelSettings = !showAiModelSettings
	}

	function closeAiModelSettings() {
		showAiModelSettings = false
	}

	function selectAiProvider(provider) {
		selectedAiProvider = sanitizeAiProvider(provider)
		const providerModels = getModelsForProvider(selectedAiProvider)
		if (!providerModels.some(option => option.value === selectedAiModel)) {
			selectAiModel(providerModels[0]?.value || selectedAiModel)
		}
	}

	function saveApiKey(providerId) {
		setStoredApiKey(providerId, apiKeyDrafts[providerId] || '')
		apiKeyDrafts = { ...apiKeyDrafts, [providerId]: getStoredApiKey(providerId) }
		showSuccessNotification(`✅ ${getLlmProvider(providerId).label} API key saved.`)
	}

	function clearApiKey(providerId) {
		setStoredApiKey(providerId, '')
		apiKeyDrafts = { ...apiKeyDrafts, [providerId]: '' }
		showSuccessNotification(`${getLlmProvider(providerId).label} API key cleared (falls back to .env if set).`)
	}

	function selectAiModel(model) {
		selectedAiModel = sanitizeAiChatModel(model)
		selectedAiProvider = getProviderForModel(selectedAiModel)
		manualAiModelInput = selectedAiModel
		selectedAiReasoningEffort = sanitizeReasoningEffort(selectedAiModel, selectedAiReasoningEffort)
	}

	function applyManualAiModel() {
		const trimmedModel = sanitizeAiChatModel(manualAiModelInput)
		manualAiModelInput = trimmedModel
		selectedAiModel = trimmedModel
		selectedAiReasoningEffort = sanitizeReasoningEffort(selectedAiModel, selectedAiReasoningEffort)
	}

	function selectAiReasoningEffort(reasoningEffort) {
		selectedAiReasoningEffort = sanitizeReasoningEffort(selectedAiModel, reasoningEffort)
	}

	function getCurrentAiModelPreference() {
		return {
			selectedModel: selectedAiModel,
			reasoningEffort: selectedAiReasoningEffort,
			provider: selectedAiProvider
		}
	}

	function isCurrentAiProviderConfigured() {
		return isProviderConfigured(selectedAiProvider)
	}

	function getCurrentAiProviderLabel() {
		return getLlmProvider(selectedAiProvider).label
	}

	function getSupportedReasoningOptionObjects() {
		const supportedEfforts = new Set(getSupportedReasoningEfforts(selectedAiModel))
		return AI_REASONING_EFFORT_OPTIONS.filter(option => supportedEfforts.has(option.value))
	}

	function highlightEditingParagraphSaveWarning() {
		if (editingParagraphSaveWarningTimer) {
			clearTimeout(editingParagraphSaveWarningTimer)
		}

		showEditingParagraphSaveWarning = true
		editingParagraphSaveWarningTimer = setTimeout(() => {
			showEditingParagraphSaveWarning = false
			editingParagraphSaveWarningTimer = null
		}, 2200)
	}

	function hasPendingParagraphEdit() {
		return editingParagraphIndex !== null
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

	function stripStudentIdFromLabel(label = '') {
		return String(label || '').replace(/\s*\([0-9]+\)\s*$/g, '').trim()
	}

	function getStudentFirstNameLabel(studentOrLabel) {
		const rawLabel = typeof studentOrLabel === 'string'
			? studentOrLabel
			: (studentOrLabel?.displayName || studentOrLabel?.name || '')
		const cleanLabel = stripStudentIdFromLabel(rawLabel)
		const firstToken = cleanLabel.split(/\s+/).filter(Boolean)[0]
		return firstToken || 'Student'
	}

	function getStudentFullNameLabel(studentOrLabel) {
		const rawLabel = typeof studentOrLabel === 'string'
			? studentOrLabel
			: (studentOrLabel?.displayName || studentOrLabel?.name || '')
		return stripStudentIdFromLabel(rawLabel) || 'Student'
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

	async function insertTableHtmlSnippet(snippet, label = 'snippet') {
		const currentHtml = String(assessmentHtml || '')

		if (currentHtml.includes(snippet)) {
			showSuccessNotification(`ℹ️ ${label} already exists in Assessment HTML.`)
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
		showSuccessNotification(`✅ ${label} inserted into Assessment HTML.`)
	}

	async function insertTableHtmlSpacerSnippet() {
		await insertTableHtmlSnippet(TABLE_HTML_SPACER_SNIPPET, 'Spacer snippet')
	}

	async function insertTableHtmlTickSnippet() {
		await insertTableHtmlSnippet(TABLE_HTML_TICK_SNIPPET, 'Tick snippet')
	}

	async function insertTableHtmlCrossSnippet() {
		await insertTableHtmlSnippet(TABLE_HTML_CROSS_SNIPPET, 'Cross snippet')
	}

	async function setLockPdfPortrait(checked) {
		lockPdfPortrait = Boolean(checked)
		if (currentAssessment) {
			currentAssessment = {
				...currentAssessment,
				lockPdfPortrait
			}
		}
		await saveAssessmentData({ force: Boolean(currentStudentId), skipSelections: true })
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
		rows.forEach(			row => {
			const firstCell = /** @type {HTMLTableRowElement} */ (row).cells?.[0]
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
		// A pasted rubric table almost always reads better in landscape: more width per column
		// means far less text-wrapping, which keeps rows shorter and lets more of them fit per page.
		if (/<table[\s>]/i.test(html)) return true
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
				
				// STRICT DATA SEPARATION: Assessment storage must never include student-owned paragraphs
				loadedParagraphs = loadedParagraphs.filter(para => {
					if (para?._source === 'student') return false
					if (para?.id && para.id.endsWith('_student')) return false
					return true
				})
				
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
				
				// Ensure paragraphs have IDs + migrate legacy fields
				paragraphs = ensureParagraphsHaveIds(uniqueParagraphs, 'assignment').map((paragraph, index) => ({
					...paragraph,
					_source: 'assignment',
					createdAt: paragraph.createdAt || new Date().toISOString(),
					originalIndex: index,
					fullText: paragraph.text || paragraph.fullText || ''
				}))
				assignmentParagraphSnapshot = [...paragraphs.filter(paragraph => !isStudentOwnedParagraph(paragraph))]
				
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
					if (currentAssessment && parsed.lockPdfPortrait !== undefined) {
						currentAssessment.lockPdfPortrait = Boolean(parsed.lockPdfPortrait)
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
					studentSubmissionDocuments = []
					assessmentHtml = currentAssessment?.rubricHtml || ''
					lockPdfPortrait = Boolean(currentAssessment?.lockPdfPortrait)
					tableRowCategoryMap = currentAssessment?.tableRowCategoryMap || {}
					tableColumnMarkMap = currentAssessment?.tableColumnMarkMap || {}
					assessmentVectorIndex = currentAssessment?.aiVectorIndex || null
					assessmentReferenceDocuments = currentAssessment?.aiReferenceDocuments || []
					quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
					quickAddIncludeCommonPrompt = buildQuickAddIncludeCommonPromptDefaults()
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
					
					// STRICT DATA SEPARATION: Assessment storage must never include student-owned paragraphs
					loadedParagraphs = loadedParagraphs.filter(para => {
						if (para?._source === 'student') return false
						if (para?.id && para.id.endsWith('_student')) return false
						return true
					})
					
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
					
					// Ensure paragraphs have IDs + migrate legacy fields
					paragraphs = ensureParagraphsHaveIds(uniqueParagraphs, 'assignment').map((paragraph, index) => ({
						...paragraph,
						_source: 'assignment',
						createdAt: paragraph.createdAt || new Date().toISOString(),
						originalIndex: index,
						fullText: paragraph.text || paragraph.fullText || ''
					}))
					assignmentParagraphSnapshot = [...paragraphs.filter(paragraph => !isStudentOwnedParagraph(paragraph))]
					
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
					if (currentAssessment && parsed.lockPdfPortrait !== undefined) {
						currentAssessment.lockPdfPortrait = Boolean(parsed.lockPdfPortrait)
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
					studentSubmissionDocuments = []
					assessmentHtml = currentAssessment?.rubricHtml || ''
					lockPdfPortrait = Boolean(currentAssessment?.lockPdfPortrait)
					tableRowCategoryMap = currentAssessment?.tableRowCategoryMap || {}
					tableColumnMarkMap = currentAssessment?.tableColumnMarkMap || {}
					assessmentVectorIndex = currentAssessment?.aiVectorIndex || null
					assessmentReferenceDocuments = currentAssessment?.aiReferenceDocuments || []
					quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
					quickAddIncludeCommonPrompt = buildQuickAddIncludeCommonPromptDefaults()
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
		assignmentParagraphSnapshot = []
		selectedParagraphs = new Set()
		studentName = ''
		studentSubmissionText = ''
		studentSubmissionDocuments = []
		// No studentImage - only header photo for assessment
		assessmentHtml = ''
		lockPdfPortrait = false
		showAssessmentHtml = false
		tableRowCategoryMap = {}
		tableColumnMarkMap = {}
		assessmentVectorIndex = null
		assessmentReferenceDocuments = []
		categoryMarks = {}
		manualTotalMarks = ''
		quickAddText = {}
		stopSpeechRecorder()
		speechTranscribingByCategory = {}
		quickAddAiInstructions = {}
		quickAddIncludeCommonPrompt = {}
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
		// Note: promptPreviewTitle/Messages/RequestPayload are NOT cleared here — the header
		// "Last Prompt" button keeps the most recently sent prompt available across assessments.
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
			quickAddIncludeCommonPrompt = {}
			quickAddInstructionExpanded = {}
			quickAddInstructionAssessmentKey = ''
			return
		}

		const assessmentKey = `${currentSubjectId || ''}:${currentAssessmentId || ''}`
		if (quickAddInstructionAssessmentKey !== assessmentKey) {
			quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
			quickAddIncludeCommonPrompt = buildQuickAddIncludeCommonPromptDefaults()
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

		if (hasPendingParagraphEdit()) {
			highlightEditingParagraphSaveWarning()
			showSuccessNotification('⚠️ Cannot save while a paragraph is being edited. Save or cancel that paragraph first.')
			return
		}

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

		const paragraphsForAssessmentSave = currentStudentId
			? assignmentParagraphSnapshot.filter(paragraph => !isStudentOwnedParagraph(paragraph))
			: paragraphs.filter(paragraph => !isStudentOwnedParagraph(paragraph))

		const normalizedAssessmentParagraphs = ensureParagraphsHaveIds(paragraphsForAssessmentSave, 'assignment').map((paragraph, index) => ({
			...paragraph,
			_source: 'assignment',
			createdAt: paragraph.createdAt || new Date().toISOString(),
			originalIndex: index,
			fullText: paragraph.text || paragraph.fullText || ''
		}))

		if (!currentStudentId) {
			assignmentParagraphSnapshot = [...normalizedAssessmentParagraphs]
		}

		const data = {
			paragraphs: normalizedAssessmentParagraphs,
			selectedParagraphs: Array.from(currentStudentId && (force || skipSelections) ? new Set() : selectedParagraphs),
			// Assignment data should never contain student-specific information
			studentName: '',
			// No studentImage - only header photo for assessment
			headerPhoto: currentAssessment?.headerPhoto || '',
			rubricHtml: assessmentHtml,
			lockPdfPortrait,
			tableRowCategoryMap,
			tableColumnMarkMap,
			aiReferenceDocuments: assessmentReferenceDocuments,
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
				lockPdfPortrait: false,
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
			lockPdfPortrait = Boolean(assessment.lockPdfPortrait)
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
			_source: currentStudentId ? 'student' : 'assignment',
			createdAt: new Date().toISOString(),
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
		const answerInstructions = getCombinedAnswerInstructions(categoryName)
		if (!text) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		if (!isCurrentAiProviderConfigured()) {
			showSuccessNotification(`⚠️ ${getCurrentAiProviderLabel()} API key is not configured. Please add your API key to the .env file.`)
			return
		}

		// Set loading state
		improvingText = { ...improvingText, [categoryName]: true }

		try {
			promptPreviewTitle = `Improve Prompt - ${categoryName}`
			promptPreviewMessages = buildImproveEnglishPromptPreview(text, answerInstructions)
			promptPreviewRequestPayload = buildPromptPreviewRequestPayload(promptPreviewMessages, 0.3, 1000)
			const result = await improveEnglish(text, answerInstructions, getCurrentAiModelPreference())
			// Strip any HTML tags that might have been introduced
			const cleanedText = stripHtmlTags(result.improvedText || '')
			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			// Mark this text as AI-improved for styling
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification(`✨ Text improved with ${getAiModelLabel(result.usedModel)} (${getReasoningEffortLabel(result.usedReasoningEffort)}).`)
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

	function buildQuickAddIncludeCommonPromptDefaults() {
		const defaults = {}
		const perAnswerMap = currentAssessment?.commonPromptEnabledByCategory || {}
		for (const category of currentAssessment?.categories || []) {
			const mappedValue = perAnswerMap[category.name] ?? perAnswerMap[normalizeCategoryName(category.name)]
			defaults[category.name] = mappedValue ?? (category.includeCommonAiPrompt ?? true)
		}
		return defaults
	}

	function isCommonPromptIncluded(categoryName) {
		return quickAddIncludeCommonPrompt[categoryName] !== false
	}

	async function persistCategoryIncludeCommonPrompt(categoryName, isIncluded) {
		quickAddIncludeCommonPrompt = { ...quickAddIncludeCommonPrompt, [categoryName]: isIncluded }
		if (!currentAssessment || !currentAssessmentId || !currentSubjectId) return

		const nextPerAnswerMap = {
			...(currentAssessment.commonPromptEnabledByCategory || {}),
			[categoryName]: isIncluded,
			[normalizeCategoryName(categoryName)]: isIncluded
		}

		let updatedCategories = currentAssessment.categories || []
		const categoryIndex = updatedCategories.findIndex(
			category => normalizeCategoryName(category.name) === normalizeCategoryName(categoryName)
		)
		if (categoryIndex !== -1) {
			updatedCategories = [...updatedCategories]
			updatedCategories[categoryIndex] = {
				...updatedCategories[categoryIndex],
				includeCommonAiPrompt: isIncluded
			}
		}

		currentAssessment = {
			...currentAssessment,
			categories: updatedCategories,
			commonPromptEnabledByCategory: nextPerAnswerMap
		}

		const subjectIndex = subjects.findIndex(subject => subject.id === currentSubjectId)
		if (subjectIndex === -1) return
		const assessmentIndex = subjects[subjectIndex].assessments.findIndex(assessment => assessment.id === currentAssessmentId)
		if (assessmentIndex === -1) return

		subjects[subjectIndex].assessments[assessmentIndex] = currentAssessment
		await saveSubjects()
	}

	// Merges the assessment-wide common prompt (unless opted out per category) with this category's own instructions.
	function getCombinedAnswerInstructions(categoryName) {
		const common = isCommonPromptIncluded(categoryName)
			? (currentAssessment?.commonParagraphAiInstructions || '').trim()
			: ''
		const perCategory = (quickAddAiInstructions[categoryName] || '').trim()
		return [common, perCategory].filter(Boolean).join('\n\n')
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
		studentSubmissionDocuments = Array.isArray(nextDocuments) ? nextDocuments : []
	}

	function getSafeStudentSubmissionDocuments() {
		return Array.isArray(studentSubmissionDocuments) ? studentSubmissionDocuments : []
	}

	function getCombinedStudentSubmissionText() {
		const sections = []

		if (studentSubmissionText.trim()) {
			sections.push(studentSubmissionText.trim())
		}

		getSafeStudentSubmissionDocuments().forEach(document => {
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
			studentSubmissionDocuments: [...getSafeStudentSubmissionDocuments()],
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
			let extractionFailures = 0
			for (const file of files) {
				let extractedText = ''
				let extractionError = ''
				try {
					extractedText = await extractTextFromFile(file)
				} catch (error) {
					extractionFailures += 1
					extractionError = String(error?.message || error || 'Unknown extraction error')
					console.error(`Assessment reference extraction failed for ${file.name}:`, error)
				}

				const record = createUploadedDocumentRecord({
					file,
					extractedText,
					documentType: selectedAssessmentDocumentType,
					scope: 'assessment'
				})
				if (extractionError) {
					record.extractionError = extractionError
				}

				uploadedDocuments.push(record)
			}

			updateAssessmentReferenceDocuments([...assessmentReferenceDocuments, ...uploadedDocuments])
			await saveAssessmentData({ force: Boolean(currentStudentId), skipSelections: true })
			if (extractionFailures > 0) {
				showSuccessNotification(`⚠️ Added ${uploadedDocuments.length} file${uploadedDocuments.length === 1 ? '' : 's'}, but ${extractionFailures} file${extractionFailures === 1 ? '' : 's'} could not be text-extracted.`)
			} else {
				showSuccessNotification(`✅ Added ${uploadedDocuments.length} assessment reference file${uploadedDocuments.length === 1 ? '' : 's'} for AI marking.`)
			}
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
			let extractionFailures = 0
			for (const file of files) {
				let extractedText = ''
				let extractionError = ''
				try {
					extractedText = await extractTextFromFile(file)
				} catch (error) {
					extractionFailures += 1
					extractionError = String(error?.message || error || 'Unknown extraction error')
					console.error(`Student upload extraction failed for ${file.name}:`, error)
				}

				const record = createUploadedDocumentRecord({
					file,
					extractedText,
					documentType: selectedStudentDocumentType,
					scope: 'student'
				})
				if (extractionError) {
					record.extractionError = extractionError
				}

				uploadedDocuments.push(record)
			}

			updateStudentSubmissionDocuments([...getSafeStudentSubmissionDocuments(), ...uploadedDocuments])
			await persistCurrentStudentEvaluationData()
			if (extractionFailures > 0) {
				showSuccessNotification(`⚠️ Added ${uploadedDocuments.length} file${uploadedDocuments.length === 1 ? '' : 's'}, but ${extractionFailures} file${extractionFailures === 1 ? '' : 's'} could not be text-extracted.`)
			} else {
				showSuccessNotification(`✅ Added ${uploadedDocuments.length} student file${uploadedDocuments.length === 1 ? '' : 's'} for AI marking.`)
			}
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
		updateStudentSubmissionDocuments(getSafeStudentSubmissionDocuments().filter(document => document.id !== documentId))
		await persistCurrentStudentEvaluationData()
		showSuccessNotification('Student upload removed.')
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
		const answerInstructions = getCombinedAnswerInstructions(categoryName)
		if (!shortText) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		if (!isCurrentAiProviderConfigured()) {
			showSuccessNotification(`⚠️ ${getCurrentAiProviderLabel()} API key is not configured. Please add your API key to the .env file.`)
			return
		}

		improvingTextWithRag = { ...improvingTextWithRag, [categoryName]: true }

		try {
			const priorEvaluations = await loadPriorAssessmentEvaluations()
			const assessmentParagraphs = paragraphs.filter(paragraph => paragraph?._source !== 'student')
			const { assessmentForAi, vectorIndex } = await ensureAssessmentVectorIndex({ priorEvaluations, assessmentParagraphs })
			const ragArgs = {
				assessment: assessmentForAi,
				categoryName,
				shortFeedback: shortText,
				answerInstructions,
				student: getCurrentStudent(),
				studentSubmission: getCombinedStudentSubmissionText(),
				studentSubmissionDocuments: [...getSafeStudentSubmissionDocuments()],
				evidenceNotes: getSelectedEvidenceNotes(categoryName),
				assessmentParagraphs,
				priorEvaluations,
				vectorIndex,
				globalSystemInstructions: globalAiSystemInstructions
			}
			const preview = await buildImproveFeedbackWithRagPromptPreview(ragArgs)
			promptPreviewTitle = `RAG Prompt - ${categoryName}`
			promptPreviewMessages = preview.messages
			promptPreviewRequestPayload = buildPromptPreviewRequestPayload(preview.messages, 0.35, 900)
			const result = await improveFeedbackWithRag({
				...ragArgs,
				modelPreference: getCurrentAiModelPreference()
			})

			const cleanedText = stripHtmlTags(result.improvedText || '').trim()
			if (!cleanedText) {
				throw new Error('No improved feedback was returned.')
			}

			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification(`✨ Feedback expanded with ${getAiModelLabel(result.usedModel)} (${getReasoningEffortLabel(result.usedReasoningEffort)} / ${result.retrievalMode || 'context'}).`)
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

		if (!isCurrentAiProviderConfigured()) {
			showSuccessNotification(`⚠️ ${getCurrentAiProviderLabel()} API key is not configured. Please add your API key to the .env file.`)
			return
		}

		const answerInstructions = getCombinedAnswerInstructions(categoryName)
		const studentSubmission = getCombinedStudentSubmissionText()
		const evidenceNotes = getSelectedEvidenceNotes(categoryName)

		if (!studentSubmission && !evidenceNotes) {
			showSuccessNotification('⚠️ Add student submission text, upload student files, or select evidence notes first.')
			return
		}

		evidenceCheckingText = { ...evidenceCheckingText, [categoryName]: true }
		addAppLog('info', `========== Evidence check started: ${categoryName} ==========`)
		console.info('UI evidence check triggered', {
			categoryName,
			studentId: currentStudentId,
			assessmentId: currentAssessmentId,
			subjectId: currentSubjectId
		})

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
				answerInstructions,
				modelPreference: getCurrentAiModelPreference()
			})

			const cleanedText = stripHtmlTags(result.reportText || '').trim()
			if (!cleanedText) {
				throw new Error('No evidence-check report was returned.')
			}

			quickAddText = { ...quickAddText, [categoryName]: cleanedText }
			aiImprovedText = { ...aiImprovedText, [categoryName]: true }
			showSuccessNotification(`✅ Reports check generated with ${getAiModelLabel(result.usedModel)} (${getReasoningEffortLabel(result.usedReasoningEffort)} / ${result.retrievalMode || 'context'}).`)
		} catch (error) {
			console.error('Failed to run reports check:', error)
			showSuccessNotification(`❌ Reports check failed: ${error.message}`)
		} finally {
			console.info('UI evidence check completed', { categoryName })
			evidenceCheckingText = { ...evidenceCheckingText, [categoryName]: false }
		}
	}

	async function draftFeedbackWithAI() {
		if (!currentStudentId) {
			showSuccessNotification('⚠️ Please select a student first.')
			return
		}

		if (!isCurrentAiProviderConfigured()) {
			showSuccessNotification(`⚠️ ${getCurrentAiProviderLabel()} API key is not configured. Please add your API key to the .env file.`)
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
				vectorIndex,
				modelPreference: getCurrentAiModelPreference()
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
		// Keep the last prompt cached (not cleared) so the header "Last Prompt" button can reopen it.
		showPromptPreviewModal = false
	}

	function openLastAiPromptModal() {
		if (promptPreviewMessages.length === 0) {
			showSuccessNotification('ℹ️ No AI prompt has been sent yet in this session.')
			return
		}
		showPromptPreviewModal = true
	}

	function buildPromptPreviewRequestPayload(messages = [], temperature = 0.3, maxTokens = 1000) {
		const modelPreference = getCurrentAiModelPreference()
		const provider = getLlmProvider(modelPreference.provider)
		const isOpenAiProvider = modelPreference.provider === 'openai'
		const normalizedTemperature = isOpenAiProvider && String(modelPreference.selectedModel || '').trim().toLowerCase().startsWith('gpt-5')
			? 1
			: temperature
		return {
			endpoint: provider.chatUrl,
			model: modelPreference.selectedModel,
			...(isOpenAiProvider ? { reasoning_effort: modelPreference.reasoningEffort } : {}),
			temperature: normalizedTemperature,
			[isOpenAiProvider ? 'max_completion_tokens' : 'max_tokens']: maxTokens,
			messages
		}
	}

	async function viewFinalPrompt(categoryName, mode = 'ai') {
		const shortText = stripHtmlTags((quickAddText[categoryName] || '').trim())
		const answerInstructions = getCombinedAnswerInstructions(categoryName)

		if (!shortText) {
			showSuccessNotification('⚠️ Please enter some text first')
			return
		}

		try {
			if (mode === 'ai') {
				const messages = buildImproveEnglishPromptPreview(shortText, answerInstructions)
				promptPreviewMessages = messages
				promptPreviewRequestPayload = buildPromptPreviewRequestPayload(messages, 0.3, 1000)
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
					studentSubmissionDocuments: [...getSafeStudentSubmissionDocuments()],
					evidenceNotes: getSelectedEvidenceNotes(categoryName),
					assessmentParagraphs,
					priorEvaluations,
					vectorIndex,
					globalSystemInstructions: globalAiSystemInstructions
				})

			promptPreviewMessages = preview.messages
			promptPreviewRequestPayload = buildPromptPreviewRequestPayload(preview.messages, 0.35, 900)
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

		const addToAssessment = currentStudentId && quickAddToAssessmentWhenStudentSelected

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
			_source: currentStudentId && !addToAssessment ? 'student' : 'assignment',
			createdAt: new Date().toISOString(),
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

	function stopSpeechRecorder() {
		if (typeof activeSpeechStopFn === 'function') {
			const stopFn = activeSpeechStopFn
			activeSpeechStopFn = null
			stopFn()
			return
		}

		if (activeSpeechRecorder && activeSpeechRecorder.state !== 'inactive') {
			activeSpeechRecorder.stop()
			return
		}

		speechRecordingCategory = ''
		if (activeSpeechStream) {
			activeSpeechStream.getTracks().forEach(track => track.stop())
			activeSpeechStream = null
		}
		activeSpeechRecorder = null
	}

	async function transcribeAndAppendToQuickAdd(categoryName, audioBlob) {
		speechTranscribingByCategory = { ...speechTranscribingByCategory, [categoryName]: true }
		try {
			const transcript = await transcribeAudioBlob(audioBlob)
			const existingText = quickAddText[categoryName] || ''
			const separator = existingText.trim().length > 0 ? '\n' : ''
			quickAddText = {
				...quickAddText,
				[categoryName]: `${existingText}${separator}${transcript}`
			}
			showSuccessNotification('✨ Speech converted to text.')
		} catch (error) {
			console.error('Speech-to-text failed:', error)
			showSuccessNotification(`❌ Speech-to-text failed: ${error.message}`)
		} finally {
			speechTranscribingByCategory = { ...speechTranscribingByCategory, [categoryName]: false }
		}
	}

	function createWavBlobFromFloat32(audioChunks, sampleRate) {
		const totalSamples = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
		const pcmData = new Int16Array(totalSamples)

		let offset = 0
		for (const chunk of audioChunks) {
			for (let i = 0; i < chunk.length; i++) {
				const sample = Math.max(-1, Math.min(1, chunk[i]))
				pcmData[offset + i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
			}
			offset += chunk.length
		}

		const buffer = new ArrayBuffer(44 + pcmData.byteLength)
		const view = new DataView(buffer)

		const writeString = (position, value) => {
			for (let i = 0; i < value.length; i++) {
				view.setUint8(position + i, value.charCodeAt(i))
			}
		}

		writeString(0, 'RIFF')
		view.setUint32(4, 36 + pcmData.byteLength, true)
		writeString(8, 'WAVE')
		writeString(12, 'fmt ')
		view.setUint32(16, 16, true)
		view.setUint16(20, 1, true)
		view.setUint16(22, 1, true)
		view.setUint32(24, sampleRate, true)
		view.setUint32(28, sampleRate * 2, true)
		view.setUint16(32, 2, true)
		view.setUint16(34, 16, true)
		writeString(36, 'data')
		view.setUint32(40, pcmData.byteLength, true)

		new Int16Array(buffer, 44).set(pcmData)
		return new Blob([buffer], { type: 'audio/wav' })
	}

	async function startWebAudioFallbackRecording(categoryName) {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		const AudioContextClass = /** @type {any} */ (window).AudioContext || /** @type {any} */ (window).webkitAudioContext
		if (!AudioContextClass) {
			stream.getTracks().forEach(track => track.stop())
			throw new Error('Web Audio API is not available.')
		}

		const audioContext = new AudioContextClass()
		const source = audioContext.createMediaStreamSource(stream)
		const processor = audioContext.createScriptProcessor(4096, 1, 1)
		const silence = audioContext.createGain()
		silence.gain.value = 0
		const audioChunks = []

		processor.onaudioprocess = (event) => {
			const channelData = event.inputBuffer.getChannelData(0)
			audioChunks.push(new Float32Array(channelData))
		}

		source.connect(processor)
		processor.connect(silence)
		silence.connect(audioContext.destination)

		activeSpeechStream = stream
		activeSpeechRecorder = { state: 'recording' }
		speechRecordingCategory = categoryName

		activeSpeechStopFn = async () => {
			activeSpeechStopFn = null
			speechRecordingCategory = ''
			try {
				processor.disconnect()
				source.disconnect()
				silence.disconnect()
			} catch {
				// ignore disconnect cleanup errors
			}
			stream.getTracks().forEach(track => track.stop())
			activeSpeechStream = null
			activeSpeechRecorder = null
			await audioContext.close()

			if (audioChunks.length === 0) {
				showSuccessNotification('⚠️ No audio captured.')
				return
			}

			const wavBlob = createWavBlobFromFloat32(audioChunks, audioContext.sampleRate)
			await transcribeAndAppendToQuickAdd(categoryName, wavBlob)
		}

		showSuccessNotification('🎙️ Recording started. Click mic again to stop.')
	}

	function openSpeechUploadPicker(categoryName) {
		speechUploadTargetCategory = categoryName
		if (speechUploadInput) {
			speechUploadInput.value = ''
			speechUploadInput.click()
		}
	}

	async function handleSpeechAudioUpload(event) {
		const input = event.currentTarget
		const file = input?.files?.[0]
		const categoryName = speechUploadTargetCategory
		if (!file || !categoryName) return

		speechTranscribingByCategory = { ...speechTranscribingByCategory, [categoryName]: true }
		try {
			const transcript = await transcribeAudioBlob(file)
			const existingText = quickAddText[categoryName] || ''
			const separator = existingText.trim().length > 0 ? '\n' : ''
			quickAddText = {
				...quickAddText,
				[categoryName]: `${existingText}${separator}${transcript}`
			}
			showSuccessNotification('✨ Audio file converted to text.')
		} catch (error) {
			console.error('Audio transcription failed:', error)
			showSuccessNotification(`❌ Speech-to-text failed: ${error.message}`)
		} finally {
			speechUploadTargetCategory = ''
			speechTranscribingByCategory = { ...speechTranscribingByCategory, [categoryName]: false }
			if (input) {
				input.value = ''
			}
		}
	}

	async function toggleQuickAddSpeechToText(categoryName) {
		if (!isOpenAIConfigured()) {
			showSuccessNotification('⚠️ OpenAI API key is not configured. Please add your API key to the .env file.')
			return
		}

		if (speechRecordingCategory === categoryName) {
			stopSpeechRecorder()
			return
		}

		if (speechRecordingCategory && speechRecordingCategory !== categoryName) {
			showSuccessNotification('⚠️ Another recording is in progress. Stop it first.')
			return
		}

		if (!navigator?.mediaDevices?.getUserMedia) {
			showSuccessNotification('❌ Live mic recording is not supported in this environment.')
			return
		}

		if (typeof MediaRecorder === 'undefined') {
			try {
				await startWebAudioFallbackRecording(categoryName)
			} catch (error) {
				console.error('Failed to start fallback recording:', error)
				showSuccessNotification(`❌ Unable to start microphone recording: ${error.message}`)
			}
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const recorder = new MediaRecorder(stream)
			const audioChunks = []

			activeSpeechStream = stream
			activeSpeechRecorder = recorder
			speechRecordingCategory = categoryName

			recorder.ondataavailable = (event) => {
				if (event?.data && event.data.size > 0) {
					audioChunks.push(event.data)
				}
			}

			recorder.onerror = () => {
				speechRecordingCategory = ''
				if (activeSpeechStream) {
					activeSpeechStream.getTracks().forEach(track => track.stop())
				}
				activeSpeechStream = null
				activeSpeechRecorder = null
				showSuccessNotification('❌ Recording failed. Please try again.')
			}

			recorder.onstop = async () => {
				speechRecordingCategory = ''
				activeSpeechStopFn = null
				if (activeSpeechStream) {
					activeSpeechStream.getTracks().forEach(track => track.stop())
				}
				activeSpeechStream = null
				activeSpeechRecorder = null

				if (audioChunks.length === 0) {
					showSuccessNotification('⚠️ No audio captured.')
					return
				}

				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
				await transcribeAndAppendToQuickAdd(categoryName, audioBlob)
			}

			activeSpeechStopFn = () => recorder.stop()
			recorder.start()
			showSuccessNotification('🎙️ Recording started. Click mic again to stop.')
		} catch (error) {
			console.error('Failed to start recording:', error)
			showSuccessNotification(`❌ Unable to access microphone: ${error.message}`)
		}
	}

	function sendParagraphToAiInput(paragraphText, categoryName, knowledgeAreaName = '', paragraphId = '') {
		if (paragraphId && selectedParagraphs.has(paragraphId)) {
			selectedParagraphs = new Set([...selectedParagraphs].filter(id => id !== paragraphId))
		}

		copyToQuickAdd(paragraphText, categoryName, paragraphId)
		if (knowledgeAreaName && knowledgeAreaName !== 'No Knowledge Area') {
			quickAddKnowledgeArea = {
				...quickAddKnowledgeArea,
				[categoryName]: knowledgeAreaName
			}
		}
		showSuccessNotification('Paragraph loaded into AI-supported input for editing.')
	}

	// Copy paragraph text to quick-add box for customization
	function copyToQuickAdd(paragraphText, categoryName, paragraphId = '') {
		// Extract the main text without category prefix and knowledge area suffix
		const mainText = extractMainTextFromParagraph(paragraphText)

		// Remove the source paragraph from the list since it will be re-added after editing
		const paragraphIndex = paragraphs.findIndex(p => {
			if (paragraphId && p?.id === paragraphId) {
				return true
			}
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

		async function persistCategoryReorder(reorderedCategories) {
			if (!currentAssessment) return

			const updatedAssessment = {
				...currentAssessment,
				categories: reorderedCategories
			}
			currentAssessment = updatedAssessment

			if (!currentSubject) return

			const subjectIndex = subjects.findIndex(subject => subject.id === currentSubject.id)
			if (subjectIndex === -1) return

			const updatedAssessments = (subjects[subjectIndex].assessments || []).map(assessment =>
				assessment.id === updatedAssessment.id ? updatedAssessment : assessment
			)
			const updatedSubject = {
				...subjects[subjectIndex],
				assessments: updatedAssessments
			}

			subjects = subjects.map((subject, index) => index === subjectIndex ? updatedSubject : subject)
			currentSubject = updatedSubject
			await saveSubjects()
		}

		async function moveCategoryUp(categoryId) {
			if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
			
			const normalized = normalizeCategoryOrder(currentAssessment.categories)
			const index = normalized.findIndex(cat => cat.id === categoryId || normalizeCategoryName(cat.name) === normalizeCategoryName(categoryId))
			if (index <= 0) return

			const swapped = [...normalized]
			;[swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]]

			const reordered = swapped.map((cat, idx) => ({ ...cat, order: idx }))
			await persistCategoryReorder(reordered)
		}

		async function moveCategoryDown(categoryId) {
			if (!currentAssessment?.categories || currentStudentId) return // Only in assignment mode
			
			const normalized = normalizeCategoryOrder(currentAssessment.categories)
			const index = normalized.findIndex(cat => cat.id === categoryId || normalizeCategoryName(cat.name) === normalizeCategoryName(categoryId))
			if (index === -1 || index >= normalized.length - 1) return

			const swapped = [...normalized]
			;[swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]]

			const reordered = swapped.map((cat, idx) => ({ ...cat, order: idx }))
			await persistCategoryReorder(reordered)
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
		const group = groupedParagraphCaches.groupsByNormalizedCategory[target]
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
		const nextVariant = /❌|failed|error|unable|cannot/i.test(nextMessage) ? 'danger' : 'success'
		addAppLog(nextVariant === 'danger' ? 'error' : 'info', 'Notification:', nextMessage)
		notificationMessage = nextMessage
		notificationVariant = nextVariant
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
		if (showStudentPicker && container && event.target instanceof Node && !container.contains(event.target)) {
			closeStudentPicker()
		}

		if (showAiModelSettings && aiModelSettingsContainer && event.target instanceof Node && !aiModelSettingsContainer.contains(event.target)) {
			closeAiModelSettings()
		}
	}

	function handleGlobalKeyDown(event) {
		if (event.key !== 'Escape') return

		if (showStudentPicker) {
			closeStudentPicker()
		}

		if (showAiModelSettings) {
			closeAiModelSettings()
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
				if (key && (
					key.startsWith(`student-evaluation-${studentId}-`) ||
					key === `student-paragraphs-${studentId}` ||
					key.startsWith(`student-uploads-${studentId}-`)
				)) {
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
				studentSubmissionDocuments = []
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

		// Persist assignment-level instruction edits before switching student context
		try {
			Object.keys(quickAddInstructionSaveTimers).forEach(key => {
				clearTimeout(quickAddInstructionSaveTimers[key])
				delete quickAddInstructionSaveTimers[key]
			})
			syncCurrentAssessmentAiInstructionsFromQuickAdd()
			await saveAssessmentData({ force: true, skipSelections: true })
		} catch (error) {
			console.error('Failed to persist assignment instructions before student switch:', error)
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
			quickAddAiInstructions = buildQuickAddAiInstructionDefaults()
			quickAddIncludeCommonPrompt = buildQuickAddIncludeCommonPromptDefaults()
		} else {
			// Clear only student-specific data, keep paragraphs and header photo visible
			studentName = ''
			studentSubmissionText = ''
			studentPhoto = ''
			// No studentImage - only header photo for assessment
			// Don't clear paragraphs, selectedParagraphs, or marks - keep them visible
		}
	}

	function cloneAssignmentParagraphsForStudentSelection() {
		const snapshot = assignmentParagraphSnapshot.filter(paragraph => !isStudentOwnedParagraph(paragraph))
		if (snapshot.length > 0) {
			return snapshot.map(paragraph => typeof paragraph === 'object' ? { ...paragraph } : paragraph)
		}

		const currentAssignmentParagraphs = paragraphs.filter(paragraph => !isStudentOwnedParagraph(paragraph))
		return currentAssignmentParagraphs.map(paragraph => typeof paragraph === 'object' ? { ...paragraph } : paragraph)
	}

	function normalizeParagraphComparisonKey(paragraph) {
		const text = typeof paragraph === 'string' ? paragraph : paragraph?.text
		const color = typeof paragraph === 'object' ? paragraph?.color : ''
		return `${String(text || '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')}::${String(color || '')}`
	}

	function paragraphsDifferByContent(assignmentParagraphs, studentParagraphs) {
		if (studentParagraphs.length === 0) {
			return false
		}

		if (assignmentParagraphs.length !== studentParagraphs.length) {
			return true
		}

		const assignmentCounts = new Map()
		for (const paragraph of assignmentParagraphs) {
			const key = normalizeParagraphComparisonKey(paragraph)
			assignmentCounts.set(key, (assignmentCounts.get(key) || 0) + 1)
		}

		for (const paragraph of studentParagraphs) {
			const key = normalizeParagraphComparisonKey(paragraph)
			const nextCount = assignmentCounts.get(key)
			if (!nextCount) {
				return true
			}
			if (nextCount === 1) {
				assignmentCounts.delete(key)
			} else {
				assignmentCounts.set(key, nextCount - 1)
			}
		}

		return assignmentCounts.size > 0
	}

	async function loadStudentEvaluationRecord(studentId, assessmentId) {
		try {
			const data = await invoke('read_student_evaluation', { studentId, assessmentId })
			return data ? JSON.parse(data) : null
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-evaluation-${studentId}-${assessmentId}`
			const data = localStorage.getItem(key)
			return data ? JSON.parse(data) : null
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
		[...(Array.isArray(students) ? students : [])].sort((a, b) => (a?.displayName || '').localeCompare(b?.displayName || ''))
	)

	// Save student evaluation data
	async function saveStudentEvaluation() {
		if (!currentStudentId || !currentAssessmentId) return

		if (hasPendingParagraphEdit()) {
			highlightEditingParagraphSaveWarning()
			showSuccessNotification('⚠️ Cannot save while a paragraph is being edited. Save or cancel that paragraph first.')
			return
		}

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

		try {
			// Ensure per-answer instructions are persisted to assignment when saving student data
			await saveAssessmentData({ force: true, skipSelections: true })

			if (!Array.isArray(students)) {
				console.error('Students state is invalid during save:', students)
				showSuccessNotification('❌ Failed to save student data: student list is corrupted. Please reopen the assessment.')
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
		} catch (error) {
			console.error('Failed to save student evaluation:', error)
			showSuccessNotification(`❌ Failed to save student data: ${error.message || 'Unknown error'}`)
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
			const paragraphsForContext = ensureParagraphsHaveIds(paragraphs).map((para, index) => {
				const paragraphObject = typeof para === 'string'
					? { id: generateId(para, index), text: para, color: '', _source: 'student', createdAt: new Date().toISOString() }
					: { ...para }

				return {
					...paragraphObject,
					subjectId: currentSubjectId,
					assessmentId: currentAssessmentId
				}
			})

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
				paragraphs: [...paragraphsForContext],
				studentName: students.find(s => s.id === targetStudentId)?.name || '',
				studentSubmissionText: studentSubmissionText.trim(),
				studentSubmissionDocuments: [...getSafeStudentSubmissionDocuments()],
				categoryMarks: { ...categoryMarks },
				manualTotalMarks: currentAssessment?.totalMarks ?? manualTotalMarks,
				quickAddText: { ...quickAddText },
				selectedParagraphs: selectedParagraphsToTransfer,
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
		const requestedStudentId = currentStudentId
		const requestedAssessmentId = currentAssessmentId
		const requestedSubjectId = currentSubjectId

		// STRICT FILTER: Validate context before loading student evaluation
		if (!requestedStudentId || !requestedAssessmentId) {
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
		
		const assessmentExists = currentSubject.assessments.some(assessment => assessment.id === requestedAssessmentId)
		if (!assessmentExists) {
			console.error(`STRICT FILTER: Assessment ${requestedAssessmentId} not found in current subject for student evaluation`)
			return
		}

		console.log(`STRICT FILTER: Loading student evaluation for student ${requestedStudentId} in assessment ${requestedAssessmentId}`)

		const assignmentParagraphs = cloneAssignmentParagraphsForStudentSelection()

		// Load student paragraphs and evaluation record in parallel
		const [studentParagraphs, evaluationData] = await Promise.all([
			loadStudentParagraphsForMerging(requestedStudentId, requestedSubjectId, requestedAssessmentId),
			loadStudentEvaluationRecord(requestedStudentId, requestedAssessmentId)
		])

		if (currentStudentId !== requestedStudentId || currentAssessmentId !== requestedAssessmentId || currentSubjectId !== requestedSubjectId) {
			return
		}

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

		const studentHasChanges = paragraphsDifferByContent(assignmentParagraphs, studentParagraphs)
		
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
		let savedStudentSubmissionDocuments = []
		let savedCategoryMarks = {}
		let savedManualTotalMarks = ''
		let savedQuickAddText = {}

		// First, try to load selected paragraphs from student properties
		const currentStudent = students.find(s => s.id === currentStudentId)
		if (currentStudent) {
			console.log('DEBUG: Current student found:', currentStudent.displayName)
			console.log('DEBUG: Student selectedParagraphs:', currentStudent.selectedParagraphs)
			console.log('DEBUG: Looking for assessmentId:', currentAssessmentId)
			
			const studentSelectedParagraphs = studentsService.getStudentSelectedParagraphs(currentStudent, requestedAssessmentId)
			console.log('DEBUG: Retrieved student selected paragraphs:', studentSelectedParagraphs)
			
			if (studentSelectedParagraphs && studentSelectedParagraphs.length > 0) {
				savedSelectedParagraphs = new Set(studentSelectedParagraphs)
				console.log('✅ LOADED: Selected paragraphs from student properties:', Array.from(savedSelectedParagraphs))
			} else {
				console.log('⚠️ No selections found in student properties for assessment:', requestedAssessmentId)
			}
		} else {
			console.log('❌ ERROR: Current student not found for ID:', currentStudentId)
		}

		if (evaluationData) {
			if (evaluationData.studentId !== requestedStudentId || evaluationData.assessmentId !== requestedAssessmentId) {
				console.error('STRICT FILTER: Student evaluation data mismatch - ignoring loaded data')
				return
			}

			if (savedSelectedParagraphs.size === 0 && evaluationData.selectedParagraphs) {
				savedSelectedParagraphs = new Set(evaluationData.selectedParagraphs)
				console.log('🔄 LEGACY: Selected paragraphs from evaluation file (legacy data):', Array.from(savedSelectedParagraphs))
				console.log('⚠️ WARNING: Using legacy data - consider migrating to student properties')
			}

			savedStudentName = evaluationData.studentName || ''
			savedStudentSubmissionText = evaluationData.studentSubmissionText || ''
			savedStudentSubmissionDocuments = evaluationData.studentSubmissionDocuments || []
			savedStudentImage = evaluationData.studentImage || evaluationData.studentPhoto || evaluationData.photo || ''
			savedCategoryMarks = evaluationData.categoryMarks || {}
			savedManualTotalMarks = evaluationData.manualTotalMarks || ''
			savedQuickAddText = evaluationData.quickAddText || {}
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
		studentSubmissionDocuments = Array.isArray(savedStudentSubmissionDocuments) ? savedStudentSubmissionDocuments : []
		studentPhoto = savedStudentImage || getStudentPhoto(getCurrentStudent()) || ''
		if (savedStudentImage && requestedStudentId) {
			students = students.map(student => (
				student.id === requestedStudentId && !getStudentPhoto(student)
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
		const hasLoadedData = savedSelectedParagraphs.size > 0 || Object.keys(savedCategoryMarks).length > 0 || savedStudentName || savedManualTotalMarks || savedStudentSubmissionDocuments.length > 0
		
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
						createdAt: assignmentOriginal.createdAt || new Date().toISOString(),
						_source: 'merged' // Mark as merged content
					})
				} else {
					merged.push({
						id: generateId(assignmentPara.text, i),
						text: assignmentPara.text,
						color: assignmentPara.color,
						createdAt: new Date().toISOString(),
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
						createdAt: assignmentOriginal.createdAt || new Date().toISOString(),
						_source: 'assignment'
					})
				} else {
					merged.push({
						id: generateId(assignmentPara.text, i),
						text: assignmentPara.text,
						color: assignmentPara.color,
						createdAt: new Date().toISOString(),
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
					createdAt: studentOriginal.createdAt || new Date().toISOString(),
					_source: 'student'
				})
			} else {
				merged.push({
					id: generateId(studentPara.text, i) + '_student',
					text: studentPara.text,
					color: studentPara.color,
					createdAt: new Date().toISOString(),
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
					createdAt: new Date().toISOString(),
					originalIndex: index,
					fullText: para
				}
			} else {
				return {
					...para,
					createdAt: para.createdAt || new Date().toISOString(),
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

		// Add only student-owned paragraphs to student storage (avoid assignment leakage)
		const currentParagraphs = ensureParagraphsHaveIds(
			paragraphs.filter(para => isStudentOwnedParagraph(para)),
			'student'
		).map(para => ({
			...para,
			_source: 'student',
			createdAt: para.createdAt || new Date().toISOString(),
			subjectId: currentSubjectId,
			assessmentId: currentAssessmentId
		}))
		
		// Migrate legacy paragraphs by adding missing subjectId/assessmentId
		const migratedExistingParagraphs = ensureParagraphsHaveIds(existingStudentParagraphs, 'student').map(para => {
			const migrated = {
				...para,
				_source: 'student',
				createdAt: para.createdAt || new Date().toISOString()
			}
			if (!para.subjectId || !para.assessmentId) {
				console.log('MIGRATION: Adding subjectId/assessmentId to legacy paragraph:', para.text?.substring(0, 50))
				return {
					...migrated,
					subjectId: currentSubjectId,
					assessmentId: currentAssessmentId
				}
			}
			return migrated
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
					// Legacy migration path: include context-free paragraphs and stamp context on next save
					console.log('LEGACY DATA: Including paragraph without subjectId/assessmentId for migration:', para.text?.substring(0, 50))
					return true
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				paragraphs = ensureParagraphsHaveIds(filteredParagraphs, 'student')
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
				paragraphs = ensureParagraphsHaveIds(filteredParagraphs, 'student')
			}
		}
	}

	// Load student paragraphs for merging (without overwriting paragraphs variable)
	async function loadStudentParagraphsForMerging(studentId = currentStudentId, subjectId = currentSubjectId, assessmentId = currentAssessmentId) {
		if (!studentId) return []

		try {
			const data = await invoke('read_student_paragraphs', { 
				studentId
			})
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						const matches = para.subjectId === subjectId && para.assessmentId === assessmentId
						if (!matches) {
							console.log('MERGE FILTERED OUT: Paragraph from different assignment:', {
								paraSubjectId: para.subjectId,
								paraAssessmentId: para.assessmentId,
								subjectId,
								assessmentId,
								text: para.text?.substring(0, 50)
							})
						}
						return matches
					}
					// Legacy migration path: include context-free paragraphs and stamp context on next save
					console.log('LEGACY DATA: Including paragraph without subjectId/assessmentId for migration:', para.text?.substring(0, 50))
					return true
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				return ensureParagraphsHaveIds(filteredParagraphs, 'student')
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			const key = `student-paragraphs-${studentId}`
			const data = localStorage.getItem(key)
			if (data) {
				const studentData = JSON.parse(data)
				const allStudentParagraphs = studentData.paragraphs || []
				
				// STRICT DATA ISOLATION: Filter paragraphs by current subject and assessment
				// For legacy data without subjectId/assessmentId, include them (migration fallback)
				const filteredParagraphs = allStudentParagraphs.filter(para => {
					// If paragraph has subjectId and assessmentId, use strict filtering
					if (para.subjectId && para.assessmentId) {
						return para.subjectId === subjectId && para.assessmentId === assessmentId
					}
					// For legacy paragraphs without context, include them (will be migrated on next save)
					console.log('LEGACY DATA: Including paragraph without subjectId/assessmentId for migration:', para.text?.substring(0, 50))
					return true
				})
				
				// Ensure paragraphs have IDs (migration for existing data)
				return ensureParagraphsHaveIds(filteredParagraphs, 'student')
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
		const paragraphToEdit = paragraphs[index]
		const paragraphId = paragraphToEdit?.id
		if (paragraphId && selectedParagraphs.has(paragraphId)) {
			selectedParagraphs.delete(paragraphId)
			selectedParagraphs = new Set(selectedParagraphs)
		}

		showEditingParagraphSaveWarning = false
		if (editingParagraphSaveWarningTimer) {
			clearTimeout(editingParagraphSaveWarningTimer)
			editingParagraphSaveWarningTimer = null
		}

		editingParagraphIndex = index
		// Extract only the main text content (without category and knowledge area prefixes)
		const extractedText = extractMainTextFromParagraph(paragraphs[index].text)
		// Set as HTML for rich text editor
		editingParagraphText = extractedText
	}

	function cancelEditParagraph() {
		editingParagraphIndex = null
		editingParagraphText = ''
		showEditingParagraphSaveWarning = false
		if (editingParagraphSaveWarningTimer) {
			clearTimeout(editingParagraphSaveWarningTimer)
			editingParagraphSaveWarningTimer = null
		}
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
			showEditingParagraphSaveWarning = false
			if (editingParagraphSaveWarningTimer) {
				clearTimeout(editingParagraphSaveWarningTimer)
				editingParagraphSaveWarningTimer = null
			}
			
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

	function buildOrderedParagraphs() {
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

		return ordered
	}

	function getOrderedParagraphs() {
		return orderedParagraphs
	}

	function buildParagraphLookup() {
		const byId = {}
		const mainIndexById = {}
		paragraphs.forEach((paragraph, index) => {
			const paragraphId = paragraph?.id
			if (paragraphId === undefined || paragraphId === null || paragraphId === '') return
			byId[paragraphId] = paragraph
			mainIndexById[paragraphId] = index
		})
		return { byId, mainIndexById }
	}

	function buildAssessmentCategoryLookup() {
		const byExactName = {}
		const byNormalizedName = {}
		for (const category of currentAssessment?.categories || []) {
			if (!category?.name) continue
			byExactName[category.name] = category
			byNormalizedName[normalizeCategoryName(category.name)] = category
		}
		return { byExactName, byNormalizedName }
	}

	// getColorBadgeClass function is now imported from utils/helpers.js

	// getColorHex function is now imported from utils/helpers.js

	// cleanParagraphTextForDisplay function is now imported from utils/helpers.js

	// extractKnowledgeArea function is now imported from utils/helpers.js

	function buildGroupedParagraphs() {
		const ordered = orderedParagraphs
		const { byId } = paragraphLookup
		const { byExactName, byNormalizedName } = assessmentCategoryLookup
		const grouped = {}
		
		// First, initialize all categories from the assessment (even if they have no paragraphs)
		// Sort categories by order field if available
		if (currentAssessment?.categories) {
			const sortedCategories = normalizeCategoryOrder(currentAssessment.categories)
			
			sortedCategories.forEach(category => {
				const groupKey = category.name
				if (!grouped[groupKey]) {
					grouped[groupKey] = {
						categoryId: category.id || category.name,
						category: category.name,
						knowledgeAreas: {}
					}
				}
			})
		}
		
		// Then process paragraphs and add them to their respective categories
		ordered.forEach(({paragraph, color, id, originalIndex}) => {
			// Get the source information from the paragraph object
			const paragraphObj = byId[id]
			const source = paragraphObj?._source
			const createdAt = paragraphObj?.createdAt
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
				const matchedCategory = byNormalizedName[normalizeCategoryName(finalCategory)]
				grouped[groupKey] = {
					categoryId: matchedCategory?.id || finalCategory,
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
					const categoryObj = byExactName[finalCategory] || byNormalizedName[normalizeCategoryName(finalCategory)]
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
				createdAt,
				originalIndex,
				fullText: paragraph, // Keep original for PDF
				source: source, // Include source information
				markInfo: paragraphMarkInfo
			})
		})
		
		return Object.values(grouped)
	}

	function getGroupedParagraphs() {
		return groupedParagraphs
	}

	function buildParagraphInfoIndex() {
		const index = {}
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

	function buildGroupedParagraphCaches() {
		const groupsByNormalizedCategory = {}
		const categoryParagraphsByNormalized = {}
		groupedParagraphs.forEach(group => {
			const normalizedCategory = normalizeCategoryName(group.category)
			groupsByNormalizedCategory[normalizedCategory] = group
			categoryParagraphsByNormalized[normalizedCategory] = Object.values(group.knowledgeAreas || {}).flat()
		})
		return { groupsByNormalizedCategory, categoryParagraphsByNormalized }
	}

	function getCategoryParagraphSequence(group) {
		if (!group?.knowledgeAreas) return []
		return Object.values(group.knowledgeAreas).flat()
	}

	function findCategoriesMissingParagraphs() {
		return getGroupedParagraphs()
			.filter(group => group.category && getCategoryParagraphSequence(group).length === 0)
			.map(group => group.category)
	}

	function resolveParagraphMainIndex(entry) {
		if (!entry) return -1
		if (entry.id !== undefined && entry.id !== null && entry.id !== '') {
			const byId = paragraphLookup.mainIndexById[entry.id]
			if (byId !== undefined) return byId
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

	function getSelectedTextInVisualOrder(options = {}) {
		const skipParagraphIds = options?.skipParagraphIds instanceof Set ? options.skipParagraphIds : null
		const hideHeaderMarks = Boolean(options?.hideHeaderMarks)
		const normalizeContentForPdf = (value) => {
			const raw = String(value || '')
			const tempDiv = document.createElement('div')
			tempDiv.innerHTML = raw
			let text = (tempDiv.textContent || tempDiv.innerText || '')
			// If literal tag text remains (e.g., <div>...</div>), strip common HTML tags as plain text.
			text = text
				.replace(/<\/?(div|p|span|br|strong|b|em|i|u|ul|ol|li|h[1-6])[^>]*>/gi, ' ')
				.replace(/\s*\n\s*/g, '\n')
				.replace(/\n{3,}/g, '\n\n')
				.replace(/[ \t]{2,}/g, ' ')
				.trim()
			return text
		}
		console.log('🔍 DEBUG getSelectedTextInVisualOrder:', {
			selectedParagraphs: Array.from(selectedParagraphs),
			selectedCount: selectedParagraphs.size,
			totalParagraphs: paragraphs.length
		})
		
		// Use the EXACT same order as the UI display (getGroupedParagraphs)
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
						if (skipParagraphIds && skipParagraphIds.has(paragraphObj.id)) {
							console.log(`    ⏭️ Skipping table-covered paragraph ${paraIndex}: ${paragraphObj.id}`)
							return
						}
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

						content = normalizeContentForPdf(content)
						if (!content) {
							console.log(`    ⏭️ Skipping empty normalized content for paragraph ${paragraphObj.id}`)
							return
						}
						
						// Add category header if this is the first time we see this category
						if (!processedCategories.has(categoryName)) {
							if (result.length > 0) {
								result.push('')
							}
							const categoryMarksValue = categoryMarks[categoryName] || 0
							const marksText = (!hideHeaderMarks && categoryMarksValue > 0) ? ` [${categoryMarksValue} MARKS]` : ''
							result.push(`${categoryName}:${marksText}`)
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
		
		const finalText = result.join('\n')
		console.log('🔍 getSelectedTextInVisualOrder result:', {
			length: finalText.length,
			text: finalText.substring(0, 200) + (finalText.length > 200 ? '...' : '')
		})

		return finalText
	}

	const HTML2CANVAS_RASTER_SCALE = 2

	// CSS-px (container-relative) top/bottom of every <tr> in a rendered PDF-export container,
	// used so the page-slicer below can avoid cutting a table row in half.
	function getRowBoundaryRectsPx(container) {
		const containerTop = container.getBoundingClientRect().top
		return Array.from(container.querySelectorAll('tr')).map(row => {
			const rect = row.getBoundingClientRect()
			return { top: rect.top - containerTop, bottom: rect.bottom - containerTop }
		})
	}

	// Slices a rasterized HTML canvas across PDF pages. When the natural cut point would land
	// inside a table row (per rowBoundariesPx), the slice is pulled back to end at that row's
	// top instead, pushing the whole row onto the next page rather than splitting it visually.
	function sliceCanvasIntoPdfPages(doc, canvas, { pageHeight, margin, startY, pxPerMm, targetWidthMm, xOffset, rowBoundariesPx = [], gapMm = 2 }) {
		const naturalWidthMm = canvas.width / pxPerMm
		const naturalHeightMm = canvas.height / pxPerMm
		const scale = targetWidthMm / naturalWidthMm
		const targetHeightMm = naturalHeightMm * scale
		const pxPerMmAtCanvasScale = pxPerMm / scale
		const rowBoundariesCanvasPx = rowBoundariesPx.map(r => ({
			top: r.top * HTML2CANVAS_RASTER_SCALE,
			bottom: r.bottom * HTML2CANVAS_RASTER_SCALE
		}))

		let nextY = startY
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
				continue
			}

			const isFreshPage = nextY <= margin + 0.01
			let drawMm = Math.min(availableMm, targetHeightMm - consumedMm)
			let slicePxTop = Math.round(consumedMm * pxPerMmAtCanvasScale)
			let slicePxHeight = Math.round(drawMm * pxPerMmAtCanvasScale)

			const isFinalSlice = consumedMm + drawMm >= targetHeightMm - 0.01
			if (!isFinalSlice && slicePxHeight > 0) {
				const sliceBottomPx = slicePxTop + slicePxHeight
				const splitRow = rowBoundariesCanvasPx.find(r => sliceBottomPx > r.top + 1 && sliceBottomPx < r.bottom - 1)
				if (splitRow) {
					const adjustedPxHeight = Math.round(splitRow.top) - slicePxTop
					if (adjustedPxHeight > 8) {
						slicePxHeight = adjustedPxHeight
						drawMm = slicePxHeight / pxPerMmAtCanvasScale
					} else if (!isFreshPage) {
						// Nothing useful fits before this row starts — start a fresh page instead of a sliver.
						doc.addPage()
						nextY = margin
						continue
					}
					// else: already at the top of a fresh page and the row still doesn't fit on one page —
					// fall through and let it split; there's no page big enough to avoid it.
				}
			}

			const sliceCanvas = document.createElement('canvas')
			sliceCanvas.width = canvas.width
			sliceCanvas.height = slicePxHeight
			const ctx = sliceCanvas.getContext('2d')
			ctx.drawImage(canvas, 0, -slicePxTop)

			const sliceData = sliceCanvas.toDataURL('image/png')
			doc.addImage(sliceData, 'PNG', xOffset, nextY, targetWidthMm, drawMm)

			nextY += drawMm + gapMm
			consumedMm += drawMm
		}

		return nextY
	}

	async function renderAssessmentHtmlToPdf(doc, startY, margin, pageWidth, matchedCategories = new Set()) {
		const normalizeParagraphCategory = (str) => (str || '')
		const htmlContent = normalizeHtmlQuotes(assessmentHtml || '').trim()
		if (!htmlContent) return startY

		const pageHeight = doc.internal.pageSize.getHeight()
		const highlightColor = '#ffe066' // slightly darker yellow highlight
		const pxPerMm = 96 / 25.4 // approximate CSS pixel density
		const maxContentWidthMm = pageWidth - (margin * 2)
		const maxContentWidthPx = maxContentWidthMm * pxPerMm
		const getParagraphCategoryKey = (para) => {
			const info = para?.id ? paragraphInfoIndex[para.id] : null
			if (info?.category) return normalizeParagraphCategory(info.category)
			const paraText = typeof para === 'string' ? para : para?.text || ''
			if (!paraText) return ''
			const prefix = paraText.split(':')[0]
			return normalizeParagraphCategory(prefix)
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
		container.style.color = '#000000'
		container.style.backgroundColor = '#ffffff'
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
		container.querySelectorAll('th, td').forEach(/** @type {HTMLElement} */ (cell) => {
			// @ts-ignore - cell is HTMLTableCellElement which has style
			cell.style.padding = ''
			// @ts-ignore
			cell.style.lineHeight = ''

			// Fix text color visibility - ensure text is visible on all backgrounds
			// @ts-ignore
			const bgColor = cell.style.backgroundColor || window.getComputedStyle(cell).backgroundColor
			// @ts-ignore
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
						// @ts-ignore
						cell.style.color = '#ffffff'
					} else {
						// @ts-ignore
						cell.style.color = '#000000'
					}
				}
			} else if (!currentColor || currentColor === 'white' || currentColor === '#ffffff') {
				// If no background but text is white, make it black
				// @ts-ignore
				cell.style.color = '#000000'
			}
		})

		// Normalize spacing inside pasted HTML so tables don't blow up the PDF.
		// Font size/padding are parameterized so a very tall table can be shrunk to fit
		// more rows per page (see the shrink-to-fit loop below) instead of leaving one
		// oversized row alone on a page.
		const buildAssessmentHtmlStyleText = (fontSizePt, cellPaddingPx) => `
			.pdf-assessment-html { width: 100%; box-sizing: border-box; font-size: ${fontSizePt}pt; color: #000 !important; background: #fff !important; }
			.pdf-assessment-html table { border-collapse: collapse; border-spacing: 0; width: 100%; table-layout: fixed; word-wrap: break-word; }
			.pdf-assessment-html th,
			.pdf-assessment-html td {
				padding: ${cellPaddingPx}px ${Math.max(4, Math.round(cellPaddingPx * 0.83))}px !important;
				line-height: 1.35 !important;
				vertical-align: top !important;
				word-break: break-word !important;
				overflow-wrap: anywhere !important;
				white-space: normal !important;
				hyphens: auto !important;
				box-sizing: border-box !important;
			}
			.pdf-assessment-html p { margin: 0; line-height: 1.4; font-size: inherit; color: #000 !important; }
			.pdf-assessment-html p + p { margin-top: 6px; }
			.pdf-assessment-html div,
			.pdf-assessment-html span,
			.pdf-assessment-html li,
			.pdf-assessment-html strong,
			.pdf-assessment-html b {
				color: #000 !important;
			}
			.pdf-assessment-html ul, .pdf-assessment-html ol { margin: 0 0 6px 18px; padding-left: 18px; }
			.pdf-assessment-html li { margin: 0; line-height: 1.3; }
			.pdf-assessment-html img { max-width: 100%; height: auto; }
			.pdf-assessment-html * { box-sizing: border-box; }
			.pdf-assessment-html table,
			.pdf-assessment-html th,
			.pdf-assessment-html td {
				border: 1px solid #222 !important;
			}
			.pdf-assessment-html p:not([style*="font-size"]) { font-size: ${fontSizePt}pt; }
			.pdf-assessment-html div:not([style*="font-size"]) { font-size: ${fontSizePt}pt; }
		`
		const ASSESSMENT_HTML_BASE_FONT_PT = 10
		const ASSESSMENT_HTML_BASE_PADDING_PX = 12
		const styleElement = document.createElement('style')
		styleElement.textContent = buildAssessmentHtmlStyleText(ASSESSMENT_HTML_BASE_FONT_PT, ASSESSMENT_HTML_BASE_PADDING_PX)
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
			const grouped = groupedParagraphs
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
			const getCategoryParagraphsInOrder = (catKey) => {
				return groupedParagraphCaches.categoryParagraphsByNormalized[catKey] || []
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

		container.querySelectorAll('[data-color]').forEach(/** @type {HTMLElement} */ (el) => {
			// @ts-ignore
			el.style.backgroundColor = highlightColor
			// @ts-ignore
			el.style.color = '#000'
		})

		document.body.appendChild(container)

		let nextY = startY
		try {
			// Shrink-to-fit: if any single row is tall enough that two of them couldn't share a
			// page, step the font size (and padding) down until rows are short enough to pack
			// multiple per page, rather than leaving one oversized row alone on a page.
			const maxDrawableHeightMm = pageHeight - (margin * 2)
			const maxRowShareOfPage = 0.48
			const minFontSizePt = 7
			for (let fontSizePt = ASSESSMENT_HTML_BASE_FONT_PT; fontSizePt >= minFontSizePt; fontSizePt--) {
				const rows = Array.from(container.querySelectorAll('tr'))
				if (!rows.length) break
				const tallestRowMm = Math.max(...rows.map(row => row.getBoundingClientRect().height)) / pxPerMm
				if (tallestRowMm <= maxDrawableHeightMm * maxRowShareOfPage) break
				if (fontSizePt === minFontSizePt) break
				const nextFontSizePt = fontSizePt - 1
				const nextPaddingPx = Math.max(4, Math.round(ASSESSMENT_HTML_BASE_PADDING_PX * (nextFontSizePt / ASSESSMENT_HTML_BASE_FONT_PT)))
				styleElement.textContent = buildAssessmentHtmlStyleText(nextFontSizePt, nextPaddingPx)
			}

			const rowBoundariesPx = getRowBoundaryRectsPx(container)
			const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: HTML2CANVAS_RASTER_SCALE, useCORS: true })
			nextY = sliceCanvasIntoPdfPages(doc, canvas, {
				pageHeight,
				margin,
				startY,
				pxPerMm,
				targetWidthMm: maxContentWidthMm,
				xOffset: margin,
				rowBoundariesPx,
				gapMm: 2
			})
		} catch (error) {
			console.error('Failed to render assessment HTML into PDF:', error)
		} finally {
			document.body.removeChild(container)
		}

		return nextY
	}

	async function renderSelectedFeedbackHtmlToPdf(doc, startY, margin, pageWidth, selectedHtmlText = '') {
		const htmlContent = normalizeHtmlQuotes(String(selectedHtmlText || '')).trim()
		if (!htmlContent) return startY

		const pageHeight = doc.internal.pageSize.getHeight()
		const pxPerMm = 96 / 25.4
		const maxContentWidthMm = pageWidth - (margin * 2)
		const maxContentWidthPx = maxContentWidthMm * pxPerMm

		const container = document.createElement('div')
		container.className = 'pdf-feedback-html'
		container.style.position = 'absolute'
		container.style.left = '-99999px'
		container.style.top = '0'
		container.style.display = 'block'
		container.style.boxSizing = 'border-box'
		container.style.width = `${maxContentWidthPx}px`
		container.style.maxWidth = `${maxContentWidthPx}px`
		container.style.fontFamily = 'Arial, sans-serif'
		container.style.fontSize = '10pt'
		container.style.lineHeight = '1.35'
		container.style.color = '#000000'
		container.style.backgroundColor = '#ffffff'
		container.style.padding = '0'
		container.innerHTML = htmlContent.replace(/\n/g, '<br/>')

		const styleElement = document.createElement('style')
		styleElement.textContent = `
			.pdf-feedback-html { width: 100%; box-sizing: border-box; font-size: 10pt; color: #000; background: #fff; }
			.pdf-feedback-html p { margin: 0; line-height: 1.35; }
			.pdf-feedback-html br { line-height: 1.35; }
		`
		container.prepend(styleElement)
		document.body.appendChild(container)

		let nextY = startY
		try {
			const rowBoundariesPx = getRowBoundaryRectsPx(container)
			const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: HTML2CANVAS_RASTER_SCALE, useCORS: true })
			nextY = sliceCanvasIntoPdfPages(doc, canvas, {
				pageHeight,
				margin,
				startY,
				pxPerMm,
				targetWidthMm: maxContentWidthMm,
				xOffset: margin,
				rowBoundariesPx,
				gapMm: 1.5
			})
		} catch (error) {
			console.error('Failed to render selected feedback HTML into PDF:', error)
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

			// Flag categories with no paragraphs added yet, so the user can see them highlighted before submitting
			const missingCategories = findCategoriesMissingParagraphs()
			missingParagraphCategories = new Set(missingCategories)
			if (missingCategories.length > 0) {
				showSuccessNotification(`⚠️ Cannot generate PDF - these categories have no paragraphs added: ${missingCategories.join(', ')}`)
				return
			}

		// Check for unentered text in quick-add textareas
		if (currentStudentId) {
			const hasUnenteredText = Object.values(quickAddText).some(text => text && text.trim() !== '')
			if (hasUnenteredText) {
				showSuccessNotification('⚠️ Cannot generate PDF - you have unentered text in the "Add paragraph" field. Please click "Add paragraph" button or clear the text first.')
				return
			}
		}

			let selectedText = getSelectedTextInVisualOrder()
			
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
		const needsLandscape = !lockPdfPortrait && shouldUseLandscapeForHtml(assessmentHtml, defaultMargin)
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
			: { h: /** @type {any} */ (doc.internal).getLineHeight?.() || 10 }
		const headingHeight = headingMetrics?.h || /** @type {any} */ (doc.internal).getLineHeight?.() || 10

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
		const hasMeaningfulRichFormatting = (textValue) => {
			const value = String(textValue || '')
			if (!value) return false
			if (/<(strong|b|em|i|u)\b/i.test(value)) return true
			if (/<(span|font)\b[^>]*style\s*=\s*["'][^"']*(color|font-weight|font-style|text-decoration)/i.test(value)) return true
			return false
		}
		const stripHtmlKeepLineBreaks = (textValue) => {
			const tempDiv = document.createElement('div')
			tempDiv.innerHTML = String(textValue || '').replace(/<br\s*\/?>/gi, '\n')
			return (tempDiv.textContent || tempDiv.innerText || '').replace(/\n{3,}/g, '\n\n')
		}
		const hasRichFormatting = hasMeaningfulRichFormatting(selectedText)
		if (!hasRichFormatting && /<[^>]+>/.test(selectedText)) {
			selectedText = stripHtmlKeepLineBreaks(selectedText)
		}
		const normalizeCategoryName = (name) => (name || '').toString().replace(/\u00a0/g, ' ').trim().toLowerCase()

		const categoriesWithMarks = new Set()
		const mappedCategories = new Set()
		const categoriesWithUncoveredSelections = new Set()
		const paragraphsToSkip = new Set()
		const coveredSelectedParagraphIds = new Set()
		const normalizeLine = (val) => (val || '').toString().replace(/\u00a0/g, ' ').trim()
		const toComparableParagraphBody = (value) => {
			let text = cleanParagraphTextForDisplay(String(value || ''))
			if (text.includes(': ')) {
				const parts = text.split(': ')
				if (parts.length >= 2) {
					text = parts.slice(1).join(': ')
				}
			}
			return normalizeLine(text)
		}
		const parseCategoryHeaderLine = (lineValue) => {
			const match = String(lineValue || '').trim().match(/^(.+?):(?:\s*\[(.+?)\])?\s*$/)
			if (!match) return null
			const category = (match[1] || '').trim()
			if (!category) return null
			const suffix = (match[2] || '').trim()
			return {
				category,
				display: suffix ? `${category}: [${suffix}]` : `${category}:`
			}
		}

		const getCategoryParagraphsInOrder = (normalizedCategory) => {
			return groupedParagraphCaches.categoryParagraphsByNormalized[normalizedCategory] || []
		}

		const coveredParagraphPositions = new Set()
		const activeTableColumnMap = currentAssessment?.tableColumnMarkMap || tableColumnMarkMap || {}
		Object.entries(activeTableColumnMap).forEach(([positionKey, columnValue]) => {
			const position = parseInt(positionKey, 10)
			const mappedColumn = parseInt(columnValue, 10)
			if (Number.isFinite(position) && position > 0 && Number.isFinite(mappedColumn) && mappedColumn > 0) {
				coveredParagraphPositions.add(position)
			}
		})

		const getParagraphPositionInCategory = (selectedId, selectedInfo, categoryParagraphs) => {
			let index = categoryParagraphs.findIndex(p => p.id === selectedId)
			if (index !== -1) return index + 1

			const selectedBody = toComparableParagraphBody(selectedInfo?.fullText || selectedInfo?.text || '')
			if (!selectedBody) return -1

			index = categoryParagraphs.findIndex(p => toComparableParagraphBody(p.fullText || p.text || '') === selectedBody)
			if (index !== -1) return index + 1

			return -1
		}

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

		// Skip only paragraphs whose positions are represented by the table mapping
		selectedParagraphs.forEach(id => {
			const info = paragraphInfoIndex[id]
			const para = info || paragraphs.find(p => p.id === id)
			if (!para) return
			const text = typeof para === 'string' ? para : para.text || ''
			const categoryText = info?.category || (text.includes(': ') ? text.split(': ')[0] : '')
			const normalized = normalizeCategoryName(categoryText)
			const categoryCovered = matchedCategoriesFromTable.has(normalized) || mappedCategories.has(normalized) || categoriesWithMarks.has(normalized)
			if (!categoryCovered) {
				categoriesWithUncoveredSelections.add(normalized)
				return
			}

			const categoryParagraphs = getCategoryParagraphsInOrder(normalized)
			const paragraphPosition = getParagraphPositionInCategory(id, info || para, categoryParagraphs)
			const isCoveredByTablePosition = coveredParagraphPositions.size > 0
				? (paragraphPosition > 0 ? coveredParagraphPositions.has(paragraphPosition) : true)
				: false

			if (isCoveredByTablePosition) {
				coveredSelectedParagraphIds.add(id)
				const normalizedText = normalizeLine(cleanParagraphTextForDisplay(info?.fullText || text))
				const normalizedRaw = normalizeLine(text)
				const normalizedBodyFromFull = toComparableParagraphBody(info?.fullText || text)
				const normalizedBodyFromRaw = toComparableParagraphBody(text)
				if (normalizedText.length > 0) paragraphsToSkip.add(normalizedText)
				if (normalizedRaw.length > 0) paragraphsToSkip.add(normalizedRaw)
				if (normalizedBodyFromFull.length > 0) paragraphsToSkip.add(normalizedBodyFromFull)
				if (normalizedBodyFromRaw.length > 0) paragraphsToSkip.add(normalizedBodyFromRaw)
			} else {
				categoriesWithUncoveredSelections.add(normalized)
			}
		})

		if (hasAssessmentHtml) {
			selectedText = getSelectedTextInVisualOrder({
				skipParagraphIds: coveredSelectedParagraphIds,
				hideHeaderMarks: true
			})
		}

		const isCategoryCoveredByTable = (normalizedCategory) => {
			if (!hasAssessmentHtml) return false
			// Table match/mapping or entered marks/paragraph marks treat it as covered
			if (matchedCategoriesFromTable.has(normalizedCategory) || mappedCategories.has(normalizedCategory)) return true
			if (categoriesWithMarks.has(normalizedCategory)) return true
			return false
		}

		if (hasRichFormatting) {
			yPosition = await renderSelectedFeedbackHtmlToPdf(doc, yPosition, margin, contentPageWidth, selectedText)
		} else {
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

		const hasRenderableCategoryContent = (headerIndex) => {
			for (let j = headerIndex + 1; j < textLines.length; j += 1) {
				const lookaheadLine = textLines[j]
				const lookaheadTrimmed = lookaheadLine.trim()
				if (!lookaheadTrimmed) continue
				if (parseCategoryHeaderLine(lookaheadTrimmed)) break
				if (paragraphsToSkip.has(normalizeLine(lookaheadLine))) continue
				return true
			}
			return false
		}
		
		const blankLineGap = () => lineHeight * 1
		const headerGap = () => lineHeight * 1
		const paragraphGap = () => Math.max(1.5, lineHeight * 0.3)
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
			
			const trimmedLine = line.trim()
			const headerInfo = parseCategoryHeaderLine(trimmedLine)

			if (headerInfo) {
				const categoryName = headerInfo.category
				currentCategory = normalizeCategoryName(categoryName)
				const categoryCoveredByTable = isCategoryCoveredByTable(currentCategory)

				const shouldSkip = (categoryCoveredByTable && !categoriesWithUncoveredSelections.has(currentCategory)) || !hasRenderableCategoryContent(i)
				if (shouldSkip) {
					skipCurrentCategory = true
					continue
				}
				skipCurrentCategory = false

				// Bold font for ALL category headers (any line ending with ':')
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(currentBodyFontSize) // Same size as other content

				const headerText = categoryCoveredByTable ? `${categoryName}:` : headerInfo.display
				doc.text(headerText, margin, yPosition)

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
			initializeAiModelSettings()
			const cleanupAppLogging = installAppLogging()

		window.addEventListener('paste', handleStudentPhotoPaste)
		window.addEventListener('pointerdown', handleGlobalPointerDown)
		window.addEventListener('keydown', handleGlobalKeyDown)
			return () => {
				stopSpeechRecorder()
				cleanupAppLogging()
				window.removeEventListener('paste', handleStudentPhotoPaste)
				window.removeEventListener('pointerdown', handleGlobalPointerDown)
				window.removeEventListener('keydown', handleGlobalKeyDown)
			}
		})
</script>

<!-- Header -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary" style="--bs-navbar-padding-y: 0.35rem;">
	<div class="container-fluid">
		<a class="navbar-brand d-inline-flex align-items-center gap-2 lh-1" href="/" style="font-size: 0.95rem;">
			<span>Feedback Manager v3.3.4</span>
			<span class="small text-white-50 lh-1">({__BUILD_TIME__})</span>
		</a>
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
				<li class="nav-item position-relative" bind:this={aiModelSettingsContainer}>
					<button
						class="btn btn-outline-light btn-sm ms-2"
						onclick={toggleAiModelSettings}
						title={`AI model settings: ${getCurrentAiProviderLabel()} · ${getAiModelLabel(selectedAiModel)} / ${getReasoningEffortLabel(selectedAiReasoningEffort)}`}
						aria-label="Open AI model settings"
						aria-expanded={showAiModelSettings}
						aria-haspopup="true"
					>
						<i class="bi bi-sliders me-1"></i>Settings
					</button>
					{#if showAiModelSettings}
						<div class="ai-settings-menu dropdown-menu dropdown-menu-end show shadow">
							<div class="ai-settings-section">
								<div class="ai-settings-heading">Provider</div>
								<div class="ai-settings-list compact">
									{#each AI_PROVIDER_OPTIONS as option (option.value)}
										<button
											type="button"
											class:selected={selectedAiProvider === option.value}
											class="ai-settings-option"
											onclick={() => selectAiProvider(option.value)}
										>
											<span>{option.label}</span>
											{#if !isProviderConfigured(option.value)}
												<i class="bi bi-exclamation-triangle text-warning" title="API key not configured"></i>
											{:else if selectedAiProvider === option.value}
												<i class="bi bi-check-lg"></i>
											{/if}
										</button>
									{/each}
								</div>
							</div>
							<div class="ai-settings-divider"></div>
							<div class="ai-settings-section">
								<div class="ai-settings-heading">API Keys</div>
								{#each AI_PROVIDER_OPTIONS as option (option.value)}
									<div class="ai-settings-manual mt-2">
										<label class="form-label small mb-1" for="apiKeyInput-{option.value}">
											{option.label} key
											{#if isProviderConfigured(option.value)}
												<i class="bi bi-check-circle-fill text-success ms-1" title="Configured"></i>
											{/if}
										</label>
										<div class="ai-settings-manual-row">
											<input
												id="apiKeyInput-{option.value}"
												type="password"
												autocomplete="off"
												class="form-control form-control-sm ai-settings-input"
												value={apiKeyDrafts[option.value] || ''}
												oninput={(e) => { apiKeyDrafts = { ...apiKeyDrafts, [option.value]: e.currentTarget.value } }}
												placeholder={getLlmProvider(option.value).envApiKey ? 'Using key from .env' : 'sk-...'}
												onkeydown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault()
														saveApiKey(option.value)
													}
												}}
											>
											<button
												type="button"
												class="btn btn-sm btn-outline-primary ai-settings-apply"
												onclick={() => saveApiKey(option.value)}
											>
												Save
											</button>
											{#if apiKeyDrafts[option.value]}
												<button
													type="button"
													class="btn btn-sm btn-outline-secondary ai-settings-apply"
													onclick={() => clearApiKey(option.value)}
													title="Clear stored key"
													aria-label={`Clear stored ${option.label} API key`}
												>
													<i class="bi bi-x-lg"></i>
												</button>
											{/if}
										</div>
									</div>
								{/each}
							</div>
							<div class="ai-settings-divider"></div>
							<div class="ai-settings-section">
								<div class="ai-settings-heading">Select model</div>
								<div class="ai-settings-list">
									{#each getModelsForProvider(selectedAiProvider) as option (option.value)}
										<button
											type="button"
											class:selected={selectedAiModel === option.value}
											class="ai-settings-option"
											onclick={() => selectAiModel(option.value)}
										>
											<span>{option.label}</span>
											{#if selectedAiModel === option.value}
												<i class="bi bi-check-lg"></i>
											{/if}
										</button>
									{/each}
								</div>
								<div class="ai-settings-manual mt-2">
									<label class="form-label small mb-1" for="manualAiModelInput">Manual model ({getCurrentAiProviderLabel()})</label>
									<div class="ai-settings-manual-row">
										<input
											id="manualAiModelInput"
											type="text"
											class="form-control form-control-sm ai-settings-input"
											bind:value={manualAiModelInput}
											placeholder="e.g. gpt-5.4-custom"
											onkeydown={(event) => {
												if (event.key === 'Enter') {
													event.preventDefault()
													applyManualAiModel()
												}
											}}
										>
										<button
											type="button"
											class="btn btn-sm btn-outline-primary ai-settings-apply"
											onclick={applyManualAiModel}
										>
											Use
										</button>
									</div>
								</div>
							</div>
							<div class="ai-settings-divider"></div>
							<div class="ai-settings-section">
								<div class="ai-settings-heading">Thinking level</div>
								<div class="text-muted small mb-2">Controls reasoning depth when the selected model supports it.</div>
								<div class="ai-settings-list compact">
									{#each getSupportedReasoningOptionObjects() as option (option.value)}
										<button
											type="button"
											class:selected={selectedAiReasoningEffort === option.value}
											class="ai-settings-option"
											onclick={() => selectAiReasoningEffort(option.value)}
										>
											<span>{option.label}</span>
											{#if selectedAiReasoningEffort === option.value}
												<i class="bi bi-check-lg"></i>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}
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
						onclick={() => showAppLogModal = true}
						title={`Open application log (${appLogEntries.length}/${MAX_APP_LOG_ENTRIES})`}
						aria-label="Open application log"
					>
						<i class="bi bi-journal-text me-1"></i>Log
					</button>
				</li>
				<li class="nav-item">
					<button
						class="btn btn-outline-light btn-sm ms-2"
						onclick={openLastAiPromptModal}
						title={promptPreviewMessages.length > 0 ? `View last AI prompt: ${promptPreviewTitle}` : 'No AI prompt sent yet'}
						aria-label="View last AI prompt"
						disabled={promptPreviewMessages.length === 0}
					>
						<i class="bi bi-chat-left-text me-1"></i>Last Prompt
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
								onSelectSubject={selectSubject}
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
									<p class="lead text-body-secondary mb-0">PDF setup, RAG prompts, and Reports Check workflow</p>
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
									<strong>Quick Steps (PDF + Rubric Table)</strong>
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
									<strong>Reports Check Workflow</strong>
								</div>
								<div class="card-body">
									<ol class="mb-0">
										<li class="mb-2">Select a student first. Reports Check only runs with a selected student.</li>
										<li class="mb-2">Add student evidence via <strong>Student Submission or Evidence Notes</strong> and <strong>Student Uploads</strong>.</li>
										<li class="mb-2">In each category, write a short draft and optional <strong>Instructions for this answer</strong>.</li>
										<li class="mb-2">Click <strong>Reports Check</strong> to generate an evidence-based paragraph using student notes, uploaded docs, rubric context, and retrieved references.</li>
										<li class="mb-2">Review output in the quick-add box, edit if needed, then click <strong>Add paragraph</strong>.</li>
										<li>Use <strong>View RAG Prompt</strong> to inspect the exact prompt (System + User + Retrieved context).</li>
									</ol>
								</div>
							</div>

							<div class="card border-dark mb-3">
								<div class="card-header bg-dark text-white">
									<strong>Useful HTML Snippet</strong>
								</div>
								<div class="card-body">
									<p class="mb-2">Use this snippet when you need quick horizontal spacing in your pasted table HTML:</p>
									<code class="d-block border rounded p-2 bg-body-tertiary user-select-all">{TABLE_HTML_SPACER_SNIPPET}</code>
									<p class="mb-2 mt-3">Use these inside table cells for pass/fail markers:</p>
									<code class="d-block border rounded p-2 bg-body-tertiary user-select-all mb-2">{TABLE_HTML_TICK_SNIPPET}</code>
									<code class="d-block border rounded p-2 bg-body-tertiary user-select-all">{TABLE_HTML_CROSS_SNIPPET}</code>
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

							<div class="card border-success mb-3">
								<div class="card-header bg-success text-white">
									<strong>RAG Prompt and Category Filtering</strong>
								</div>
								<div class="card-body">
									<ul class="mb-0">
										<li class="mb-2"><strong>How the prompt is built:</strong> global instructions go to System message 1, per-answer instructions go to System message 2, then the User message includes short draft, student submission, evidence notes, and retrieved context.</li>
										<li class="mb-2"><strong>Category-first retrieval:</strong> RAG now prioritises chunks that match the selected category (for example, <code>Sub Objective 1.2</code>) and only falls back to broader context if no category match is found.</li>
										<li class="mb-2"><strong>Best practice:</strong> use the exact rubric category name in categories, paragraph headers, and per-answer instructions to improve match quality.</li>
										<li><strong>Prior student evaluations:</strong> previous saved feedback/marks from other students in the same assessment can be used as reference context, not as direct evidence for the current student.</li>
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
										<li class="mb-2">Reports Check unavailable: select a student and ensure student evidence text or uploaded files exist.</li>
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
										<div class="d-flex align-items-center gap-3">
											<label class="form-check mb-0 d-flex align-items-center gap-2">
												<input
													type="checkbox"
													class="form-check-input"
													checked={lockPdfPortrait}
													onchange={(e) => setLockPdfPortrait(e.currentTarget.checked)}
												>
												<span class="small fw-semibold">Lock Portrait</span>
											</label>
											<button
												class="btn btn-sm btn-light"
												onclick={() => showAssessmentHtml = !showAssessmentHtml}
												aria-label={showAssessmentHtml ? 'Hide HTML input' : 'Show HTML input'}
											>
												{showAssessmentHtml ? 'Hide' : 'Show'}
											</button>
										</div>
									</div>
									</div>
									{#if showAssessmentHtml}
										<div class="card-body py-2">
									<label class="form-label fw-bold" for="assessmentHtmlInput">Paste HTML snippet (e.g., rubric table):</label>
									<p class="text-muted mb-2 small">If you want a table-based result in the PDF, paste your HTML table below, then click Generate PDF.</p>
									<div class="alert alert-secondary py-2">
										<div class="d-flex flex-column gap-2">
											<div class="d-flex flex-column flex-md-row align-items-start gap-2">
												<div class="flex-grow-1">
													<div class="small fw-semibold">Useful spacer snippet</div>
													<code class="d-block small user-select-all">{TABLE_HTML_SPACER_SNIPPET}</code>
												</div>
												<button type="button" class="btn btn-outline-secondary btn-sm" onclick={insertTableHtmlSpacerSnippet}>
													<i class="bi bi-plus-square me-1"></i>Insert spacer
												</button>
											</div>
											<div class="d-flex flex-column flex-md-row align-items-start gap-2">
												<div class="flex-grow-1">
													<div class="small fw-semibold">Tick cell snippet</div>
													<code class="d-block small user-select-all">{TABLE_HTML_TICK_SNIPPET}</code>
												</div>
												<button type="button" class="btn btn-outline-secondary btn-sm" onclick={insertTableHtmlTickSnippet}>
													<i class="bi bi-plus-square me-1"></i>Insert tick
												</button>
											</div>
											<div class="d-flex flex-column flex-md-row align-items-start gap-2">
												<div class="flex-grow-1">
													<div class="small fw-semibold">Cross cell snippet</div>
													<code class="d-block small user-select-all">{TABLE_HTML_CROSS_SNIPPET}</code>
												</div>
												<button type="button" class="btn btn-outline-secondary btn-sm" onclick={insertTableHtmlCrossSnippet}>
													<i class="bi bi-plus-square me-1"></i>Insert cross
												</button>
											</div>
										</div>
									</div>
									<textarea
										id="assessmentHtmlInput"
										class="form-control"
												rows="6"
												bind:value={assessmentHtml}
												oninput={(e) => {
													assessmentHtml = /** @type {HTMLInputElement} */ (e.target).value
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
																{#each ASSESSMENT_DOCUMENT_TYPES as option (option.value)}
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
															{#each assessmentReferenceDocuments as document (document.id)}
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
														{#each getCategoryMarkRanges(selectedCategoryAllocatedMarks, currentAssessment.percentageRanges) as markRange (markRange.range)}
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
													{#each (currentAssessment?.knowledgeAreas || []) as area (area)}
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
													{#each (currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999))) as category (category.id)}
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
												placeholder="Comment here..."
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
													{#each (currentAssessment?.knowledgeAreas || []) as area (area)}
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
													{#each (currentAssessment.categories.slice().sort((a, b) => (a.order || 999) - (b.order || 999))) as category, index (category.id)}
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
															<span class="student-picker-label">{currentStudentId ? getStudentFullNameLabel(getCurrentStudent()) : 'Select a student...'}</span>
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
																	{#each getFilteredStudents() as student (student.id)}
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
																	<span class="student-picker-option-label">{getStudentFullNameLabel(student)}</span>
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
																	<strong>Selected Student:</strong> {currentStudentId ? getStudentFirstNameLabel(getCurrentStudent()) : 'Loading...'}
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
													<div class="small text-muted mb-2">Upload answer/report or extra evidence files. These are saved under the selected student.</div>
													<div class="row g-2 align-items-end">
														<div class="col-md-4">
															<label for="studentDocumentType" class="form-label fw-bold small">File Type</label>
													<select id="studentDocumentType" class="form-select form-select-sm" bind:value={selectedStudentDocumentType} disabled={!currentStudentId || uploadingStudentDocument}>
																{#each STUDENT_DOCUMENT_TYPES as option (option.value)}
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
															{#each studentSubmissionDocuments as document (document.id)}
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
								{#if currentAssessment}
									<div class="px-3 pt-3">
										<button
											type="button"
											class="btn btn-link btn-sm p-0 text-decoration-none fw-bold"
											onclick={() => showCommonPromptBox = !showCommonPromptBox}
											aria-expanded={showCommonPromptBox}
											aria-controls="commonParagraphPromptPanel"
										>
											<i class={`bi ${showCommonPromptBox ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
											Common AI Prompt (all paragraphs){#if currentAssessment.commonParagraphAiInstructions?.trim()}<span class="badge text-bg-info ms-2">Set</span>{/if}
										</button>
										{#if showCommonPromptBox}
											<div id="commonParagraphPromptPanel" class="mt-2">
												<textarea
													id="commonParagraphPromptInput"
													class="form-control form-control-sm"
													rows="2"
													placeholder="e.g. Always reference the rubric wording and avoid absolute claims."
													value={currentAssessment.commonParagraphAiInstructions || ''}
													oninput={(e) => { currentAssessment.commonParagraphAiInstructions = e.currentTarget.value }}
													onchange={persistAssessmentAiSettings}
												></textarea>
												<div class="form-text">Added to every paragraph's AI prompt in this assessment, unless a paragraph opts out below.</div>
											</div>
										{/if}
									</div>
								{/if}
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
											<div class="card mb-3 border-start border-4 {missingParagraphCategories.has(group.category) ? 'border-danger' : 'border-info'}">
													<div class="card-header bg-info text-white py-2">
														<div class="d-flex align-items-center w-100">
															<div class="flex-grow-1">
																<h6 class="mb-0 fw-bold">
																	{#if group.category && group.category !== 'No Knowledge Area'}
																		{group.category}
																		{#if missingParagraphCategories.has(group.category)}
																			<i class="bi bi-exclamation-circle-fill text-danger ms-1" title="No paragraphs added yet"></i>
																		{/if}
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
												{@const categoryIndex = sortedCategories.findIndex(cat => cat.id === group.categoryId || normalizeCategoryName(cat.name) === normalizeCategoryName(group.category))}
												<div class="d-flex flex-column">
													<button 
														class="btn btn-sm btn-outline-light" 
														style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
														onclick={() => moveCategoryUp(group.categoryId || group.category)}
														title="Move category up"
														aria-label="Move category up"
														disabled={categoryIndex <= 0}
													>
														<i class="bi bi-chevron-up"></i>
													</button>
													<button 
														class="btn btn-sm btn-outline-light" 
														style="font-size: 0.6rem; padding: 0.1rem 0.2rem; min-width: 20px;"
														onclick={() => moveCategoryDown(group.categoryId || group.category)}
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
											{#each Object.entries(group.knowledgeAreas) as [knowledgeArea, paragraphs] (knowledgeArea)}
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
															{#each paragraphs as {text, color, id, createdAt, originalIndex, fullText, source, markInfo}, displayIndex (id)}
												{@const categorySequenceIndex = findParagraphSequenceIndex(categoryParagraphSequence, id, originalIndex)}
										<div 
											class="paragraph-item border-bottom p-3 {originalIndex === paragraphs[paragraphs.length - 1].originalIndex ? '' : 'border-bottom'}"
											class:selected-paragraph={selectedParagraphs.has(id)}
											class:editing-save-warning={showEditingParagraphSaveWarning && editingParagraphIndex === originalIndex}
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
																					placeholder="Comment here..."
																				/>
																			{:else}
																				<div class="d-flex align-items-start">
																	<div class="flex-grow-1">
																		<div class="mb-0 fs-6 lh-base" style="white-space: pre-wrap;">{@html text}</div>
																		{#if formatParagraphSavedDate(createdAt)}
																			<div class="small text-body-secondary mt-1">Saved: {formatParagraphSavedDate(createdAt)}</div>
																		{/if}
																	</div>
															<div class="ms-2">
																{#if resolveParagraphOwner(source, id) === 'assignment'}
																	<span class="badge bg-primary" title="Assignment paragraph">
																		<i class="bi bi-file-text me-1"></i>{getParagraphOwnerLabel(source, id)}
																	</span>
																{:else}
																	<span class="badge bg-success" title="Student paragraph">
																		<i class="bi bi-person me-1"></i>{getParagraphOwnerLabel(source, id)}
																	</span>
																{/if}
															</div>
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
																onclick={() => sendParagraphToAiInput(text, group.category, knowledgeArea, id)}
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
																	{#each (currentAssessment?.knowledgeAreas || []) as area (area)}
																		<option value={area}>{area}</option>
																	{/each}
																</select>
															{/if}
														</div>
													<div class="d-flex flex-column gap-2 w-100">
														<div class="d-flex flex-wrap gap-2 align-items-start quick-action-toolbar">
															<button
																class="btn btn-outline-secondary btn-sm quick-toolbar-btn"
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
																	class="btn btn-outline-secondary btn-sm quick-toolbar-btn"
																type="button"
																onclick={() => applyColorToQuickAdd(group.category, quickAddColorPicker[group.category])}
																title="Apply selected colour to selected text"
															>
																<i class="bi bi-palette me-1"></i>Colour
															</button>
																<button
																	class={`btn btn-sm quick-toolbar-btn ${speechRecordingCategory === group.category ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
																type="button"
																onclick={() => toggleQuickAddSpeechToText(group.category)}
																disabled={Boolean(speechRecordingCategory && speechRecordingCategory !== group.category) || Boolean(speechTranscribingByCategory[group.category])}
																title={speechRecordingCategory === group.category ? 'Stop recording' : 'Record voice and convert to text'}
															>
																{#if speechTranscribingByCategory[group.category]}
																	<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
																	Transcribing...
																{:else if speechRecordingCategory === group.category}
																	<i class="bi bi-stop-fill me-1 text-danger"></i>Stop Mic
																{:else}
																	<i class={`bi bi-mic-fill me-1 ${speechRecordingCategory === group.category ? 'text-danger' : ''}`}></i>Mic
																{/if}
															</button>
														</div>
															<button
																class="btn btn-outline-primary btn-sm quick-toolbar-btn"
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
																class="btn btn-outline-info btn-sm quick-toolbar-btn"
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
																class="btn btn-outline-warning btn-sm quick-toolbar-btn"
																type="button"
																onclick={() => runEvidenceCheck(group.category)}
																disabled={improvingText[group.category] || improvingTextWithRag[group.category] || evidenceCheckingText[group.category] || !currentStudentId}
																title="Generate reports-check output from student notes and uploads"
															>
																{#if evidenceCheckingText[group.category]}
																	<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
																	Checking reports...
																{:else}
																	<i class="bi bi-clipboard2-check me-1"></i>Reports Check
																{/if}
															</button>
													<button
														class={`btn btn-sm quick-toolbar-btn ${isDarkMode ? 'btn-outline-light' : 'btn-outline-dark'}`}
										type="button"
										onclick={() => viewFinalPrompt(group.category, 'ai')}
										disabled={!quickAddText[group.category]?.trim()}
										title="View final prompt for Improve with AI"
									>
										<i class="bi bi-eye me-1"></i>View Improve Prompt
									</button>
															<button
																class={`btn btn-sm quick-toolbar-btn ${isDarkMode ? 'btn-outline-light' : 'btn-outline-dark'}`}
																type="button"
																onclick={() => viewFinalPrompt(group.category, 'rag')}
																disabled={!quickAddText[group.category]?.trim()}
																title="View final prompt for Improve with RAG"
															>
																<i class="bi bi-eye-fill me-1"></i>View RAG Prompt
															</button>
															<button
																class="btn btn-outline-secondary btn-sm quick-toolbar-btn"
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
														rows="8"
																placeholder="Comment here..."
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
															<div class="d-flex align-items-center gap-2">
																<button
																	type="button"
																	class="btn btn-outline-success btn-sm"
																	onclick={async () => {
																		await persistCategoryAiInstruction(group.category)
																		await saveAssessmentData({ force: true, skipSelections: true })
																		showSuccessNotification('✅ Instructions saved to assignment.')
																	}}
																	title="Save instructions to assignment"
																>
																	<i class="bi bi-save me-1"></i>Save
																</button>
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
																	<div class="form-check form-switch mt-2">
																		<input
																			class="form-check-input"
																			type="checkbox"
																			id={`includeCommonPrompt-${group.category}`}
																			checked={isCommonPromptIncluded(group.category)}
																			onchange={(e) => persistCategoryIncludeCommonPrompt(group.category, e.currentTarget.checked)}
																		>
																		<label class="form-check-label small" for={`includeCommonPrompt-${group.category}`}>
																			Apply the assessment's common AI prompt to this paragraph
																		</label>
																	</div>
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
								{#each checkboxDebugInfo as message (message)}
									<div class="mb-1">{message}</div>
								{/each}
							{/if}
						</div>
						<div class="mt-3">
							<h6>Current Paragraph IDs:</h6>
							<div style="max-height: 100px; overflow-y: auto; background-color: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.8em;">
								{#each paragraphs as para, index (para.id)}
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

	:global(.quick-action-toolbar .quick-toolbar-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		white-space: nowrap;
		line-height: 1.2;
		font-weight: 600;
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .quick-toolbar-btn .bi),
	:global(.quick-action-toolbar .quick-toolbar-btn .spinner-border) {
		flex-shrink: 0;
	}

	:global(.quick-action-toolbar .btn-outline-secondary.quick-toolbar-btn) {
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .btn-outline-info.quick-toolbar-btn) {
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .btn-outline-primary.quick-toolbar-btn) {
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .btn-outline-warning.quick-toolbar-btn) {
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .btn-outline-light.quick-toolbar-btn),
	:global(.quick-action-toolbar .btn-outline-dark.quick-toolbar-btn) {
		color: #0b5ed7 !important;
		border-color: #0b5ed7 !important;
	}

	:global(.quick-action-toolbar .quick-toolbar-btn:disabled) {
		opacity: 0.72;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-secondary.quick-toolbar-btn) {
		color: #93c5fd !important;
		border-color: #60a5fa !important;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-info.quick-toolbar-btn) {
		color: #93c5fd !important;
		border-color: #60a5fa !important;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-primary.quick-toolbar-btn) {
		color: #93c5fd !important;
		border-color: #60a5fa !important;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-warning.quick-toolbar-btn) {
		color: #93c5fd !important;
		border-color: #60a5fa !important;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-light.quick-toolbar-btn),
	:global([data-bs-theme="dark"] .quick-action-toolbar .btn-outline-dark.quick-toolbar-btn) {
		color: #93c5fd !important;
		border-color: #60a5fa !important;
	}

	:global([data-bs-theme="dark"] .quick-action-toolbar .quick-toolbar-btn:disabled) {
		color: #9ca3af !important;
		border-color: #6b7280 !important;
		opacity: 0.85;
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

	.ai-settings-menu {
		width: min(320px, calc(100vw - 2rem));
		max-height: min(78vh, calc(100dvh - 5.5rem));
		margin-top: 0.5rem;
		padding: 0.85rem;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		border-radius: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(22, 22, 22, 0.96);
		color: #f5f5f5;
		backdrop-filter: blur(10px);
		z-index: 1200;
	}

	.ai-settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ai-settings-heading {
		font-size: 0.95rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
	}

	.ai-settings-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.ai-settings-list.compact {
		gap: 0.35rem;
	}

	.ai-settings-manual {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.ai-settings-manual-row {
		display: flex;
		gap: 0.5rem;
		min-width: 0;
	}

	.ai-settings-input {
		min-width: 0;
		flex: 1 1 auto;
	}

	.ai-settings-apply {
		flex-shrink: 0;
	}

	.ai-settings-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 0;
		border-radius: 0.75rem;
		background: transparent;
		color: inherit;
		text-align: left;
		font-size: 0.95rem;
	}

	.ai-settings-option:hover,
	.ai-settings-option.selected {
		background: rgba(255, 255, 255, 0.1);
	}

	.ai-settings-option.selected {
		font-weight: 600;
	}

	.ai-settings-divider {
		height: 1px;
		margin: 0.85rem 0;
		background: rgba(255, 255, 255, 0.12);
	}

	.paragraph-item {
		transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
	}

	.paragraph-item.editing-save-warning {
		background: #ffe5e5;
		box-shadow: inset 4px 0 0 #f08c8c;
	}

	:global([data-bs-theme="light"]) .ai-settings-menu {
		border-color: rgba(15, 23, 42, 0.12);
		background: rgba(255, 255, 255, 0.97);
		color: #111827;
	}

	:global([data-bs-theme="light"]) .ai-settings-heading {
		color: rgba(17, 24, 39, 0.64);
	}

	:global([data-bs-theme="light"]) .ai-settings-option:hover,
	:global([data-bs-theme="light"]) .ai-settings-option.selected {
		background: rgba(15, 23, 42, 0.08);
	}

	:global([data-bs-theme="light"]) .ai-settings-divider {
		background: rgba(15, 23, 42, 0.1);
	}

	:global([data-bs-theme="dark"]) .paragraph-item.editing-save-warning {
		background: rgba(127, 29, 29, 0.35);
		box-shadow: inset 4px 0 0 #fca5a5;
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
							{#each aiDraftReviewItems as item, index (index)}
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

<input
	type="file"
	accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg"
	class="d-none"
	bind:this={speechUploadInput}
	onchange={handleSpeechAudioUpload}
>

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
					{#if promptPreviewRequestPayload}
						<div class="border rounded p-3 bg-light mb-3">
							<div class="fw-bold text-uppercase small mb-2">Request Payload</div>
							<pre class="mb-0 prompt-preview-pre">{JSON.stringify(promptPreviewRequestPayload, null, 2)}</pre>
						</div>
					{/if}
					<div class="d-flex flex-column gap-3">
						{#each promptPreviewMessages as message, index (index)}
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

<!-- Application Log Modal -->
{#if showAppLogModal}
	<div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
		<div class="modal-dialog modal-xl modal-dialog-scrollable">
			<div class="modal-content">
				<div class="modal-header bg-secondary text-white">
					<h5 class="modal-title">
						<i class="bi bi-journal-text me-2"></i>Application Log
					</h5>
					<button type="button" class="btn-close btn-close-white" onclick={() => showAppLogModal = false} aria-label="Close application log"></button>
				</div>
				<div class="modal-body">
					<div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 mb-3">
						<div class="small text-muted">
							Showing the most recent {appLogEntries.length} of {MAX_APP_LOG_ENTRIES} log entries.
						</div>
						<div class="d-flex flex-wrap gap-2">
							<button type="button" class="btn btn-outline-secondary btn-sm" onclick={copyAppLogs}>
								<i class="bi bi-clipboard me-1"></i>Copy
							</button>
							<button type="button" class="btn btn-outline-danger btn-sm" onclick={clearAppLogs}>
								<i class="bi bi-trash me-1"></i>Clear
							</button>
						</div>
					</div>
					{#if appLogEntries.length === 0}
						<div class="alert alert-light mb-0">No log entries yet.</div>
					{:else}
						<div class="list-group">
							{#each [...appLogEntries.slice(-MAX_APP_LOG_ENTRIES)].reverse() as entry (entry.id)}
								<div class="list-group-item">
									<div class="d-flex flex-column flex-lg-row justify-content-between gap-1">
										<div>
											<span class={`badge text-uppercase ${entry.level === 'error' ? 'bg-danger' : entry.level === 'warn' ? 'bg-warning text-dark' : entry.level === 'debug' ? 'bg-dark' : 'bg-secondary'}`}>
												{entry.level}
											</span>
										</div>
										<div class="small text-muted">{entry.timestamp}</div>
									</div>
									<pre class="mb-0 mt-2 prompt-preview-pre">{entry.message}</pre>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={() => showAppLogModal = false}>Close</button>
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
							{#each sortedStudents as student (student.id)}
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
