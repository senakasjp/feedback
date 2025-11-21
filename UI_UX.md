# UI/UX Design System Documentation

> **New:** Saving a student evaluation now automatically deselects the student and resets the dropdown to 'Select a student...' to prevent accidental edits.


## Overview

This document provides a complete guide to recreate the UI/UX system used in the Feedback Manager application. The system is built on Bootstrap 5 with custom Svelte components, featuring a modern, professional design with consistent patterns for modals, notifications, cards, interactive elements, and comprehensive debugging tools.

## Latest UI/UX Improvements (v3.2.4)

### Total Marks Display System
- **Real-time Feedback**: Total marks displayed in red for immediate visual emphasis
- **Dual Location Display**: Total marks shown in both sidebar and paragraphs section
- **Conditional Rendering**: Clean interface with marks only appearing when entered
- **Bootstrap Integration**: Consistent styling with `text-danger` class for emphasis
- **Responsive Updates**: Total marks update instantly when category marks change

### Enhanced Text Formatting Interface
- **Color Picker Integration**: HTML5 color input with Bootstrap styling
- **Real-time Preview**: Color picker reflects current text selection color
- **Professional Toolbar**: Rich text editor with formatting controls
- **Visual Feedback**: Immediate color application to selected text
- **Export Safety**: Display-only formatting preserved for visual emphasis

## Previous UI/UX Improvements (v3.1.0)

### Visual Debug Panel Implementation
- **Debug Toggle Button**: Checkbox icon (☑️) in navbar for easy access
- **Real-time Monitoring**: Live tracking of paragraph IDs, selections, and DOM elements
- **Visual Feedback**: Color-coded badges showing selection status (✓ green, ○ gray)
- **Warning System**: Automatic alerts for duplicate IDs and multiple DOM elements
- **One-click Fixes**: "Fix Duplicate IDs" button for immediate problem resolution

### Critical Bug Fixes
- **Checkbox Reliability**: Fixed multiple checkbox ticking issue for consistent user experience
- **Data Integrity**: Visual confirmation of clean data separation between assessments
- **ID Management**: Enhanced ID generation with visual feedback for uniqueness
- **Error Prevention**: Automatic detection and fixing of duplicate ID issues

### Debug Panel Design System
- **Bootstrap Integration**: Uses Bootstrap 5 card system with warning color scheme
- **Responsive Layout**: Adapts to different screen sizes with proper spacing
- **Monospace Font**: Debug messages use monospace font for better readability
- **Scrollable Content**: Limited height with scroll for long debug logs
- **Clear Actions**: Prominent buttons for clearing logs and fixing issues

## Previous UI/UX Improvements (v3.0.7)

### Data Contamination Prevention
- **Strict Saving Criteria**: Clear visual feedback when data is being saved to correct location
- **Enhanced Validation**: Console logging provides transparency in save operations
- **Data Isolation**: Visual confirmation that assignment and student data remain separate
- **User Confidence**: Clear understanding that data is being saved correctly

### Student Photo System Removal
- **Simplified Interface**: Removed student photo upload functionality
- **Clean Data Structure**: No photo-related UI elements for students
- **Header Photo Focus**: Only assessment header photos are supported
- **Streamlined Experience**: Reduced complexity in photo management

## Previous UI/UX Improvements (v3.0.6)

### Enhanced Paragraph Display System
- **Source Badges**: Clear visual indicators for paragraph origin (Assignment vs Student)
- **Identical Paragraph Handling**: No duplicate display when assignment and student versions are identical
- **Smart Merging**: Visual distinction only when paragraphs actually differ
- **Clean Interface**: Reduced visual clutter through intelligent paragraph merging

### Data Separation Visual Feedback
- **Assignment View**: Clean, uncluttered display when no student is selected
- **Student View**: Clear indication of merged content with source tracking
- **Visual Consistency**: Professional badge system with Bootstrap 5 styling and Font Awesome icons
- **User Clarity**: Clear understanding of data source and separation

## Design Philosophy

