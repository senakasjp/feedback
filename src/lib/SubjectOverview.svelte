<script lang="ts">
	import CategoryEditor from './CategoryEditor.svelte';

	// Props
	let { currentSubject = null, onSelectAssessment } = $props()
	
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
		headerPhoto?: string;
	}
	
	type Subject = {
		id: string;
		name: string;
		assessments: Assessment[];
	}
	
	// Local state
	let newTopic = $state('')
	let editingAssessmentId = $state(null)
	
	// Type assertion
	let typedSubject = $derived(currentSubject as Subject)
	
	// Initialize topics array if it doesn't exist
	function ensureTopics(assessment) {
		if (!assessment.topics) {
			assessment.topics = []
		}
		return assessment
	}
	
	function addTopic(assessment) {
		if (newTopic.trim()) {
			ensureTopics(assessment)
			assessment.topics.push({
				id: Date.now().toString(),
				name: newTopic.trim()
			})
			newTopic = ''
			editingAssessmentId = null
		}
	}
	
	function removeTopic(assessment, topicId) {
		ensureTopics(assessment)
		assessment.topics = assessment.topics.filter(t => t.id !== topicId)
	}
</script>

<div class="content-area">
	<div class="mb-4">
		<h2>{typedSubject?.name || 'No Subject Selected'}</h2>
		<p class="text-muted">Select an assessment to start working on feedback, or create a new assessment.</p>
	</div>
	
	{#if typedSubject?.assessments?.length > 0}
		<div class="assessments-stack">
			<div class="stack-header mb-4">
				<h4 class="mb-1">Assessments</h4>
				<p class="text-muted mb-0">{typedSubject.assessments.length} assessment{typedSubject.assessments.length !== 1 ? 's' : ''} available</p>
			</div>
			<div class="assessments-list">
				{#each typedSubject.assessments as assessment, index}
					<div class="assessment-card-stack" style="z-index: {typedSubject.assessments.length - index};">
						<div class="assessment-card-content">
							<div class="assessment-header">
								<div class="assessment-icon">📝</div>
								<div class="assessment-info">
									<h5 class="assessment-title">{assessment.name}</h5>
									<div class="assessment-meta">
										<span class="badge bg-info me-2">{assessment.topics?.length || 0} topics</span>
										<span class="badge bg-primary">{assessment.categories?.length || 0} categories</span>
									</div>
								</div>
								<button class="btn btn-success assessment-btn" onclick={() => onSelectAssessment(assessment)}>
									Open Feedback
								</button>
							</div>
							
							<div class="assessment-details">
								<!-- Topics Section -->
								<div class="topics-section">
									<h6 class="section-title">Topics</h6>
									{#if assessment.topics?.length > 0}
										<div class="topics-list">
											{#each assessment.topics as topic}
												<div class="topic-item">
													<span class="badge bg-info me-2">{topic.name}</span>
													<button 
														class="btn btn-sm btn-outline-danger delete-btn border-0" 
														onclick={() => removeTopic(assessment, topic.id)}
														title="Remove topic"
													>×</button>
												</div>
											{/each}
										</div>
									{:else}
										<p class="text-muted small">No topics added yet</p>
									{/if}
									
									{#if editingAssessmentId === assessment.id}
										<div class="add-topic-form input-group input-group-sm mt-2">
											<input
												type="text"
												class="form-control form-control-sm"
												placeholder="Enter topic name"
												bind:value={newTopic}
												onkeydown={(e) => e.key === 'Enter' && addTopic(assessment)}
											>
											<button 
												class="btn btn-outline-primary"
												onclick={() => addTopic(assessment)}
											>Add</button>
										</div>
									{:else}
										<button 
											class="btn btn-sm btn-outline-primary mt-2"
											onclick={() => editingAssessmentId = assessment.id}
										>
											Add Topic
										</button>
									{/if}
								</div>

								<!-- Categories Section -->
								<div class="categories-section">
									<h6 class="section-title">Categories</h6>
									{#if !assessment.categories}
										{@const categories = []}
										{assessment.categories = categories}
									{/if}
									<CategoryEditor bind:categories={assessment.categories} />
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
