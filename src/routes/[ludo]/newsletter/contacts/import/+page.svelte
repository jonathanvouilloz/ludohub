<script lang="ts">
  import { toast } from '$lib/components/ui/sonner/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Table from '$lib/components/ui/table/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2'

  let { data } = $props()
  const slug = $derived(data.ludo.slug)

  type Step = 'upload' | 'mapping' | 'done'
  let step = $state<Step>('upload')
  let busy = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  let headers = $state<string[]>([])
  let rows = $state<string[][]>([])

  // Index de colonne sous forme de chaîne ('-1' = non mappé) pour les <select>.
  let emailCol = $state('-1')
  let firstCol = $state('-1')
  let lastCol = $state('-1')

  let result = $state<{ added: number; invalid: number; duplicates: number } | null>(null)

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  async function errorMessage(res: Response): Promise<string> {
    const body = await res.json().catch(() => null)
    return body?.message ?? 'Une erreur est survenue.'
  }

  function guessColumn(cols: string[], needles: string[]): number {
    const lc = cols.map((h) => h.toLowerCase())
    for (let i = 0; i < lc.length; i++) {
      if (needles.some((n) => lc[i].includes(n))) return i
    }
    return -1
  }

  async function onUpload(e: SubmitEvent) {
    e.preventDefault()
    const file = fileInput?.files?.[0]
    if (!file) {
      toast.error('Sélectionnez un fichier.')
      return
    }
    busy = true
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/newsletter/contacts/import?step=parse', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        toast.error(await errorMessage(res))
        return
      }
      const parsed = (await res.json()) as { headers: string[]; rows: string[][] }
      headers = parsed.headers
      rows = parsed.rows
      emailCol = String(guessColumn(headers, ['email', 'e-mail', 'mail', 'courriel']))
      firstCol = String(guessColumn(headers, ['prénom', 'prenom', 'first']))
      lastCol = String(guessColumn(headers, ['nom', 'last', 'name']))
      // « nom » ne doit pas pointer la même colonne que l'email.
      if (lastCol === emailCol) lastCol = '-1'
      step = 'mapping'
    } finally {
      busy = false
    }
  }

  const emailIdx = $derived(parseInt(emailCol, 10))
  const sample = $derived(rows.slice(0, 5))

  const stats = $derived.by(() => {
    if (emailIdx < 0) return { valid: 0, invalid: 0, duplicates: 0 }
    const seen = new Set<string>()
    let valid = 0
    let invalid = 0
    let duplicates = 0
    for (const r of rows) {
      const email = (r[emailIdx] ?? '').trim().toLowerCase()
      if (!email || !EMAIL_RE.test(email)) {
        invalid++
        continue
      }
      if (seen.has(email)) {
        duplicates++
        continue
      }
      seen.add(email)
      valid++
    }
    return { valid, invalid, duplicates }
  })

  async function onCommit() {
    if (emailIdx < 0) {
      toast.error('Indiquez la colonne contenant les emails.')
      return
    }
    busy = true
    try {
      const mapping = {
        email: emailIdx,
        firstName: parseInt(firstCol, 10) >= 0 ? parseInt(firstCol, 10) : null,
        lastName: parseInt(lastCol, 10) >= 0 ? parseInt(lastCol, 10) : null,
      }
      const res = await fetch('/api/newsletter/contacts/import?step=commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mapping, rows }),
      })
      if (!res.ok) {
        toast.error(await errorMessage(res))
        return
      }
      result = (await res.json()) as typeof result
      step = 'done'
    } finally {
      busy = false
    }
  }
</script>

<svelte:head>
  <title>Importer des contacts — {data.ludo.name}</title>
</svelte:head>

