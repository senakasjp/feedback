<script>
  import { onDestroy } from 'svelte'
  let active = true
  onDestroy(() => { active = false })
  import DocxDocument from './DocxDocument.svelte'
  import { readDocxSource, renderDocxSource } from '../utils/docxPreview.js'
  let { assessmentDocuments = [], studentDocuments = [], studentName = '', hasStudent = false, getDocumentTypeLabel, onAttachOriginal } = $props()
  let selectedKey = $state('')
  let attaching = $state(false)
  let attachError = $state('')
  async function attachOriginal(event) {
    const file = event.currentTarget.files?.[0]
    const target = selected
    if (!file || !target) return
    attachError = ''
    if (file.name.toLowerCase() !== target.document.name.toLowerCase()) {
      attachError = `Choose the original file named ${target.document.name}.`
      return
    }
    attaching = true
    try {
      const source = await readDocxSource(file)
      await renderDocxSource(source)
      if (!active) return
      await onAttachOriginal(target.document.id, target.scope === 'Student upload' ? 'student' : 'assessment', source)
    } catch (error) {
      attachError = error.message
    } finally {
      attaching = false
    }
  }
  const documents = $derived([
    ...assessmentDocuments.filter(document => /\.docx$/i.test(document.name || '')).map(document => ({ document, key: `assessment:${document.id}`, scope: 'Assessment reference' })),
    ...(hasStudent ? studentDocuments.filter(document => /\.docx$/i.test(document.name || '')).map(document => ({ document, key: `student:${document.id}`, scope: 'Student upload' })) : [])
  ])
  const selected = $derived(documents.find(item => item.key === selectedKey) ?? documents[0])
</script>

<section class="card document-viewer" aria-label="DOCX viewer">
  <div class="card-header">
    <h2 class="card-title h5 mb-0">DOCX viewer</h2>
  </div>
  <div class="card-body">
    <p class="text-muted">View the original DOCX with its page sizes, margins, formatting, tables, headers, and images. Complex Word layouts may render differently.</p>
    {#if !hasStudent}
      <p class="text-muted small">Select a student to view their uploaded files alongside the assessment references.</p>
    {:else}
      <p class="small">Student: <strong>{studentName}</strong></p>
    {/if}
    {#if documents.length === 0}
      <p class="mb-0">No uploaded DOCX documents yet. Add assessment references in Settings or student files in Enter Data.</p>
    {:else}
      <label for="uploaded-document-select" class="form-label fw-semibold">Choose a document</label>
      <select id="uploaded-document-select" class="form-select mb-3" value={selected?.key} disabled={attaching} onchange={event => { selectedKey = event.currentTarget.value; attachError = '' }}>
        {#each ['Assessment reference', 'Student upload'] as scope}
          {#if documents.some(item => item.scope === scope)}
            <optgroup label={scope}>
              {#each documents.filter(item => item.scope === scope) as item (item.key)}
                <option value={item.key}>{item.document.name}</option>
              {/each}
            </optgroup>
          {/if}
        {/each}
      </select>
      {#if selected}
        <article aria-label={`Content of ${selected.document.name}`}>
          <h3 class="h5 document-name">{selected.document.name}</h3>
          <p class="small text-muted">{selected.scope} · {getDocumentTypeLabel(selected.document.documentType, selected.scope === 'Student upload' ? 'student' : 'assessment')}</p>
          {#if selected.document.docxBase64}
            <DocxDocument source={selected.document.docxBase64} name={selected.document.name} />
          {:else}
            <p>The original Word file was not retained with this older upload. Choose it once below to view and save the actual document.</p>
            <label for="attach-original-docx" class="form-label fw-semibold">Attach original DOCX</label>
            <input id="attach-original-docx" type="file" class="form-control" accept=".docx" disabled={attaching} onchange={attachOriginal} />
            {#if attaching}<p role="status" class="mt-2">Opening and saving original document…</p>{/if}
            {#if attachError}<p role="alert" class="text-danger mt-2">{attachError}</p>{/if}
          {/if}
        </article>
      {/if}
    {/if}
  </div>
</section>

<style>
  .document-viewer { min-width: 0; }
  .document-name, .document-text { overflow-wrap: anywhere; }
  .document-text {
    white-space: pre-wrap;
    background: var(--ui-soft);
    color: var(--ui-ink);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    padding: var(--ui-space-4);
    line-height: 1.55;
  }

</style>
