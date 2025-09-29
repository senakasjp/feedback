// Data service functions extracted from App.svelte
import { invoke } from '@tauri-apps/api/core'
import { generateId, deepClone } from '../utils/helpers.js'

// Helper to read/write files, with localStorage fallback
async function readFile(path) {
  try {
    return await invoke('read_file', { path })
  } catch (error) {
    console.warn(`Failed to read file ${path}, falling back to localStorage:`, error)
    return localStorage.getItem(path) || null
  }
}

async function writeFile(path, content) {
  try {
    await invoke('write_file', { path, content })
    return true
  } catch (error) {
    console.warn(`Failed to write file ${path}, falling back to localStorage:`, error)
    localStorage.setItem(path, content)
    return true
  }
}

// --- Subjects Service ---
export const subjectsService = {
  async loadSubjects() {
    try {
      const data = await invoke('read_portable')
      if (data) {
        const parsed = JSON.parse(data)
        return parsed.subjects || []
      }
      return []
    } catch (error) {
      console.warn('Failed to load subjects from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem('subjects')
      return data ? JSON.parse(data) : []
    }
  },

  async saveSubjects(subjects) {
    try {
      const existingData = await invoke('read_portable')
      let data = { subjects: [], students: [], percentageRanges: [] }
      if (existingData) {
        data = JSON.parse(existingData)
      }
      data.subjects = subjects
      await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save subjects to Tauri, falling back to localStorage:', error)
      localStorage.setItem('subjects', JSON.stringify(subjects, null, 2))
      return true
    }
  },

  createSubject(subjectData) {
    return {
      id: generateId(subjectData.name),
      name: subjectData.name,
      assessments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },

  updateSubject(subjects, subjectId, updates) {
    return subjects.map(subject => 
      subject.id === subjectId 
        ? { ...subject, ...updates, updatedAt: new Date().toISOString() }
        : subject
    )
  },

  deleteSubject(subjects, subjectId) {
    return subjects.filter(subject => subject.id !== subjectId)
  }
}

// --- Students Service ---
export const studentsService = {
  async loadStudents() {
    try {
      const data = await invoke('read_portable')
      if (data) {
        const parsed = JSON.parse(data)
        const students = parsed.students || []
        // Ensure all students have selectedParagraphs property for backward compatibility
        return students.map(student => ({
          ...student,
          selectedParagraphs: student.selectedParagraphs || {}
        }))
      }
      return []
    } catch (error) {
      console.warn('Failed to load students from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem('students')
      const students = data ? JSON.parse(data) : []
      // Ensure all students have selectedParagraphs property for backward compatibility
      return students.map(student => ({
        ...student,
        selectedParagraphs: student.selectedParagraphs || {}
      }))
    }
  },

  async saveStudents(students) {
    try {
      const existingData = await invoke('read_portable')
      let data = { subjects: [], students: [], percentageRanges: [] }
      if (existingData) {
        data = JSON.parse(existingData)
      }
      data.students = students
      await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save students to Tauri, falling back to localStorage:', error)
      localStorage.setItem('students', JSON.stringify(students, null, 2))
      return true
    }
  },

  createStudent(studentData) {
    return {
      id: studentData.id || generateId(studentData.displayName),
      displayName: studentData.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedParagraphs: {} // Store selected paragraphs by assessmentId
    }
  },

  updateStudent(students, studentId, updates) {
    return students.map(student => 
      student.id === studentId 
        ? { ...student, ...updates, updatedAt: new Date().toISOString() }
        : student
    )
  },

  deleteStudent(students, studentId) {
    return students.filter(student => student.id !== studentId)
  },

  findStudent(students, studentId) {
    return students.find(student => student.id === studentId)
  },

  // Update student's selected paragraphs for a specific assessment
  updateStudentSelectedParagraphs(students, studentId, assessmentId, selectedParagraphs) {
    return students.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          selectedParagraphs: {
            ...student.selectedParagraphs,
            [assessmentId]: [...selectedParagraphs] // Replace old selection data
          },
          updatedAt: new Date().toISOString()
        }
      }
      return student
    })
  },

  // Get student's selected paragraphs for a specific assessment
  getStudentSelectedParagraphs(student, assessmentId) {
    return student.selectedParagraphs?.[assessmentId] || []
  }
}

