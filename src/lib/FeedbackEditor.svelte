<script>
	// Props
	export let currentSubject = null
	export let currentAssessment = null
	export let paragraphs = []
	export let selectedParagraphs = new Set()
	export let studentName = ''
	export let studentImage = ''
	export let newParagraph = ''
	export let selectedCategory = ''
	export let needsCategorySelection = false
	export let getCurrentCategories = []
	export let getOrderedParagraphs = []

	// Events
	export let onUpdateStudentName
	export let onAddParagraph
	export let onToggleParagraph
	export let onDeleteParagraph
	export let onHandleImageUpload
</script>

<div class="p-3 border bg-light content-area" style="border-radius: 8px; margin-top: 20px; margin-bottom: 20px;">
	<h2>Feedback for {currentAssessment?.name}</h2>
	<p class="text-muted">Subject: {currentSubject?.name}</p>

	<!-- Student Info Section -->
	<div class="row mb-2 g-3">
		<div class="col-lg-6 col-md-12">
			<label for="studentNameInput" class="form-label">Student Name:</label>
			<input 
				id="studentNameInput" 
				type="text" 
				class="form-control" 
				bind:value={studentName} 
				placeholder="Enter student name"
				onchange={onUpdateStudentName}
			>
		</div>
		<div class="col-lg-6 col-md-12">
			<label for="studentImageInput" class="form-label">Student Photo:</label>
			<div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-3">
				<input 
					id="studentImageInput" 
					type="file" 
					class="form-control flex-grow-1" 
					accept="image/*"
					onchange={onHandleImageUpload}
				>
				{#if studentImage}
					<img 
						src={studentImage} 
						alt="Student" 
						class="rounded border"
						style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0;"
					>
				{/if}
			</div>
		</div>
	</div>

	<!-- Debug info -->
	<div class="alert alert-warning mb-3">
		<small>
			<strong>Debug Info:</strong><br>
			needsCategorySelection: {needsCategorySelection}<br>
			getCurrentCategories length: {getCurrentCategories?.length || 0}<br>
			getOrderedParagraphs length: {getOrderedParagraphs?.length || 0}<br>
			onAddParagraph function: {typeof onAddParagraph}
		</small>
	</div>

	<!-- Add Paragraph Form -->
	<div class="mb-4" style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
		{#if needsCategorySelection}
			<!-- Category selector for Studio 6 and Studio 4 PDR -->
			<div class="mb-3">
				<label for="categorySelect" class="form-label">Select category:</label>
				<select id="categorySelect" class="form-select form-control" bind:value={selectedCategory}>
					<option value="">No category (optional)</option>
					{#each getCurrentCategories as category}
						<option value={category}>{category}</option>
					{/each}
				</select>
				{#if selectedCategory}
					<small class="text-muted">Paragraph will be prefixed with: <strong>{selectedCategory}</strong></small>
				{/if}
			</div>
		{/if}
		
		<label for="paragraphInput" class="form-label">Add a new paragraph:</label>
		<div class="input-group flex-column flex-sm-row">
			<textarea id="paragraphInput" class="form-control mb-2 mb-sm-0" rows="3" bind:value={newParagraph} placeholder="Type your paragraph here..."></textarea>
			<button class="btn btn-primary" type="button" onclick={onAddParagraph}>Add</button>
		</div>
	</div>


	<!-- Display Paragraphs -->
	<div class="paragraphs">
		{#each getOrderedParagraphs as { paragraph, originalIndex }}
			<div class="mb-3 p-2 border-start border-primary border-3 bg-white d-flex flex-column flex-sm-row align-items-start">
				<div class="form-check me-sm-3 mb-2 mb-sm-0 d-flex align-items-center">
					<input 
						class="form-check-input me-2" 
						type="checkbox" 
						id="paragraph-{originalIndex}"
						checked={selectedParagraphs.has(originalIndex)}
						onchange={() => onToggleParagraph(originalIndex)}
					>
					<label class="form-check-label" for="paragraph-{originalIndex}">
						Select
					</label>
				</div>
				<p class="mb-0 flex-grow-1">{paragraph}</p>
				<button 
					class="btn btn-outline-danger btn-sm ms-sm-2 mt-2 mt-sm-0 delete-btn align-self-start" 
					onclick={() => onDeleteParagraph(originalIndex)}
					title="Delete paragraph"
				>
					×
				</button>
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
