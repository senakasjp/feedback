<script>
  let { show = $bindable(false), onClose = () => {} } = $props();

  function handleClose() {
    show = false;
    onClose();
  }
</script>

{#if show}
  <div class="modal fade show" tabindex="-1" style="display: block; background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">About Feedback Manager</h5>
          <button type="button" class="btn-close btn-close-white" aria-label="Close" onclick={handleClose}></button>
        </div>
        <div class="modal-body">
          <div class="text-center mb-4">
            <h4 class="fw-bold">Feedback Manager</h4>
            <p class="text-muted">Version 3.2.4</p>
          </div>

          <div class="mb-4">
            <h6 class="fw-bold mb-2">Developed by:</h6>
            <p class="mb-1">Senaka Amarakeerthi</p>
            <p class="mb-1">Otago Polytechnic Auckland International Campus</p>
            <p class="mb-1">Auckland</p>
            <p class="mb-0">New Zealand</p>
          </div>

          <hr>

          <div class="mt-3">
            <p class="small text-muted mb-0">
              A comprehensive feedback management system for educational institutions.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" onclick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  </div>
{/if}