### Core Principles
- **Consistency**: Uniform styling across all components
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Responsiveness**: Mobile-first design that scales to desktop
- **Professional**: Clean, modern appearance suitable for business applications
- **User Feedback**: Clear visual confirmation for all actions
- **Visual Clarity**: All buttons use filled backgrounds for better visibility and consistency

### Color Scheme
- **Primary**: Bootstrap blue (`#0d6efd`)
- **Success**: Bootstrap green (`#198754`)
- **Warning**: Bootstrap yellow (`#ffc107`)
- **Danger**: Bootstrap red (`#dc3545`)
- **Info**: Bootstrap cyan (`#0dcaf0`)
- **Secondary**: Bootstrap gray (`#6c757d`)

## Layout System

### Main Layout Structure
```html
<div class="container-fluid">
  <!-- Header Navigation -->
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <!-- Navbar content -->
  </nav>
  
  <!-- Main Content Area -->
  <div class="row">
    <!-- Sidebar -->
    <div class="col-lg-3 col-md-4">
      <!-- Sidebar content -->
    </div>
    
    <!-- Main Content -->
    <div class="col-lg-9 col-md-8">
      <!-- Main content -->
    </div>
  </div>
</div>
```

### Responsive Breakpoints
- **Mobile**: `< 768px` - Stacked layout, collapsible sidebar
- **Tablet**: `768px - 991px` - Side-by-side with smaller sidebar
- **Desktop**: `≥ 992px` - Full sidebar with main content

## Component Library

### 1. Cards

#### Standard Card
```html
<div class="card">
  <div class="card-header bg-primary text-white">
    <h5 class="card-title mb-0">
      <i class="bi bi-icon me-2"></i>Card Title
    </h5>
  </div>
  <div class="card-body">
    <!-- Card content -->
  </div>
</div>
```

#### Info Card with Border
```html
<div class="card border-start border-info border-4">
  <div class="card-header bg-info text-white py-2">
    <h6 class="mb-0 fw-bold">Category Header</h6>
  </div>
  <div class="card-body p-0">
    <!-- Card content -->
  </div>
</div>
```

#### Card Variations
- **Primary**: `bg-primary` - Main actions and headers
- **Success**: `bg-success` - Positive actions
- **Info**: `bg-info` - Information display
- **Warning**: `bg-warning` - Caution elements
- **Danger**: `bg-danger` - Critical actions

### 2. Cards

#### Interactive Cards
Cards are used for interactive elements like subject and assessment selection in the sidebar. They provide better visual hierarchy and modern appearance compared to buttons.

**Subject Cards:**
```html
<div 
  class="subject-card mb-2" 
  onclick={() => selectSubject(subject)}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectSubject(subject);
    }
  }}
>
  <div class="card border-primary h-100">
    <div class="card-body p-3">
      <div class="d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center">
          <i class="bi bi-book me-2 text-primary"></i>
          <strong class="text-dark">{subject.name}</strong>
        </div>
        <span class="badge bg-primary">{subject.assessments.length}</span>
      </div>
    </div>
  </div>
</div>
```

**Assessment Cards:**
```html
<div 
  class="assessment-card mb-2" 
  onclick={() => selectAssessment(assessment)}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAssessment(assessment);
    }
  }}
>
  <div class="card border-success h-100">
    <div class="card-body p-3">
      <div class="d-flex align-items-center">
        <i class="bi bi-clipboard-check me-2 text-success"></i>
        <strong class="text-dark">{assessment.name}</strong>
      </div>
    </div>
  </div>
</div>
```

**Card Styling:**
```css
.subject-card,
.assessment-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 8px;
}

.subject-card:hover,
.assessment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.subject-card:hover .card {
  border-color: #0d6efd !important;
  box-shadow: 0 4px 15px rgba(13, 110, 253, 0.2);
}

.assessment-card:hover .card {
  border-color: #198754 !important;
  box-shadow: 0 4px 15px rgba(25, 135, 84, 0.2);
}
```

