// Utility helper functions extracted from App.svelte
export function generateId(text = '', index = 0, uniqueSuffix = '') {
  // Create deterministic ID based on text content and position
  const content = text || `paragraph-${index}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Add timestamp and random component to ensure uniqueness
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  
  return `para-${Math.abs(hash)}-${index}-${timestamp}-${random}${uniqueSuffix}`
}

export function sortByProperty(array, property, ascending = true) {
  return [...array].sort((a, b) => {
    const aVal = a[property] || ''
    const bVal = b[property] || ''
    const comparison = aVal.localeCompare(bVal)
    return ascending ? comparison : -comparison
  })
}

export function debounce(func, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

export function calculateTotalMarks(categoryMarks, categories) {
  if (!categories || categories.length === 0) return 0
  
  return categories.reduce((total, category) => {
    const marks = categoryMarks[category.name] || 0
    return total + parseFloat(marks)
  }, 0)
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

export function extractMainTextFromParagraph(paragraphText) {
  let text = paragraphText
  
  // Remove category prefix (format: "Category: text")
  if (text.includes(': ')) {
    const parts = text.split(': ')
    if (parts.length >= 2) {
      text = parts.slice(1).join(': ')
    }
  }
  
  // Remove knowledge area suffix (format: "text - Knowledge Area")
  if (text.includes(' - ')) {
    const parts = text.split(' - ')
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]
      if (!lastPart.includes(':')) {
        text = parts.slice(0, -1).join(' - ')
      }
    }
  }
  
  return text
}

export function reconstructParagraphText(originalText, newMainText) {
  // Extract category and knowledge area from original text
  let category = ''
  let knowledgeArea = ''
  
  if (originalText.includes(': ')) {
    const parts = originalText.split(': ')
    if (parts.length >= 2) {
      const firstPart = parts[0]
      if (firstPart.includes(' - ')) {
        const oldParts = firstPart.split(' - ')
        if (oldParts.length >= 2) {
          knowledgeArea = oldParts[0].trim()
          category = oldParts[1].trim()
        }
      } else {
        category = firstPart
      }
    }
  }
  
  // Reconstruct with new main text
  let reconstructed = newMainText
  
  if (category) {
    reconstructed = `${category}: ${reconstructed}`
  }
  
  if (knowledgeArea) {
    reconstructed = `${reconstructed} - ${knowledgeArea}`
  }
  
  return reconstructed
}

export function extractKnowledgeArea(text) {
  // Check if text ends with " - KnowledgeArea" format
  if (text.includes(' - ')) {
    const parts = text.split(' - ')
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]
      if (!lastPart.includes(':')) {
        return lastPart.trim()
      }
    }
  }
  return ''
}

export function cleanParagraphTextForDisplay(text) {
  // Remove knowledge area suffix for display
  const knowledgeArea = extractKnowledgeArea(text)
  if (knowledgeArea) {
    return text.replace(` - ${knowledgeArea}`, '').trim()
  }
  return text
}

export function getColorBadgeClass(color) {
  switch(color) {
    case 'red': return 'bg-danger'
    case 'orange': return 'bg-warning'
    case 'yellow': return 'bg-warning text-dark'
    case 'lightgreen': return 'bg-info text-white'
    case 'green': return 'bg-success'
    case '': return 'bg-light text-muted border'
    default: return 'bg-secondary'
  }
}

export function getColorHex(color) {
  switch(color) {
    case 'red': return '#dc3545'
    case 'orange': return '#fd7e14'
    case 'yellow': return '#ffc107'
    case 'lightgreen': return '#20c997'
    case 'green': return '#198754'
    case '': return '#6c757d'
    default: return '#6c757d'
  }
}

export function getSectionOrder(paragraph) {
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
    return 100
  }
  if (paragraph.match(/^Decision:/i)) {
    return 200
  }
  
  return 999 // Paragraphs without sections go to the end
}

export function ensureParagraphsHaveIds(paragraphs) {
  return paragraphs.map((para, index) => {
    if (typeof para === 'string') {
      return {
        id: generateId(para, index),
        text: para,
        color: undefined,
        originalIndex: index,
        fullText: para
      }
    } else if (para && !para.id) {
      return {
        ...para,
        id: generateId(para.text || para, index),
        originalIndex: index,
        fullText: para.text || para
      }
    } else {
      return {
        ...para,
        originalIndex: index,
        fullText: para.text || para
      }
    }
  })
}

export function ensureCategoriesHaveOrder(categories) {
  if (!categories) return categories
  return categories.map((category, index) => {
    if (category.order === undefined) {
      return {
        ...category,
        order: index
      }
    }
    return category
  })
}
