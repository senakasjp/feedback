<script lang="ts">
	// Props
	let { 
		subjects = [],
		onSelectSubject,
		onDeleteSubject
	}: {
		subjects?: any[];
		onSelectSubject?: (subject: any) => void;
		onDeleteSubject?: (subject: any) => void;
	} = $props()
</script>

<div class="p-3 border bg-light rounded" style="margin-top: 20px; margin-bottom: 20px;">
	<h2>Welcome to Feedback Manager</h2>
	<p>Select a subject from the sidebar to get started, or create a new subject.</p>
	
	{#if subjects.length > 0}
		<div class="row">
			{#each subjects as subject}
				<div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-4">
					<div class="card h-100 shadow-sm border-0">
						<div class="card-body d-flex flex-column text-center p-4 position-relative">
							<!-- Delete button in top-right corner -->
							<button 
								class="btn btn-outline-danger btn-sm position-absolute top-0 end-0 m-2 delete-subject-btn border-0" 
								style="border: none !important; outline: none !important; box-shadow: none !important;"
								onclick={(e) => {
									console.log('Delete button clicked!', subject.name);
									e.stopPropagation(); 
									onDeleteSubject(subject);
								}}
								title="Delete subject"
							>
								×
							</button>
							
							<div class="subject-icon mb-3">
								📚
							</div>
							<h5 class="card-title mb-3 text-primary fw-bold">{subject.name}</h5>
							<p class="card-text text-muted mb-3 flex-grow-1" style="overflow: hidden; text-overflow: ellipsis;">
								{subject.assessments.length} assessment{subject.assessments.length !== 1 ? 's' : ''}
							</p>
							<button class="btn btn-primary w-100 mt-auto subject-btn" onclick={() => onSelectSubject(subject)}>
								Open
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
