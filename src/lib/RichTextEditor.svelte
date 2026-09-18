<script>
	// Props
	let { 
		value = '',
		onChange = () => {},
		placeholder = 'Enter text...',
		readonly = false,
		rows = 10
	} = $props()

	// Local state
	let editorRef = $state(null)
	let isBold = $state(false)
	let currentFontColor = $state('#000000')

	// Handle text changes
	function handleInput(event) {
		const newValue = event.target.innerHTML
		onChange(newValue)
	}

	// Handle bold formatting
	function toggleBold() {
		if (readonly) return
		
		document.execCommand('bold', false, null)
		updateBoldState()
		onChange(editorRef.innerHTML)
	}

	// Handle font color change
	function changeFontColor(color) {
		if (readonly) return
		
		document.execCommand('foreColor', false, color)
		updateFontColorState()
		onChange(editorRef.innerHTML)
	}

	// Update bold button state
	function updateBoldState() {
		if (editorRef) {
			isBold = document.queryCommandState('bold')
		}
	}

	// Update font color state
	function updateFontColorState() {
		if (editorRef) {
			const color = document.queryCommandValue('foreColor')
			currentFontColor = color || '#000000'
		}
	}

	// Handle selection change
	function handleSelectionChange() {
		if (editorRef && !readonly) {
			updateBoldState()
			updateFontColorState()
		}
	}

	// Set initial value
	$effect(() => {
		if (editorRef && value !== editorRef.innerHTML) {
			editorRef.innerHTML = value
		}
	})

	// Add event listeners
	$effect(() => {
		if (editorRef && !readonly) {
			document.addEventListener('selectionchange', handleSelectionChange)
			return () => {
				document.removeEventListener('selectionchange', handleSelectionChange)
			}
		}
	})
</script>

<div class="rich-text-editor">
	{#if !readonly}
		<!-- Toolbar -->
		<div class="toolbar d-flex gap-1 p-2 border-bottom bg-light">
			<button 
				type="button"
				class="btn btn-outline-secondary btn-sm"
				class:active={isBold}
				onclick={toggleBold}
				title="Bold (Ctrl+B)"
				aria-label="Bold text"
			>
				<i class="bi bi-type-bold"></i>
			</button>
			
			<div class="d-flex align-items-center">
				<label for="font-color-picker" class="form-label mb-0 me-1" style="font-size: 0.8rem;">Color:</label>
				<input 
					id="font-color-picker"
					type="color"
					class="form-control form-control-sm"
					style="width: 40px; height: 32px; padding: 2px;"
					value={currentFontColor}
					onchange={(e) => changeFontColor(e.currentTarget.value)}
					title="Font Color"
					aria-label="Font Color"
				/>
			</div>
		</div>
	{/if}
	
	<!-- Editor -->
	<div 
		bind:this={editorRef}
		class="editor form-control"
		class:readonly
		contenteditable={!readonly}
		oninput={handleInput}
		onpaste={(e) => {
			// Allow paste but strip formatting to keep it simple
			e.preventDefault()
			const text = e.clipboardData.getData('text/plain')
			document.execCommand('insertText', false, text)
		}}
		style="
			min-height: {rows * 1.5}rem;
			font-family: 'Roboto', system-ui, sans-serif;
			font-size: 13px;
			line-height: 1.3;
			overflow-y: auto;
			white-space: pre-wrap;
		"
		data-placeholder={placeholder}
	></div>
</div>

<style>
	.rich-text-editor {
		border: 1px solid #ced4da;
		border-radius: 0.375rem;
		background-color: white;
	}

	.rich-text-editor .toolbar {
		border-radius: 0.375rem 0.375rem 0 0;
	}

	.rich-text-editor .editor {
		border: none;
		border-radius: 0 0 0.375rem 0.375rem;
		padding: 0.375rem 0.75rem;
	}

	.rich-text-editor .editor.readonly {
		background-color: #f8f9fa;
		cursor: default;
	}

	.rich-text-editor .editor:focus {
		outline: none;
		box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
	}

	.rich-text-editor .editor:empty:before {
		content: attr(data-placeholder);
		color: #6c757d;
		pointer-events: none;
	}

	.rich-text-editor .toolbar .btn.active {
		background-color: #0d6efd;
		border-color: #0d6efd;
		color: white;
	}

	.rich-text-editor .toolbar .btn:hover {
		background-color: #e9ecef;
	}

	.rich-text-editor .toolbar .btn.active:hover {
		background-color: #0b5ed7;
		border-color: #0a58ca;
	}
</style>
