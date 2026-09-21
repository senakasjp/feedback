<script>
  import { renderDocxSource, docxFrameHtml } from '../utils/docxPreview.js'
  let { source, name } = $props()
  let preview = $state(null)
  let error = $state('')
  let loading = $state(false)
  let width = $state(800)
  let zoom = $state('fit')
  const scale = $derived(zoom === 'fit' ? Math.min(1, Math.max(0.1, width / ((preview?.pageWidth || 816) + 32))) : Number(zoom))
  $effect(() => {
    const original = source
    let cancelled = false
    preview = null
    error = ''
    loading = true
    renderDocxSource(original).then(result => {
      if (!cancelled) preview = result
    }).catch(reason => {
      if (!cancelled) error = `Unable to open this DOCX: ${reason.message}`
    }).finally(() => {
      if (!cancelled) loading = false
    })
    return () => { cancelled = true }
  })
</script>

<div bind:clientWidth={width} class="docx-document">
  {#if loading}
    <p role="status">Opening Word document…</p>
  {:else if error}
    <p role="alert" class="text-danger">{error}</p>
  {:else if preview}
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <label for="docx-zoom" class="form-label mb-0">Zoom</label>
      <select id="docx-zoom" class="form-select form-select-sm w-auto" bind:value={zoom}>
        <option value="fit">Fit width</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
        <option value="1.5">150%</option>
      </select>
      <span class="small text-muted">Original document pages</span>
    </div>
    <iframe title={`DOCX preview: ${name}`} sandbox="" srcdoc={docxFrameHtml(preview.markup, scale)}></iframe>
  {/if}
</div>

<style>
  .docx-document { min-width: 0; width: 100%; }
  iframe { width: 100%; height: 75vh; min-height: 320px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); }
</style>
