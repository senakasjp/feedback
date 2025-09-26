<script>
	import RichTextEditor from './RichTextEditor.svelte'
	
	// Props
	let { 
		currentAssessment = null,
		selectedParagraphs = new Set(),
		onCopyToClipboard,
		onGeneratePDF,
		onGetSelectedText
	} = $props()

	// Local state for rich text editing
	let formattedText = $state('')
	let isEditing = $state(false)

	// Initialize formatted text
	$effect(() => {
		if (selectedParagraphs.size > 0) {
			formattedText = onGetSelectedText()
		}
	})

	// Handle text changes in editor
	function handleTextChange(newText) {
		formattedText = newText
	}

	// Toggle edit mode
	function toggleEdit() {
		isEditing = !isEditing
		if (!isEditing) {
			// When exiting edit mode, update the formatted text
			formattedText = onGetSelectedText()
		}
	}

	// Copy formatted text to clipboard
	function copyFormattedText() {
		// Convert HTML to plain text for clipboard
		const tempDiv = document.createElement('div')
		tempDiv.innerHTML = formattedText
		const plainText = tempDiv.textContent || tempDiv.innerText || ''
		
		navigator.clipboard.writeText(plainText).then(() => {
			// Show success feedback
			console.log('Text copied to clipboard')
		}).catch(err => {
			console.error('Failed to copy text: ', err)
		})
	}
</script>

<!-- Selected Text Section - Only show when in feedback mode with selections -->
{#if currentAssessment && selectedParagraphs.size > 0}
	<div class="container-fluid mt-4 mb-4">
		<div class="row">
			<div class="col-12">
				<div class="card">
					<div class="card-header bg-primary text-white">
						<h5 class="mb-0">
							<i class="bi bi-check-square me-2"></i>Selected Paragraphs for {currentAssessment?.name}
						</h5>
					</div>
					<div class="card-body">
						<div class="d-flex justify-content-between align-items-center mb-3">
							<div class="d-flex gap-2">
								<button 
									class="btn btn-outline-primary btn-sm" 
									onclick={toggleEdit}
									class:btn-primary={isEditing}
									class:btn-outline-primary={!isEditing}
								>
									<i class="bi bi-{isEditing ? 'check' : 'pencil'} me-2"></i>
									{isEditing ? 'Save' : 'Edit'}
								</button>
							</div>
							<div class="d-flex gap-2">
								<button class="btn btn-success btn-sm" onclick={copyFormattedText}>
									<i class="bi bi-clipboard me-2"></i>Copy to Clipboard
								</button>
								<button class="btn btn-danger btn-sm" onclick={onGeneratePDF}>
									<i class="bi bi-download me-2"></i>Download PDF
								</button>
							</div>
						</div>
						<RichTextEditor 
							value={formattedText}
							onChange={handleTextChange}
							readonly={!isEditing}
							rows={10}
							placeholder="Selected paragraphs will appear here..."
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