#### Delete Button Consistency
All delete buttons throughout the application use consistent styling for a unified design language.

**Delete Button Style:**
```html
<button 
  class="btn btn-sm btn-outline-danger border-0"
  onclick={() => deleteItem(item.id)}
  title="Delete item"
  aria-label="Delete item"
>
  <i class="bi bi-x"></i>
</button>
```

**CSS Implementation:**
```css
.btn-outline-danger {
  color: var(--color-white) !important;
  border: 1px solid var(--color-danger) !important;
  background-color: var(--color-danger) !important;
}

.btn-outline-danger:hover {
  background-color: var(--color-danger-hover) !important;
  color: var(--color-white) !important;
}
```

**Usage Examples:**
- **Subject Delete Buttons**: Consistent with assessment delete buttons
- **Assessment Delete Buttons**: Standard outline danger style
- **Category Delete Buttons**: Same styling across all components
- **Paragraph Delete Buttons**: Unified appearance in feedback editor

### 3. Buttons

#### Button Hierarchy
```html
<!-- Primary Action -->
<button class="btn btn-primary btn-lg">
  <i class="bi bi-plus-circle me-2"></i>Primary Action
</button>

<!-- Secondary Action -->
<button class="btn btn-outline-primary">
  <i class="bi bi-gear me-2"></i>Secondary Action
</button>

<!-- Small Action -->
<button class="btn btn-primary btn-sm">
  <i class="bi bi-plus me-1"></i>Small Action
</button>

<!-- Danger Action -->
<button class="btn btn-outline-danger btn-sm">
  <i class="bi bi-trash"></i>
</button>
```

#### Button Styling System
All buttons in the system use filled backgrounds (no transparent/outline buttons) for better visual consistency and accessibility.

**Button Variants:**
- **Primary**: Blue background with white text (`btn-primary`, `btn-outline-primary`)
- **Success**: Green background with white text (`btn-success`, `btn-outline-success`)
- **Danger**: Red background with white text (`btn-danger`, `btn-outline-danger`)
- **Secondary**: Gray background with white text (`btn-secondary`, `btn-outline-secondary`)
- **Warning**: Yellow background with dark text (`btn-warning`)

**CSS Implementation:**
```css
/* All outline buttons are filled by default */
.btn-outline-primary {
  color: var(--color-white) !important;
  border: 1px solid var(--color-primary) !important;
  background-color: var(--color-primary) !important;
}

.btn-outline-primary:hover {
  background-color: var(--color-primary-hover) !important;
  color: var(--color-white) !important;
}

/* Consistent spacing between inputs and buttons */
.input-group + .btn,
.input-group + button,
.form-control + .btn,
.form-control + button {
  margin-left: 0.5rem !important;
}

/* Spacing for button groups */
.btn-group .btn + .btn {
  margin-left: 0.25rem !important;
}
```

**Color Variables:**
```css
:root {
  --color-primary: #1e3a8a;
  --color-primary-hover: #1e40af;
  --color-success: #28a745;
  --color-success-hover: #1e7e34;
  --color-secondary: #6c757d;
  --color-secondary-hover: #5a6268;
  --color-danger: #dc3545;
  --color-danger-hover: #c82333;
  --color-white: #ffffff;
}
```

#### Custom Action Buttons (Sidebar)
```css
.action-btn {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  text-align: left;
  display: flex;
  align-items: center;
  width: 100%;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

/* Button Color Variants */
.save-btn {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
}

.load-btn {
  background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%);
}

.copy-btn {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
}

.download-btn {
  background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%);
}
```

### 3. Form Elements

#### Input Groups
```html
<div class="input-group input-group-lg">
  <input 
    type="text" 
    class="form-control" 
    placeholder="Enter text..."
    bind:value={inputValue}
  >
  <button class="btn btn-outline-primary" type="button">
    <i class="bi bi-plus"></i>
  </button>
  <button class="btn btn-outline-secondary" type="button">
    <i class="bi bi-gear"></i>
  </button>
</div>
```

