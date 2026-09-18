// Validation utility functions extracted from App.svelte
export function validateParagraph(paragraph) {
  const errors = []
  
  if (!paragraph.text || paragraph.text.trim().length === 0) {
    errors.push('Paragraph text is required')
  }
  
  if (paragraph.text && paragraph.text.length > 1000) {
    errors.push('Paragraph text must be less than 1000 characters')
  }
  
  if (paragraph.color && !['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'teal', 'cyan', 'indigo'].includes(paragraph.color)) {
    errors.push('Invalid color selection')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    message: errors.length > 0 ? errors.join(', ') : 'Valid paragraph'
  }
}

export function validateStudent(student) {
  const errors = []
  
  if (!student.displayName || student.displayName.trim().length === 0) {
    errors.push('Student name is required')
  }
  
  if (student.displayName && student.displayName.length > 100) {
    errors.push('Student name must be less than 100 characters')
  }
  
  if (student.id && student.id.length > 50) {
    errors.push('Student ID must be less than 50 characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    message: errors.length > 0 ? errors.join(', ') : 'Valid student'
  }
}

export function validateSubject(subject) {
  const errors = []
  
  if (!subject.name || subject.name.trim().length === 0) {
    errors.push('Subject name is required')
  }
  
  if (subject.name && subject.name.length > 100) {
    errors.push('Subject name must be less than 100 characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    message: errors.length > 0 ? errors.join(', ') : 'Valid subject'
  }
}

export function validateAssessment(assessment) {
  const errors = []
  
  if (!assessment.name || assessment.name.trim().length === 0) {
    errors.push('Assessment name is required')
  }
  
  if (assessment.name && assessment.name.length > 100) {
    errors.push('Assessment name must be less than 100 characters')
  }
  
  if (assessment.totalMarks && (isNaN(parseFloat(assessment.totalMarks)) || parseFloat(assessment.totalMarks) < 0)) {
    errors.push('Total marks must be a positive number')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    message: errors.length > 0 ? errors.join(', ') : 'Valid assessment'
  }
}

export function validateCategoryMarks(categoryMarks, categories) {
  const errors = []
  
  if (!categories || categories.length === 0) {
    return { isValid: true, errors: [], message: 'No categories to validate' }
  }
  
  for (const category of categories) {
    const marks = categoryMarks[category.name]
    if (marks !== undefined && marks !== '') {
      const numMarks = parseFloat(marks)
      if (isNaN(numMarks) || numMarks < 0) {
        errors.push(`${category.name}: Marks must be a positive number`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    message: errors.length > 0 ? errors.join(', ') : 'Valid category marks'
  }
}