// --- Student Paragraphs Service ---
export const studentParagraphsService = {
  async loadStudentParagraphs(studentId) {
    try {
      const data = await invoke('read_student_paragraphs', { studentId })
      if (data) {
        return JSON.parse(data).paragraphs || []
      }
      return []
    } catch (error) {
      console.warn('Failed to load student paragraphs from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem(`student-paragraphs-${studentId}`)
      return data ? JSON.parse(data).paragraphs || [] : []
    }
  },

  async saveStudentParagraphs(studentId, paragraphs) {
    try {
      const data = { studentId, paragraphs: deepClone(paragraphs), savedAt: new Date().toISOString() }
      await invoke('write_student_paragraphs', { studentId, data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save student paragraphs to Tauri, falling back to localStorage:', error)
      const data = { studentId, paragraphs: deepClone(paragraphs), savedAt: new Date().toISOString() }
      localStorage.setItem(`student-paragraphs-${studentId}`, JSON.stringify(data, null, 2))
      return true
    }
  }
}

// --- Student Evaluation Service ---
export const studentEvaluationService = {
  async loadStudentEvaluation(studentId, assessmentId) {
    try {
      const data = await invoke('read_student_evaluation', { studentId, assessmentId })
      if (data) {
        return JSON.parse(data)
      }
      return null
    } catch (error) {
      console.warn('Failed to load student evaluation from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem(`student-evaluation-${studentId}-${assessmentId}`)
      return data ? JSON.parse(data) : null
    }
  },

  async saveStudentEvaluation(studentId, assessmentId, evaluationData) {
    try {
      const data = { studentId, assessmentId, ...deepClone(evaluationData), savedAt: new Date().toISOString() }
      await invoke('write_student_evaluation', { studentId, assessmentId, data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save student evaluation to Tauri, falling back to localStorage:', error)
      const data = { studentId, assessmentId, ...deepClone(evaluationData), savedAt: new Date().toISOString() }
      localStorage.setItem(`student-evaluation-${studentId}-${assessmentId}`, JSON.stringify(data, null, 2))
      return true
    }
  }
}

// --- Assessment Data Service ---
export const assessmentDataService = {
  async loadAssessmentData(subjectId, assessmentId) {
    try {
      const data = await invoke('read_subject_data', { subjectId: `${subjectId}-${assessmentId}` })
      if (data) {
        return JSON.parse(data)
      }
      return null
    } catch (error) {
      console.warn('Failed to load assessment data from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem(`assessment-data-${subjectId}-${assessmentId}`)
      return data ? JSON.parse(data) : null
    }
  },

  async saveAssessmentData(subjectId, assessmentId, assessmentData) {
    try {
      const data = { subjectId, assessmentId, ...deepClone(assessmentData), savedAt: new Date().toISOString() }
      await invoke('write_subject_data', { subjectId: `${subjectId}-${assessmentId}`, data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save assessment data to Tauri, falling back to localStorage:', error)
      const data = { subjectId, assessmentId, ...deepClone(assessmentData), savedAt: new Date().toISOString() }
      localStorage.setItem(`assessment-data-${subjectId}-${assessmentId}`, JSON.stringify(data, null, 2))
      return true
    }
  }
}

// --- Percentage Ranges Service ---
export const percentageRangesService = {
  async loadPercentageRanges() {
    try {
      const data = await invoke('read_portable')
      if (data) {
        const parsed = JSON.parse(data)
        return parsed.percentageRanges || []
      }
      return []
    } catch (error) {
      console.warn('Failed to load percentage ranges from Tauri, falling back to localStorage:', error)
      const data = localStorage.getItem('percentage-ranges')
      return data ? JSON.parse(data) : []
    }
  },

  async savePercentageRanges(percentageRanges) {
    try {
      const existingData = await invoke('read_portable')
      let data = { subjects: [], students: [], percentageRanges: [] }
      if (existingData) {
        data = JSON.parse(existingData)
      }
      data.percentageRanges = percentageRanges
      await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
      return true
    } catch (error) {
      console.warn('Failed to save percentage ranges to Tauri, falling back to localStorage:', error)
      localStorage.setItem('percentage-ranges', JSON.stringify(percentageRanges, null, 2))
      return true
    }
  }
}

// --- Import Service ---
export const importService = {
  /**
   * Get all available assignments from subjects (excluding current assignment)
   */
  getAvailableAssignments(subjects, currentSubjectId, currentAssessmentId) {
    const assignments = []
    
    for (const subject of subjects) {
      for (const assessment of subject.assessments || []) {
        // Exclude current assignment
        if (subject.id !== currentSubjectId || assessment.id !== currentAssessmentId) {
          assignments.push({
            subjectId: subject.id,
            subjectName: subject.name,
            assessmentId: assessment.id,
            assessmentName: assessment.name,
            displayName: `${subject.name} - ${assessment.name}`
          })
        }
      }
    }
    
    return assignments
  },

  /**
   * Load paragraphs from a specific assignment
   */
  async loadAssignmentParagraphs(subjectId, assessmentId) {
    try {
      const data = await assessmentDataService.loadAssessmentData(subjectId, assessmentId)
      
      if (data && data.paragraphs) {
        // Ensure paragraphs have IDs for proper tracking
        return data.paragraphs.map(para => {
          if (typeof para === 'string') {
            return {
              id: generateId(),
              text: para,
              color: undefined
            }
          } else if (para && !para.id) {
            return {
              ...para,
              id: generateId()
            }
          }
          return para
        })
      }
      
      return []
    } catch (error) {
      console.error('Error loading assignment paragraphs:', error)
      throw new Error('Failed to load paragraphs from assignment')
    }
  }
}