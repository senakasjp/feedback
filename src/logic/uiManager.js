// UI management functions extracted from App.svelte
import { invoke } from '@tauri-apps/api/core'
import jsPDF from 'jspdf'
import { generateId, extractMainTextFromParagraph, reconstructParagraphText, extractKnowledgeArea, cleanParagraphTextForDisplay } from '../utils/helpers.js'

// View management
export function updateView(newView) {
  return newView
}

// Dark mode management
export function initializeDarkMode() {
  const savedDarkMode = localStorage.getItem('darkMode')
  if (savedDarkMode !== null) {
    return savedDarkMode === 'true'
  } else {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
}

export function toggleDarkMode() {
  const currentMode = document.documentElement.getAttribute('data-bs-theme')
  const newMode = currentMode === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', newMode)
  localStorage.setItem('darkMode', newMode === 'dark')
}

// Removed autosave management to prevent data contamination

// Student selection management
export async function selectStudent(studentId, students, currentSubjectId, currentAssessmentId, loadStudentEvaluation) {
  if (!studentId) {
    return null
  }

  const student = students.find(s => s.id === studentId)
  if (student && currentSubjectId && currentAssessmentId) {
    await loadStudentEvaluation(currentSubjectId, currentAssessmentId, studentId)
  }
  
  return student
}

// Paragraph grouping logic
export function getGroupedParagraphs(paragraphs, currentAssessment) {
  const grouped = {}
  
  // First, initialize all categories from the assessment (even if they have no paragraphs)
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
  paragraphs.forEach((paragraph) => {
    // Extract category and knowledge area from paragraph text
    let category = ''
    let knowledgeArea = ''
    let cleanText = paragraph.text
    
    // Check if paragraph has category prefix (format: "Category: text")
    if (paragraph.text.includes(': ')) {
      const parts = paragraph.text.split(': ')
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
          cleanText = remainingText
        }
      }
    }
    
    // Create group key - group by category only
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
      color: paragraph.color,
      id: paragraph.id,
      originalIndex: paragraph.originalIndex,
      fullText: paragraph.text,
      source: paragraph._source // Include source information for badges
    })
  })
  
  return Object.values(grouped)
}

// PDF generation
export async function generatePDF(assessmentData, currentStudentId) {
  if (!currentStudentId) {
    throw new Error('Please select a student first')
  }

  const selectedParagraphs = Array.from(assessmentData.selectedParagraphs)
  if (selectedParagraphs.length === 0) {
    throw new Error('Please select at least one paragraph')
  }

  const doc = new jsPDF()
  doc.setFontSize(12)
  
  // Add student name
  doc.text(`Student: ${assessmentData.studentName}`, 20, 20)
  
  // Add selected paragraphs
  let yPosition = 40
  selectedParagraphs.forEach((paragraphId, index) => {
    const paragraph = assessmentData.paragraphs.find(p => p.id === paragraphId)
    if (paragraph) {
      const text = paragraph.text
      const lines = doc.splitTextToSize(text, 170)
      doc.text(lines, 20, yPosition)
      yPosition += lines.length * 7 + 5
    }
  })

  // Save PDF
  const fileName = `feedback_${assessmentData.studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

// Clipboard operations
export async function copyToClipboard(assessmentData, currentStudentId) {
  if (!currentStudentId) {
    throw new Error('Please select a student first')
  }

  const selectedParagraphs = Array.from(assessmentData.selectedParagraphs)
  if (selectedParagraphs.length === 0) {
    throw new Error('Please select at least one paragraph')
  }

  let text = `Student: ${assessmentData.studentName}\n\n`
  
  selectedParagraphs.forEach((paragraphId) => {
    const paragraph = assessmentData.paragraphs.find(p => p.id === paragraphId)
    if (paragraph) {
      text += `${paragraph.text}\n\n`
    }
  })

  await navigator.clipboard.writeText(text)
}

// Percentage range management
export function addPercentageRange(value, color, lowerPercentage, upperPercentage) {
  const newRange = {
    id: generateId(),
    value: parseFloat(value),
    color,
    lowerPercentage: parseFloat(lowerPercentage),
    upperPercentage: parseFloat(upperPercentage),
    calculatedLower: (parseFloat(value) * parseFloat(lowerPercentage) / 100).toFixed(1),
    calculatedUpper: (parseFloat(value) * parseFloat(upperPercentage) / 100).toFixed(1)
  }
  
  return newRange
}

export function deletePercentageRange(percentageRanges, index) {
  return percentageRanges.filter((_, i) => i !== index)
}

// Assessment header photo management
export function handleAssessmentHeaderPhotoUpload(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = function(e) {
      if (typeof e.target.result === 'string') {
        return e.target.result
      }
    }
    reader.readAsDataURL(file)
  }
}

// Notification management
export function showNotification(message, type = 'success') {
  return { message, type, show: true }
}

export function hideNotification() {
  return { message: '', type: 'success', show: false }
}

// Paragraph editing functions
export function startEditParagraph(paragraphIndex, paragraphs) {
  const paragraph = paragraphs[paragraphIndex]
  if (paragraph) {
    return {
      editingParagraphIndex: paragraphIndex,
      editingParagraphText: extractMainTextFromParagraph(paragraph.text)
    }
  }
  return { editingParagraphIndex: null, editingParagraphText: '' }
}

export function cancelEditParagraph() {
  return { editingParagraphIndex: null, editingParagraphText: '' }
}

export function saveEditParagraph(paragraphs, editingParagraphIndex, editingParagraphText) {
  if (editingParagraphIndex !== null && editingParagraphText.trim()) {
    const originalText = paragraphs[editingParagraphIndex].text
    const newText = reconstructParagraphText(originalText, editingParagraphText.trim())
    
    const updatedParagraphs = [...paragraphs]
    updatedParagraphs[editingParagraphIndex] = {
      ...updatedParagraphs[editingParagraphIndex],
      text: newText
    }
    
    return updatedParagraphs
  }
  return paragraphs
}

// Paragraph reordering functions
export function moveParagraphUp(paragraphIndex, paragraphs) {
  if (paragraphIndex > 0) {
    const newParagraphs = [...paragraphs]
    [newParagraphs[paragraphIndex], newParagraphs[paragraphIndex - 1]] = [newParagraphs[paragraphIndex - 1], newParagraphs[paragraphIndex]]
    
    // Update order and originalIndex values
    newParagraphs.forEach((para, index) => {
      if (typeof para === 'object' && para.id) {
        para.order = index
        para.originalIndex = index
      }
    })
    
    return newParagraphs
  }
  return paragraphs
}

export function moveParagraphDown(paragraphIndex, paragraphs) {
  if (paragraphIndex < paragraphs.length - 1) {
    const newParagraphs = [...paragraphs]
    [newParagraphs[paragraphIndex], newParagraphs[paragraphIndex + 1]] = [newParagraphs[paragraphIndex + 1], newParagraphs[paragraphIndex]]
    
    // Update order and originalIndex values
    newParagraphs.forEach((para, index) => {
      if (typeof para === 'object' && para.id) {
        para.order = index
        para.originalIndex = index
      }
    })
    
    return newParagraphs
  }
  return paragraphs
}