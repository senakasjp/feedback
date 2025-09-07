<script>
	// Props
	let { 
		currentAssessment = null,
		selectedParagraphs = new Set(),
		onCopyToClipboard,
		onGeneratePDF,
		onGetSelectedText
	} = $props()
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
						<div class="d-flex justify-content-end gap-2 mb-3">
							<button class="btn btn-success btn-sm" onclick={onCopyToClipboard}>
								<i class="bi bi-clipboard me-2"></i>Copy to Clipboard
							</button>
							<button class="btn btn-danger btn-sm" onclick={onGeneratePDF}>
								<i class="bi bi-download me-2"></i>Download PDF
							</button>
						</div>
						<textarea 
							class="form-control" 
							rows="10" 
							readonly 
							value={onGetSelectedText()}
							style="font-family: 'Roboto', system-ui, sans-serif; font-size: 13px; line-height: 1.3;"
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
