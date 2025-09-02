<script>
	import { invoke } from '@tauri-apps/api/core'
	import { onMount } from 'svelte'
	import jsPDF from 'jspdf'

	let newParagraph = $state('')
	let paragraphs = $state([])
	let selectedParagraphs = $state(new Set())
	let studentName = $state('')
	let studentImage = $state('')

	async function loadData() {
		try {
			// Try Tauri first (desktop app)
			const data = await invoke('read_portable')
			if (data) {
				const parsed = JSON.parse(data)
				paragraphs = parsed.paragraphs || []
				selectedParagraphs = new Set(parsed.selectedParagraphs || [])
				studentName = parsed.studentName || ''
				studentImage = parsed.studentImage || ''
			}
		} catch (error) {
			console.log('Tauri not available, using browser storage')
			// Fallback to localStorage for web development
			try {
				const data = localStorage.getItem('feedback-data')
				if (data) {
					const parsed = JSON.parse(data)
					paragraphs = parsed.paragraphs || []
					selectedParagraphs = new Set(parsed.selectedParagraphs || [])
					studentName = parsed.studentName || ''
					studentImage = parsed.studentImage || ''
				}
			} catch (localError) {
				console.error('Failed to load from localStorage:', localError)
			}
		}
	}

	async function saveData() {
		const data = {
			paragraphs,
			selectedParagraphs: Array.from(selectedParagraphs),
			studentName,
			studentImage
		}
		
		try {
			// Try Tauri first (desktop app)
			await invoke('write_portable', { data: JSON.stringify(data, null, 2) })
		} catch (error) {
			console.log('Tauri not available, saving to browser storage')
			// Fallback to localStorage for web development
			try {
				localStorage.setItem('feedback-data', JSON.stringify(data))
			} catch (localError) {
				console.error('Failed to save to localStorage:', localError)
			}
		}
	}

	function addParagraph() {
		if (newParagraph.trim()) {
			paragraphs.push(newParagraph.trim())
			newParagraph = ''
			saveData()
		}
	}

	function toggleParagraph(index) {
		if (selectedParagraphs.has(index)) {
			selectedParagraphs.delete(index)
		} else {
			selectedParagraphs.add(index)
		}
		selectedParagraphs = new Set(selectedParagraphs) // trigger reactivity
		saveData()
	}

	function getSelectedText() {
		return Array.from(selectedParagraphs)
			.sort((a, b) => a - b)
			.map(index => paragraphs[index])
			.join('\n\n')
	}

	function handleImageUpload(event) {
		const file = event.target.files[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = function(e) {
				studentImage = e.target.result
				saveData()
			}
			reader.readAsDataURL(file)
		}
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(getSelectedText())
			.then(() => alert('Copied to clipboard!'))
			.catch(() => alert('Failed to copy to clipboard'))
	}

	function generatePDF() {
		const selectedText = getSelectedText()
		if (!selectedText) {
			alert('No paragraphs selected!')
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
					
					// Use absolute full width (edge to edge)
					let imageWidth = pageWidth
					let imageHeight = pageWidth / aspectRatio
					
					// Position at absolute top-left (0,0)
					const xPosition = 0
					
					doc.addImage(studentImage, 'JPEG', xPosition, yPosition, imageWidth, imageHeight)
					
					// Continue with the rest of the PDF generation
					let currentY = yPosition + imageHeight + 15
					generateRestOfPDF(doc, currentY, margin, pageWidth, maxLineWidth, selectedText, studentName)
				}
				img.src = studentImage
				return // Exit here as the rest will be handled in onload
			} catch (error) {
				console.log('Could not add image to PDF:', error)
			}
		}
		
		// If no image, continue with normal PDF generation (with margin)
		generateRestOfPDF(doc, margin, margin, pageWidth, maxLineWidth, selectedText, studentName)
	}

	function generateRestOfPDF(doc, yPosition, margin, pageWidth, maxLineWidth, selectedText, studentName) {
		// Try to set a font that's closer to Oxygen (Arial or Helvetica)
		try {
			doc.setFont('helvetica', 'normal')
		} catch (e) {
			// Fallback to default font if helvetica is not available
			console.log('Helvetica not available, using default font')
		}
		
		// Student info
		doc.setFontSize(14)
		if (studentName) {
			doc.text(`Student: ${studentName}`, margin, yPosition)
			yPosition += 10
		}
		
		// Add separator line
		yPosition += 5
		doc.setLineWidth(0.5)
		doc.line(margin, yPosition, pageWidth - margin, yPosition)
		yPosition += 15
		
		// Content
		doc.setFontSize(12)
		const lines = doc.splitTextToSize(selectedText, maxLineWidth)
		const lineHeight = 7
		const pageHeight = doc.internal.pageSize.getHeight()
		
		lines.forEach((line) => {
			// Check if we need a new page
			if (yPosition > pageHeight - margin) {
				doc.addPage()
				yPosition = margin + 10
			}
			
			doc.text(line, margin, yPosition)
			yPosition += lineHeight
		})
		
		// Generate filename with student name if provided
		let filename = 'feedback-report'
		if (studentName) filename += `-${studentName.replace(/[^a-zA-Z0-9]/g, '-')}`
		filename += '.pdf'
		
		// Save the PDF
		doc.save(filename)
	}

	onMount(() => {
		loadData()
	})
