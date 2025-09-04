<script>
	// Props
	export let currentSubject = null
	export let onSelectAssessment
</script>

<div class="p-3 border bg-light content-area" style="border-radius: 8px; margin-top: 20px; margin-bottom: 20px;">
	<h2>{currentSubject?.name}</h2>
	<p>Select an assessment to start working on feedback, or create a new assessment.</p>
	
	{#if currentSubject?.assessments?.length > 0}
		<div class="row">
			{#each currentSubject?.assessments || [] as assessment}
				<div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-4">
					<div class="card h-100 shadow-sm border-0 assessment-card">
						<div class="card-body d-flex flex-column text-center p-4">
							<div class="assessment-icon mb-3">
								📝
							</div>
							<h5 class="card-title mb-4 text-success fw-bold">{assessment.name}</h5>
							<button class="btn btn-success w-100 mt-auto assessment-btn" onclick={() => onSelectAssessment(assessment)}>
								Open
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