#### Form Labels
```html
<label for="inputId" class="form-label fw-bold">Label Text:</label>
```

#### Select Dropdowns
```html
<select 
  id="selectId" 
  class="form-select" 
  bind:value={selectedValue}
  onchange={(e) => handleChange(e.target.value)}
>
  <option value="">Select an option...</option>
  {#each options as option}
    <option value={option.id}>{option.name}</option>
  {/each}
</select>
```

#### Number Inputs
```html
<input 
  type="number" 
  class="form-control form-control-sm" 
  style="width: 80px;"
  placeholder="0"
  value={numericValue || ''}
  oninput={(e) => updateValue(e.target.value)}
  min="0"
  step="0.5"
>
```

### 4. Modals

#### Standard Modal Structure
```html
{#if showModal}
  <div class="modal show d-block" style="background-color: rgba(0,0,0,0.5);" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <i class="bi bi-icon me-2"></i>Modal Title
          </h5>
          <button type="button" class="btn-close btn-close-white" onclick={() => showModal = false}></button>
        </div>
        <div class="modal-body">
          <!-- Modal content -->
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => showModal = false}>
            <i class="bi bi-x-circle me-2"></i>Cancel
          </button>
          <button type="button" class="btn btn-primary" onclick={handleAction}>
            <i class="bi bi-check-circle me-2"></i>Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
```

#### Large Modal (for lists)
```html
<div class="modal-dialog modal-lg modal-dialog-centered">
```

#### Modal Variations
- **Add Item**: Primary header with form fields
- **Manage Items**: Large modal with list and actions
- **Confirmation**: Warning header with confirmation message
- **Information**: Info header with display content

### 5. Notifications

#### Toast Notifications
```html
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
```

#### Alert Boxes
```html
<!-- Info Alert -->
<div class="alert alert-info py-2 mb-0">
  <i class="bi bi-person-check me-2"></i>
  <strong>Selected Item:</strong> {selectedItemName}
</div>

<!-- Warning Alert -->
<div class="alert alert-warning mb-3" role="alert">
  <i class="bi bi-warning me-2"></i>
  <strong>Warning:</strong> Warning message text
</div>

<!-- Danger Alert -->
<div class="alert alert-danger mb-3" role="alert">
  <i class="bi bi-trophy me-2"></i>
  <strong>Total Marks:</strong> {totalMarks}
</div>
```

### 6. Lists and Items

#### List Groups
```html
<div class="list-group">
  {#each items as item}
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <h6 class="mb-1">{item.name}</h6>
        <small class="text-muted">ID: {item.id}</small>
      </div>
      <div class="btn-group" role="group">
        <button class="btn btn-outline-primary btn-sm" onclick={() => selectItem(item.id)}>
          <i class="bi bi-check-circle"></i>
        </button>
        <button class="btn btn-outline-danger btn-sm" onclick={() => deleteItem(item.id)}>
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  {/each}
</div>
```

#### Empty State
```html
<div class="text-center py-4">
  <i class="bi bi-people text-muted" style="font-size: 3rem;"></i>
  <p class="text-muted mt-2">No items found.</p>
  <button class="btn btn-primary" onclick={() => showAddModal = true}>
    <i class="bi bi-plus me-2"></i>Add First Item
  </button>
</div>
```

### 7. Navigation

#### Sidebar Navigation
```html
<div class="card position-sticky d-lg-block" style="top: 20px; margin: 0; width: 100%; box-sizing: border-box;">
  <div class="card-header bg-primary text-white">
    <h5 class="card-title mb-0">
      <i class="bi bi-list me-2"></i>Navigation
    </h5>
  </div>
  <div class="card-body">
    <!-- Navigation content -->
  </div>
</div>
```

#### Breadcrumb Navigation
```html
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item">
      <a href="#" onclick={goToLevel1}>Level 1</a>
    </li>
    <li class="breadcrumb-item">
      <a href="#" onclick={goToLevel2}>Level 2</a>
    </li>
    <li class="breadcrumb-item active" aria-current="page">Level 3</li>
  </ol>
</nav>
```

