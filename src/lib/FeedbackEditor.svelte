<script lang="ts">
	// Types
		type Category = {
		id: string;
		name: string;
		description?: string;
	}

	type Topic = {
		id: string;
		name: string;
	}
	
	type Assessment = {
		id: string;
		name: string;
		topics?: Topic[];
		categories?: Category[];
	}
	
	type Subject = {
		id: string;
		name: string;
		assessments: Assessment[];
	}

	type OrderedParagraph = {
		paragraph: string;
		originalIndex: number;
		topicId?: string;
		categoryId?: string;
		color?: string;
	}

	// Props
	let { 
		currentSubject = null,
		currentAssessment = null,
		selectedParagraphs = new Set(),
		studentName = '',
		studentImage = '',
		newParagraph = '',
		selectedCategory = '',
		selectedTopic = '',
		getOrderedParagraphs = [],
		onUpdateStudentName,
		onAddParagraph,
		onToggleParagraph,
		onDeleteParagraph,
		onHandleImageUpload
	}: {
		currentSubject?: Subject | null;
		currentAssessment?: Assessment | null;
		selectedParagraphs?: Set<number>;
		studentName?: string;
		studentImage?: string;
		newParagraph?: string;
		selectedCategory?: string;
		selectedTopic?: string;
		getOrderedParagraphs?: OrderedParagraph[];
		onUpdateStudentName: () => void;
		onAddParagraph: () => void;
		onToggleParagraph: (index: number) => void;
		onDeleteParagraph: (index: number) => void;
		onHandleImageUpload: (event: Event) => void;
	} = $props()

	// Color badge function
	function getColorBadgeClass(color) {
		switch(color) {
			case 'red': return 'bg-danger'
			case 'orange': return 'bg-warning'
			case 'yellow': return 'bg-warning text-dark'
			case 'lightgreen': return 'bg-success'
			case 'green': return 'bg-success'
			default: return 'bg-secondary'
		}
	}

	// Local state
	let selectedTopicFilter = $state('')
	let selectedCategoryFilter = $state('')

	// Computed
	let availableTopics = $derived((currentAssessment?.topics || []) as Topic[])
	let availableCategories = $derived((currentAssessment?.categories || []) as Category[])
	let filteredParagraphs = $derived(getOrderedParagraphs.filter(p => {
		const matchesTopic = !selectedTopicFilter || p.topicId === selectedTopicFilter
		const matchesCategory = !selectedCategoryFilter || p.categoryId === selectedCategoryFilter
		return matchesTopic && matchesCategory
	}))
</script>

<div class="feedback-editor-container">
	<h2>Feedback for {currentAssessment?.name || 'No Assessment Selected'}</h2>
	<p class="text-muted">Subject: {currentSubject?.name || 'No Subject Selected'}</p>

	<!-- Student Info Section -->
	<div class="row mb-2 g-2">
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


	<!-- Add Paragraph Form -->
	<div class="add-paragraph-form">
		<h4>Add New Paragraph</h4>
		<div class="row g-2 mb-2">
			<!-- Category selector -->
			<div class="col-md-6">
				<label for="categorySelect" class="form-label">Select category:</label>
				<select id="categorySelect" class="form-select form-control" bind:value={selectedCategory}>
					<option value="">No category (optional)</option>
					{#each availableCategories as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
				{#if availableCategories.length === 0}
					<small class="text-warning">No categories available. Add categories in the assessment manager.</small>
				{/if}
			</div>

			<!-- Topic selector -->
			<div class="col-md-6">
				<label for="topicSelect" class="form-label">Select topic:</label>
				<select id="topicSelect" class="form-select form-control" bind:value={selectedTopic}>
					<option value="">No topic (optional)</option>
					{#each availableTopics as topic}
						<option value={topic.id}>{topic.name}</option>
					{/each}
				</select>
				{#if availableTopics.length === 0}
					<small class="text-warning">No topics available. Add topics in the assessment manager.</small>
				{/if}
				{#if selectedTopic}
					<small class="text-muted">Selected topic: <strong>{availableTopics.find(t => t.id === selectedTopic)?.name}</strong></small>
				{/if}
			</div>
		</div>
		
		<label for="paragraphInput" class="form-label">Add a new paragraph:</label>
		<div class="input-group flex-column flex-sm-row">
			<textarea id="paragraphInput" class="form-control mb-2 mb-sm-0" rows="3" bind:value={newParagraph} placeholder="Type your paragraph here..."></textarea>
			<button class="btn btn-primary" type="button" onclick={onAddParagraph}>Add</button>
		</div>
	</div>


	<!-- Filters -->
	<div class="mb-3">
		<h6 class="mb-2">Filter paragraphs:</h6>
		<div class="row g-2">
			<div class="col-md-6">
				<label for="categoryFilter" class="form-label">By category:</label>
				<select id="categoryFilter" class="form-select" bind:value={selectedCategoryFilter}>
					<option value="">All categories</option>
					{#each availableCategories as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
				{#if availableCategories.length === 0}
					<small class="text-muted">No categories to filter by</small>
				{/if}
			</div>

			<div class="col-md-6">
				<label for="topicFilter" class="form-label">By topic:</label>
				<select id="topicFilter" class="form-select" bind:value={selectedTopicFilter}>
					<option value="">All topics</option>
					{#each availableTopics as topic}
						<option value={topic.id}>{topic.name}</option>
					{/each}
				</select>
				{#if availableTopics.length === 0}
					<small class="text-muted">No topics to filter by</small>
				{/if}
			</div>
		</div>
	</div>

	<!-- Display Paragraphs -->
	<div class="paragraphs">
		{#each filteredParagraphs as { paragraph, originalIndex, topicId, categoryId }}
			<div class="paragraph-item mb-2 p-2 border-start border-primary border-3 bg-white">
				<div class="d-flex flex-column flex-sm-row align-items-start">
					<div class="form-check me-sm-3 mb-2 mb-sm-0 d-flex flex-column align-items-start">
						<div class="d-flex align-items-center">
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
						<!-- Color indicator -->
						{#if paragraph.color}
							<div class="mt-1">
								<span class="badge {getColorBadgeClass(paragraph.color)}">
									{paragraph.color}
								</span>
							</div>
						{/if}
					</div>
					<div class="flex-grow-1">
						<p class="mb-0">{paragraph}</p>
					</div>
					<button 
						class="btn btn-outline-danger btn-sm ms-sm-2 mt-2 mt-sm-0 delete-btn align-self-start" 
						onclick={() => onDeleteParagraph(originalIndex)}
						title="Delete paragraph"
					>
						×
					</button>
				</div>
			</div>
		{/each}
		
		{#if filteredParagraphs.length === 0}
			{#if selectedTopicFilter || selectedCategoryFilter}
				<p class="text-muted">No paragraphs found for the selected filters.</p>
			{:else}
				<p class="text-muted">No paragraphs added yet. Use the textbox above to add your first paragraph.</p>
			{/if}
		{/if}
	</div>

	<!-- Selection Info -->
	{#if selectedParagraphs.size > 0}
		<div class="alert alert-info mt-3">
			<strong>{selectedParagraphs.size}</strong> paragraph{selectedParagraphs.size !== 1 ? 's' : ''} selected
		</div>
	{/if}
</div>