<main class="import">
  <header class="head">
    <div>
      <h1>Importer des contacts</h1>
      <p class="muted">Depuis un fichier CSV ou Excel (.xlsx). Première ligne = en-têtes.</p>
    </div>
    <Button href={`/${slug}/newsletter/contacts`} variant="outline">Retour aux contacts</Button>
  </header>

  {#if step === 'upload'}
    <section class="card">
      <form onsubmit={onUpload}>
        <div class="field">
          <Label for="import-file">Fichier</Label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            bind:this={fileInput}
            required
          />
          <p class="hint">
            Colonnes attendues : email (obligatoire), prénom et nom (facultatifs). Séparateur
            <code>,</code> ou <code>;</code> détecté automatiquement.
          </p>
        </div>
        <div class="actions">
          <Button type="submit" disabled={busy}>
            <UploadIcon aria-hidden="true" />
            {busy ? 'Lecture…' : 'Lire le fichier'}
          </Button>
        </div>
      </form>
    </section>
  {:else if step === 'mapping'}
    <section class="card">
      <h2>Associez les colonnes</h2>
      <div class="map-grid">
        <div class="field">
          <Label for="map-email">Email <span class="req">*</span></Label>
          <select id="map-email" bind:value={emailCol}>
            <option value="-1">— Choisir —</option>
            {#each headers as h, i (i)}
              <option value={String(i)}>{h}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <Label for="map-first">Prénom</Label>
          <select id="map-first" bind:value={firstCol}>
            <option value="-1">— Ignorer —</option>
            {#each headers as h, i (i)}
              <option value={String(i)}>{h}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <Label for="map-last">Nom</Label>
          <select id="map-last" bind:value={lastCol}>
            <option value="-1">— Ignorer —</option>
            {#each headers as h, i (i)}
              <option value={String(i)}>{h}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="stats">
        <span class="stat stat--ok">{stats.valid} valides</span>
        <span class="stat stat--warn">{stats.duplicates} doublons</span>
        <span class="stat stat--bad">{stats.invalid} invalides</span>
        <span class="stat-note"
          >sur {rows.length} lignes (doublons existants vérifiés à l'import)</span
        >
      </div>

      {#if sample.length > 0}
        <div class="preview">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                {#each headers as h, i (i)}
                  <Table.Head class={i === emailIdx ? 'col-email' : ''}>{h}</Table.Head>
                {/each}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each sample as r, ri (ri)}
                <Table.Row>
                  {#each r as cell, i (i)}
                    <Table.Cell class={i === emailIdx ? 'col-email' : ''}>{cell}</Table.Cell>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
        <p class="hint">Aperçu des {sample.length} premières lignes.</p>
      {/if}

      <div class="actions">
        <Button variant="outline" onclick={() => (step = 'upload')} disabled={busy}>
          Changer de fichier
        </Button>
        <Button onclick={onCommit} disabled={busy || stats.valid === 0}>
          {busy ? 'Import…' : `Importer ${stats.valid} contact${stats.valid > 1 ? 's' : ''}`}
        </Button>
      </div>
    </section>
  {:else if step === 'done' && result}
    <section class="card done">
      <CheckCircle2Icon class="done-icon" aria-hidden="true" />
      <h2>Import terminé</h2>
      <p class="summary">
        <strong>{result.added}</strong> contact{result.added > 1 ? 's' : ''} ajouté{result.added > 1
          ? 's'
          : ''}.
        {#if result.duplicates > 0}
          {result.duplicates} doublon{result.duplicates > 1 ? 's' : ''} ignoré{result.duplicates > 1
            ? 's'
            : ''}.
        {/if}
        {#if result.invalid > 0}
          {result.invalid} email{result.invalid > 1 ? 's' : ''} invalide{result.invalid > 1
            ? 's'
            : ''} ignoré{result.invalid > 1 ? 's' : ''}.
        {/if}
      </p>
      <div class="actions">
        <Button href={`/${slug}/newsletter/contacts`}>Voir les contacts</Button>
      </div>
    </section>
  {/if}
</main>

<style>
  .import {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-4);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-small);
    margin: 0;
  }
  .hint code {
    background: var(--bg-base);
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs, 3px);
  }
  .req {
    color: var(--danger);
  }
  select {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font-family: inherit;
    font-size: var(--text-body);
  }
  .map-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .stats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .stat {
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
  }
  .stat--ok {
    background: var(--success-light, #e6f6ec);
    color: var(--success, #1a7f4b);
  }
  .stat--warn {
    background: var(--warning-light, #fdf2e1);
    color: var(--warning, #b06d00);
  }
  .stat--bad {
    background: var(--danger-light);
    color: var(--danger);
  }
  .stat-note {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .preview {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-2);
  }
  .preview :global(.col-email) {
    background: var(--bg-base);
    font-weight: var(--weight-medium);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  .done {
    text-align: center;
  }
  .done :global(.done-icon) {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--success, #1a7f4b);
    margin: 0 auto var(--space-2);
  }
  .summary {
    color: var(--text-main);
    margin: 0 0 var(--space-2);
  }
  .done .actions {
    justify-content: center;
  }
  @media (max-width: 640px) {
    .map-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