## Icon System

### Bootstrap Icons Usage
- **Actions**: `bi-plus`, `bi-trash`, `bi-pencil`, `bi-gear`
- **Navigation**: `bi-arrow-left`, `bi-arrow-right`, `bi-list`
- **Status**: `bi-check-circle`, `bi-x-circle`, `bi-warning`
- **Content**: `bi-person`, `bi-book`, `bi-clipboard`, `bi-download`
- **UI Elements**: `bi-chevron-down`, `bi-chevron-up`

### Icon Patterns
```html
<!-- With text -->
<i class="bi bi-icon me-2"></i>Text

<!-- Icon only buttons -->
<button class="btn btn-outline-primary">
  <i class="bi bi-icon"></i>
</button>

<!-- Status indicators -->
<i class="bi bi-check-circle text-success"></i>
<i class="bi bi-x-circle text-danger"></i>
```

## Spacing and Layout

### Margin/Padding Classes
- **Small**: `py-2`, `px-2`, `mb-2`, `mt-2`
- **Medium**: `py-3`, `px-3`, `mb-3`, `mt-3`
- **Large**: `py-4`, `px-4`, `mb-4`, `mt-4`

### Gap Classes
- **Small**: `gap-2`
- **Medium**: `gap-3`
- **Large**: `gap-4`

### Button and Input Spacing
Consistent spacing between form elements and buttons is enforced through CSS:

**Input Group Spacing:**
```css
/* 0.5rem spacing between input groups and standalone buttons */
.input-group + .btn,
.input-group + button,
.form-control + .btn,
.form-control + button {
  margin-left: 0.5rem !important;
}
```

**Button Group Spacing:**
```css
/* 0.25rem spacing between buttons in groups */
.btn-group .btn + .btn {
  margin-left: 0.25rem !important;
}
```

**Usage Examples:**
```html
<!-- Input with button - automatic spacing -->
<div class="input-group">
  <input type="text" class="form-control" placeholder="Enter text...">
  <button class="btn btn-primary">Add</button>
</div>

<!-- Standalone input with button - automatic spacing -->
<input type="text" class="form-control" placeholder="Enter text...">
<button class="btn btn-primary">Submit</button>

<!-- Button group - automatic spacing -->
<div class="btn-group">
  <button class="btn btn-primary">Save</button>
  <button class="btn btn-secondary">Cancel</button>
</div>

<!-- Flexbox layout with gap (recommended) -->
<div class="d-flex gap-2">
  <select class="form-select flex-grow-1">
    <option>Select option...</option>
  </select>
  <button class="btn btn-primary">Action 1</button>
  <button class="btn btn-secondary">Action 2</button>
</div>
```

#### Form Layout Best Practices
**Student Selection Pattern:**
```html
<label for="studentSelect" class="form-label fw-bold">Student:</label>
<div class="d-flex gap-2">
  <select 
    id="studentSelect" 
    class="form-select flex-grow-1" 
    bind:value={currentStudentId}
  >
    <option value="">Select a student...</option>
    {#each students as student}
      <option value={student.id}>{student.displayName}</option>
    {/each}
  </select>
  <button class="btn btn-outline-primary" onclick={() => showAddStudent = true}>
    <i class="bi bi-person-plus"></i>
  </button>
  <button class="btn btn-outline-secondary" onclick={() => showStudentManager = true}>
    <i class="bi bi-gear"></i>
  </button>
</div>
```

**Key Benefits:**
- **Consistent Spacing**: 0.5rem gap between all elements
- **Responsive Design**: Select box grows to fill available space
- **Clean Layout**: No complex input-group nesting
- **Accessibility**: Proper labels and ARIA attributes

### Flexbox Utilities
```html
<!-- Center content -->
<div class="d-flex justify-content-center align-items-center">

<!-- Space between -->
<div class="d-flex justify-content-between align-items-center">

<!-- Full width -->
<div class="d-flex w-100">
```

## Color and Typography

