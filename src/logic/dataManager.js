// Data management functions extracted from App.svelte
import { invoke } from '@tauri-apps/api/core'
import { generateId, deepClone } from '../utils/helpers.js'
import { subjectsService, studentsService, studentParagraphsService, studentEvaluationService, assessmentDataService, percentageRangesService } from '../services/dataService.js'

// Data loading functions
export async function loadSubjects() {
  try {
    // Load subjects using service
    const [subjectsData, studentsData, percentageRangesData] = await Promise.all([
      subjectsService.loadSubjects(),
      studentsService.loadStudents(),
      percentageRangesService.loadPercentageRanges()
    ])
    
    return {
      subjects: subjectsData,
      students: studentsData,
      percentageRanges: percentageRangesData
    }
  } catch (error) {
    console.error('Failed to load subjects:', error)
    return {
      subjects: [],
      students: [],
      percentageRanges: []
    }
  }
}

export async function loadAssessmentData(subjectId, assessmentId, preserveSelections = false) {
  try {
    const data = await assessmentDataService.loadAssessmentData(subjectId, assessmentId)
    
    if (data) {
      return {
        paragraphs: data.paragraphs || [],
        selectedParagraphs: preserveSelections ? (data.selectedParagraphs || []) : [],
        studentName: data.studentName || '',
        categoryMarks: data.categoryMarks || {},
        manualTotalMarks: data.manualTotalMarks || ''
      }
    } else {
      return {
        paragraphs: [],
        selectedParagraphs: [],
        studentName: '',
        categoryMarks: {},
        manualTotalMarks: ''
      }
    }
  } catch (error) {
    console.error('Failed to load assessment data:', error)
    return {
      paragraphs: [],
      selectedParagraphs: [],
      studentName: '',
      categoryMarks: {},
      manualTotalMarks: ''
    }
  }
}

export async function loadStudentEvaluation(studentId, assessmentId) {
  try {
    const data = await studentEvaluationService.loadStudentEvaluation(studentId, assessmentId)
    
    if (data) {
      return {
        paragraphs: data.paragraphs || [],
        selectedParagraphs: data.selectedParagraphs || [],
        studentName: data.studentName || '',
        categoryMarks: data.categoryMarks || {},
        manualTotalMarks: data.manualTotalMarks || ''
      }
    } else {
      return {
        paragraphs: [],
        selectedParagraphs: [],
        studentName: '',
        categoryMarks: {},
        manualTotalMarks: ''
      }
    }
  } catch (error) {
    console.error('Failed to load student evaluation:', error)
    return {
      paragraphs: [],
      selectedParagraphs: [],
      studentName: '',
      categoryMarks: {},
      manualTotalMarks: ''
    }
  }
}

export async function loadStudentParagraphs(studentId, currentSubjectId, currentAssessmentId) {
  try {
    const data = await studentParagraphsService.loadStudentParagraphs(studentId)
    
    // Filter paragraphs by current subject and assessment
    const filteredParagraphs = data.filter(para => 
      para.subjectId === currentSubjectId && para.assessmentId === currentAssessmentId
    )
    
    return filteredParagraphs
  } catch (error) {
    console.error('Failed to load student paragraphs:', error)
    return []
  }
}

// Data saving functions
export async function saveSubjects(subjects, students, percentageRanges) {
  try {
    await subjectsService.saveSubjects(subjects)
    await studentsService.saveStudents(students)
    await percentageRangesService.savePercentageRanges(percentageRanges)
    return true
  } catch (error) {
    console.error('Failed to save subjects:', error)
    return false
  }
}

export async function saveAssessmentData(subjectId, assessmentId, assessmentData) {
  try {
    await assessmentDataService.saveAssessmentData(subjectId, assessmentId, assessmentData)
    return true
  } catch (error) {
    console.error('Failed to save assessment data:', error)
    return false
  }
}

export async function saveStudentEvaluation(studentId, assessmentId, evaluationData) {
  try {
    await studentEvaluationService.saveStudentEvaluation(studentId, assessmentId, evaluationData)
    return true
  } catch (error) {
    console.error('Failed to save student evaluation:', error)
    return false
  }
}

export async function saveStudentParagraphs(studentId, paragraphs) {
  try {
    await studentParagraphsService.saveStudentParagraphs(studentId, paragraphs)
    return true
  } catch (error) {
    console.error('Failed to save student paragraphs:', error)
    return false
  }
}

// CRUD operations
export async function addSubject(subjectData) {
  const newSubject = subjectsService.createSubject(subjectData)
  return newSubject
}

export async function updateSubject(subjects, subjectId, updates) {
  return subjectsService.updateSubject(subjects, subjectId, updates)
}

export async function deleteSubject(subjects, subjectId) {
  return subjectsService.deleteSubject(subjects, subjectId)
}

export async function addStudent(studentData) {
  const newStudent = studentsService.createStudent(studentData)
  return newStudent
}

export async function updateStudent(students, studentId, updates) {
  return studentsService.updateStudent(students, studentId, updates)
}

export async function deleteStudent(students, studentId) {
  return studentsService.deleteStudent(students, studentId)
}

export async function addAssessment(subjectId, assessmentData) {
  const newAssessment = {
    id: generateId(assessmentData.name),
    name: assessmentData.name,
    totalMarks: assessmentData.totalMarks || '',
    categories: [],
    knowledgeAreas: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  return newAssessment
}

export async function updateAssessment(subjects, subjectId, assessmentId, updates) {
  return subjects.map(subject => 
    subject.id === subjectId 
      ? {
          ...subject,
          assessments: subject.assessments?.map(assessment => 
            assessment.id === assessmentId 
              ? { ...assessment, ...updates, updatedAt: new Date().toISOString() }
              : assessment
          ) || []
        }
      : subject
  )
}

export async function deleteAssessment(subjects, subjectId, assessmentId) {
  return subjects.map(subject => 
    subject.id === subjectId 
      ? {
          ...subject,
          assessments: subject.assessments?.filter(assessment => assessment.id !== assessmentId) || []
        }
      : subject
  )
}

// Utility functions
export function ensureParagraphsHaveIds(paragraphs) {
  return paragraphs.map((para, index) => {
    if (typeof para === 'string') {
      return {
        id: generateId(para, index),
        text: para,
        color: 'red',
        originalIndex: index
      }
    } else if (para && typeof para === 'object' && !para.id) {
      return {
        ...para,
        id: generateId(para.text || `paragraph-${index}`, index),
        originalIndex: index
      }
    }
    return para
  })
}

export function ensureCategoriesHaveOrder(categories) {
  return categories.map((category, index) => ({
    ...category,
    order: category.order !== undefined ? category.order : index
  }))
}

export function mergeParagraphs(assignmentParagraphs, studentParagraphs) {
  const merged = [...assignmentParagraphs]
  
  studentParagraphs.forEach(studentPara => {
    const existingIndex = merged.findIndex(para => 
      para.text === studentPara.text && para.color === studentPara.color
    )
    
    if (existingIndex === -1) {
      merged.push(studentPara)
    }
  })
  
  return merged
}