</script>

<!-- Header -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">My App</a>
		<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-label="Toggle navigation">
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="navbarNav">
			<ul class="navbar-nav ms-auto">
				<li class="nav-item">
					<a class="nav-link" href="#home">Home</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" href="#about">About</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" href="#contact">Contact</a>
				</li>
			</ul>
		</div>
	</div>
</nav>

<main>
	<div class="w-100 mt-4" style="padding: 0 16px; margin: 0; display: flex; width: calc(100vw - 32px); gap: 16px;">
		<!-- Sidebar -->
		<div style="width: 220px; min-width: 220px; flex-shrink: 0;">
			<div class="p-3 border bg-light position-sticky" style="top: 20px; height: calc(100vh - 120px); overflow-y: auto; border-radius: 8px;">
				<h5>Navigation</h5>
				<ul class="nav nav-pills flex-column">
					<li class="nav-item">
						<a class="nav-link active" href="#home">Home</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#about">About</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#services">Services</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#contact">Contact</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Main Content -->
		<div style="flex: 1; min-width: 0;">
			<div class="p-3 border bg-light" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px;">
				<h2>Feedback Manager</h2>
				
				<!-- Student Info Section -->
				<div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: end; width: 100%;">
					<div style="flex: 1;">
						<label for="studentNameInput" class="form-label">Student Name:</label>
						<input 
							id="studentNameInput" 
							type="text" 
							class="form-control" 
							bind:value={studentName} 
							placeholder="Enter student name"
							onchange={saveData}
						>
					</div>
					<div style="flex: 1;">
						<label for="studentImageInput" class="form-label">Student Photo:</label>
						<div class="d-flex align-items-center gap-3">
							<input 
								id="studentImageInput" 
								type="file" 
								class="form-control" 
								accept="image/*"
								onchange={handleImageUpload}
							>
							{#if studentImage}
								<img 
									src={studentImage} 
									alt="Student" 
									class="rounded border"
									style="width: 60px; height: 60px; object-fit: cover;"
								>
							{/if}
						</div>
					</div>
				</div>
				
				<!-- Add Paragraph Form -->
				<div class="mb-3">
					<label for="paragraphInput" class="form-label">Add a new paragraph:</label>
					<div class="input-group">
						<textarea id="paragraphInput" class="form-control" rows="3" bind:value={newParagraph} placeholder="Type your paragraph here..."></textarea>
						<button class="btn btn-primary" type="button" onclick={addParagraph}>Add</button>
					</div>
				</div>

				<!-- Display Paragraphs -->
				<div class="paragraphs">
					{#each paragraphs as paragraph, index}
						<div class="mb-3 p-2 border-start border-primary border-3 bg-white d-flex align-items-start">
							<div class="form-check me-3">
								<input 
									class="form-check-input" 
									type="checkbox" 
									id="paragraph-{index}"
									checked={selectedParagraphs.has(index)}
									onchange={() => toggleParagraph(index)}
								>
								<label class="form-check-label" for="paragraph-{index}">
									Select
								</label>
							</div>
							<p class="mb-0 flex-grow-1">{paragraph}</p>
						</div>
					{/each}
					
					{#if paragraphs.length === 0}
						<p class="text-muted">No paragraphs added yet. Use the textbox above to add your first paragraph.</p>
					{/if}
				</div>

				<!-- Selection Info -->
				{#if selectedParagraphs.size > 0}
					<div class="alert alert-info mt-3">
						<strong>{selectedParagraphs.size}</strong> paragraph{selectedParagraphs.size !== 1 ? 's' : ''} selected
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Selected Text Section -->
{#if selectedParagraphs.size > 0}
	<div class="container-fluid mt-4 mb-4">
		<div class="row">
			<div class="col-12">
				<div class="card">
					<div class="card-header d-flex justify-content-between align-items-center">
						<h5 class="mb-0">Selected Paragraphs</h5>
						<div class="btn-group">
							<button class="btn btn-success btn-sm" onclick={copyToClipboard}>
								📋 Copy to Clipboard
							</button>
							<button class="btn btn-danger btn-sm" onclick={generatePDF}>
								📄 Generate PDF
							</button>
						</div>
					</div>
					<div class="card-body">
						<textarea 
							class="form-control" 
							rows="10" 
							readonly 
							value={getSelectedText()}
							style="font-family: 'Oxygen', helvetica, system-ui, sans-serif; font-size: 10px; line-height: 1.3;"
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Footer -->
<footer class="bg-dark text-light text-center py-3 mt-5">
	<div class="container-fluid">
		<p class="mb-0">&copy; 2025 My App. All rights reserved.</p>
		<small class="text-muted">Built with Bootstrap and Svelte</small>
	</div>
</footer>

<style>
	/* Global reset and font setup */
	:global(html, body) {
		width: 100% !important;
		max-width: 100% !important;
		margin: 0 !important;
		padding: 0 !important;
		overflow-x: hidden !important;
		font-family: 'Oxygen', system-ui, Avenir, Helvetica, Arial, sans-serif !important;
	}
	
	/* Base font sizing - more conservative approach */
	:global(body) {
		font-size: 13px !important;
		line-height: 1.4 !important;
	}
	
	/* Headers */
	:global(h1) { font-size: 24px !important; }
	:global(h2) { font-size: 20px !important; }
	:global(h3) { font-size: 18px !important; }
	:global(h4) { font-size: 16px !important; }
	:global(h5) { font-size: 14px !important; }
	:global(h6) { font-size: 13px !important; }
	
	/* Navigation */
	:global(.navbar) {
		padding: 8px 16px !important;
		font-size: 13px !important;
	}
	
	:global(.navbar-brand) {
		font-size: 18px !important;
		font-weight: 600 !important;
	}
	
	:global(.nav-link) {
		font-size: 12px !important;
		padding: 4px 8px !important;
	}
	
	/* Form elements */
	:global(.form-control) {
		font-family: 'Oxygen', system-ui, sans-serif !important;
		font-size: 12px !important;
		padding: 6px 10px !important;
		line-height: 1.3 !important;
	}
	
	:global(.form-label) {
		font-size: 12px !important;
		font-weight: 500 !important;
		margin-bottom: 4px !important;
	}
	
	/* Buttons */
	:global(.btn) {
		font-size: 12px !important;
		padding: 6px 12px !important;
		line-height: 1.2 !important;
	}
	
	:global(.btn-sm) {
		font-size: 11px !important;
		padding: 4px 8px !important;
	}
	
	/* Cards */
	:global(.card) {
		font-size: 12px !important;
	}
	
	:global(.card-header) {
		padding: 10px 15px !important;
		font-size: 13px !important;
	}
	
	:global(.card-body) {
		padding: 15px !important;
	}
	
	:global(.card-title) {
		font-size: 14px !important;
		margin-bottom: 10px !important;
		font-weight: 600 !important;
	}
	
	/* Text and paragraphs */
	:global(p) {
		font-size: 12px !important;
		line-height: 1.4 !important;
		margin-bottom: 8px !important;
	}
	
	/* Layout fixes */
	:global(.container-fluid) {
		width: 100% !important;
		max-width: 100% !important;
		padding-left: 16px !important;
		padding-right: 16px !important;
	}
	
	:global(.row) {
		margin: 0 -8px !important;
		width: calc(100% + 16px) !important;
		max-width: calc(100% + 16px) !important;
	}
	
	:global(.col-12) {
		padding: 0 8px !important;
	}
	
	/* Main layout spacing */
	:global(.w-100) {
		max-width: 100% !important;
	}
	
	/* Flexbox gap fallback for older browsers */
	:global(.flex-gap-16 > *:not(:last-child)) {
		margin-right: 16px;
	}
	
	/* Alerts */
	:global(.alert) {
		font-size: 12px !important;
		padding: 8px 12px !important;
	}
	
	/* Input groups */
	:global(.input-group) {
		font-size: 12px !important;
	}
	
	/* Form checks */
	:global(.form-check) {
		font-size: 11px !important;
	}
	
	:global(.form-check-label) {
		font-size: 11px !important;
	}
	
	/* Utility */
	:global(.text-muted) {
		font-size: 11px !important;
	}
	
	:global(.small) {
		font-size: 10px !important;
	}
	
	/* Box sizing for all elements */
	:global(*) {
		box-sizing: border-box !important;
	}
</style>
