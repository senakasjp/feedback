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
					<div class="card-header d-flex justify-content-between align-items-center">
						<h5 class="mb-0">Selected Paragraphs for {currentAssessment?.name}</h5>
						<div class="btn-group">
							<button class="btn btn-success btn-sm" onclick={onCopyToClipboard}>
								📋 Copy to Clipboard
							</button>
							<button class="btn btn-danger btn-sm" onclick={onGeneratePDF}>
								📄 Print to Download
							</button>
						</div>
					</div>
					<div class="card-body">
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