### Text Colors
- **Primary**: `text-primary`
- **Secondary**: `text-secondary`
- **Success**: `text-success`
- **Danger**: `text-danger`
- **Warning**: `text-warning`
- **Info**: `text-info`
- **Muted**: `text-muted`
- **Light**: `text-light` (on dark backgrounds)

### Font Weights
- **Normal**: `fw-normal`
- **Bold**: `fw-bold`
- **Light**: `fw-light`

### Text Sizes
- **Small**: `small`
- **Large**: `fs-5`, `fs-4`, `fs-3`

## Interactive States

### Hover Effects
```css
.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
```

### Focus States
```css
.form-control:focus {
  border-color: #86b7fe;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
```

### Disabled States
```html
<button class="btn btn-primary" disabled>
  Disabled Button
</button>
```

## Responsive Design Patterns

### Mobile-First Approach
```html
<!-- Mobile: Stacked, Desktop: Side-by-side -->
<div class="row g-3">
  <div class="col-12 col-md-6">
    <!-- Content -->
  </div>
  <div class="col-12 col-md-6">
    <!-- Content -->
  </div>
</div>
```

### Collapsible Elements
```html
<!-- Mobile toggle -->
<div class="d-lg-none mb-3">
  <button class="btn btn-outline-primary w-100" onclick={toggleMobile}>
    <i class="bi bi-chevron-down me-2"></i>
    {showMobile ? 'Hide' : 'Show'} Content
  </button>
</div>

<!-- Content with responsive visibility -->
<div class="{showMobile ? 'd-block' : 'd-none'} d-lg-block">
  <!-- Content -->
</div>
```

## Animation and Transitions

### CSS Transitions
```css
.transition {
  transition: all 0.3s ease;
}

.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Svelte Transitions
```html
{#if showElement}
  <div transition:fade>
    <!-- Content -->
  </div>
{/if}
```

## Accessibility Features

### ARIA Labels
```html
<button 
  class="btn btn-outline-primary" 
  aria-label="Add new item"
  title="Add new item"
>
  <i class="bi bi-plus"></i>
</button>
```

### Form Labels
```html
<label for="inputId" class="form-label fw-bold">Label Text:</label>
<input id="inputId" type="text" class="form-control">
```

### Screen Reader Support
```html
<div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
  <!-- Toast content -->
</div>
```

## Implementation Checklist

### 1. Setup
- [ ] Install Bootstrap 5
- [ ] Install Bootstrap Icons
- [ ] Set up Svelte project structure
- [ ] Configure CSS imports

### 2. Base Components
- [x] Create card components (interactive cards for navigation)
- [x] Implement button system (filled backgrounds, consistent spacing)
- [x] Set up form elements (with proper spacing and layout)
- [x] Create modal system
- [x] Implement consistent delete button styling

### 3. Layout System
- [ ] Implement responsive grid
- [ ] Create sidebar navigation
- [ ] Set up main content area
- [ ] Add mobile responsiveness

### 4. Interactive Elements
- [ ] Add notification system
- [ ] Implement list components
- [ ] Create empty states
- [ ] Add loading states

### 5. Styling
- [ ] Apply color scheme
- [ ] Add hover effects
- [ ] Implement transitions
- [ ] Test accessibility

### 6. Testing
- [ ] Test responsive design
- [ ] Verify accessibility
- [ ] Check cross-browser compatibility
- [ ] Validate form interactions

## File Structure
```
src/
├── components/
│   ├── Card.svelte
│   ├── Modal.svelte
│   ├── Button.svelte
│   └── Notification.svelte
├── styles/
│   ├── design-system.css
│   ├── components.css
│   └── responsive.css
└── App.svelte
```

## CSS Custom Properties
```css
:root {
  --primary-color: #0d6efd;
  --success-color: #198754;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --info-color: #0dcaf0;
  --border-radius: 0.375rem;
  --box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  --transition: all 0.3s ease;
}
```

This UI/UX system provides a complete foundation for building modern, professional web applications with consistent design patterns, accessibility features, and responsive behavior.
