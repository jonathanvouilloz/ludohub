<script lang="ts" module>
  export type ActivitySite = { id: string; name: string; isActive: boolean }
  export type EditableActivity = {
    id: string
    revision: number
    slug: string
    title: string
    summary: string
    body: string
    location: string | null
    type: 'one_off' | 'recurring' | 'permanent'
    recurrenceRule: string | null
    publishedAt: Date | null
    imageUrl: string | null
    imageAlt: string | null
    status: 'draft' | 'published' | 'hidden'
    lifecycle: 'active' | 'archived' | 'trashed'
    featuredRank: number | null
    targets: Array<{ siteId: string; site: ActivitySite }>
    dates: Array<{ startsAt: Date; endsAt: Date | null }>
    exceptions: Array<{ excludedAt: Date; reason: string | null }>
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import { formatZurichDateTimeLocal } from '$lib/zurich-wall-clock.js'

  let {
    open = $bindable(false),
    activity = null,
    sites,
  }: { open?: boolean; activity?: EditableActivity | null; sites: ActivitySite[] } = $props()

  let title = $state('')
  let slug = $state('')
  let summary = $state('')
  let body = $state('')
  let location = $state('')
  let type = $state<EditableActivity['type']>('one_off')
  let recurrenceRule = $state('')
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let dates = $state<Array<{ key: number; startsAt: string; endsAt: string }>>([])
  let exceptions = $state<Array<{ key: number; excludedAt: string; reason: string }>>([])
  let nextKey = 1
  let slugManuallyEdited = $state(false)
  let submitting = $state(false)
  let submitError = $state('')

  const isEdit = $derived(activity !== null)
  const slugEditable = $derived(!activity?.publishedAt)
  const scheduleValid = $derived(
    type === 'permanent' ||
      (type === 'recurring'
        ? Boolean(recurrenceRule.trim()) && dates.length > 0
        : dates.length > 0),
  )

  $effect(() => {
    if (open) {
      title = activity?.title ?? ''
      slug = activity?.slug ?? ''
      summary = activity?.summary ?? ''
      body = activity?.body ?? ''
      location = activity?.location ?? ''
      type = activity?.type ?? 'one_off'
      recurrenceRule = activity?.recurrenceRule ?? ''
      targetMode = activity && activity.targets.length > 0 ? 'explicit' : 'all'
      selectedSiteIds =
        activity?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ??
        []
      dates =
        activity?.dates.map((date) => ({
          key: nextKey++,
          startsAt: formatZurichDateTimeLocal(date.startsAt),
          endsAt: date.endsAt ? formatZurichDateTimeLocal(date.endsAt) : '',
        })) ?? []
      exceptions =
        activity?.exceptions.map((exception) => ({
          key: nextKey++,
          excludedAt: formatZurichDateTimeLocal(exception.excludedAt),
          reason: exception.reason ?? '',
        })) ?? []
      slugManuallyEdited = activity !== null
      submitError = ''
    }
  })

  function slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  }

  function updateTitle(value: string) {
    title = value
    if (slugEditable && !slugManuallyEdited) slug = slugify(value)
  }

  function addDate() {
    dates = [...dates, { key: nextKey++, startsAt: '', endsAt: '' }]
  }

  function addException() {
    exceptions = [...exceptions, { key: nextKey++, excludedAt: '', reason: '' }]
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="activity-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier l’activité' : 'Nouvelle activité'}</Dialog.Title>
      <Dialog.Description>Décrivez l’offre, ses dates et les lieux concernés.</Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Activité mise à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (pending) => {
          submitting = pending
          if (pending) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}
        <input type="hidden" name="id" value={activity?.id} />
        <input type="hidden" name="revision" value={activity?.revision} />
      {/if}
      <input
        type="hidden"
        name="dates"
        value={JSON.stringify(
          type === 'permanent' ? [] : dates.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
        )}
      />
      <input
        type="hidden"
        name="exceptions"
        value={JSON.stringify(
          type === 'recurring'
            ? exceptions.map(({ excludedAt, reason }) => ({ excludedAt, reason }))
            : [],
        )}
      />

      <div class="field">
        <Label for="activity-title">Titre</Label>
        <Input
          id="activity-title"
          name="title"
          value={title}
          oninput={(event) => updateTitle(event.currentTarget.value)}
          maxlength={180}
          required
        />
      </div>

      <div class="field">
        <Label for="activity-slug">Adresse de la page</Label>
        {#if slugEditable}
          <Input
            id="activity-slug"
            name="slug"
            value={slug}
            oninput={(event) => {
              slug = event.currentTarget.value
              slugManuallyEdited = true
            }}
            maxlength={120}
            required
          />
        {:else}
          <code>/{activity?.slug}</code>
          <p class="hint">Adresse immuable depuis la première publication.</p>
        {/if}
      </div>

      <div class="field">
        <Label for="activity-summary">Résumé</Label>
        <textarea id="activity-summary" name="summary" bind:value={summary} rows="3" required
        ></textarea>
      </div>
      <div class="field">
        <Label for="activity-body">Description Markdown</Label>
        <textarea id="activity-body" name="body" bind:value={body} rows="8" required></textarea>
      </div>
      <div class="field">
        <Label for="activity-location">Lieu ou précision pratique</Label>
        <Input id="activity-location" name="location" bind:value={location} />
      </div>

      <fieldset>
        <legend>Rythme</legend>
        <div class="mode-grid">
          <label
            ><input type="radio" name="type" value="one_off" bind:group={type} /> Ponctuelle</label
          >
          <label
            ><input type="radio" name="type" value="recurring" bind:group={type} /> Récurrente</label
          >
          <label
            ><input type="radio" name="type" value="permanent" bind:group={type} /> Permanente</label
          >
        </div>
      </fieldset>

      {#if type === 'recurring'}
        <div class="field">
          <Label for="activity-recurrence">Règle de récurrence</Label>
          <Input
            id="activity-recurrence"
            name="recurrenceRule"
            bind:value={recurrenceRule}
            placeholder="Ex. FREQ=WEEKLY;BYDAY=WE;COUNT=52"
            required
          />
        </div>
      {/if}

      {#if type !== 'permanent'}
        <fieldset>
          <div class="section-head">
            <legend>Dates et horaires</legend>
            <Button type="button" size="sm" variant="outline" onclick={addDate}>Ajouter</Button>
          </div>
          {#each dates as date, index (date.key)}
            <div class="schedule-row">
              <label>
                <span>Début</span>
                <input type="datetime-local" bind:value={date.startsAt} required />
              </label>
              <label>
                <span>Fin facultative</span>
                <input type="datetime-local" bind:value={date.endsAt} />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onclick={() => (dates = dates.filter((_, itemIndex) => itemIndex !== index))}
                >Retirer</Button
              >
            </div>
          {/each}
          {#if type === 'one_off' && dates.length === 0}
            <p class="warning" role="alert">Ajoutez au moins une date.</p>
          {/if}
        </fieldset>
      {/if}

      {#if type === 'recurring'}
        <fieldset>
          <div class="section-head">
            <legend>Exceptions ou séances annulées</legend>
            <Button type="button" size="sm" variant="outline" onclick={addException}>Ajouter</Button
            >
          </div>
          {#each exceptions as exception, index (exception.key)}
            <div class="schedule-row">
              <label>
                <span>Date annulée</span>
                <input type="datetime-local" bind:value={exception.excludedAt} required />
              </label>
              <label>
                <span>Motif facultatif</span>
                <input type="text" bind:value={exception.reason} />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onclick={() =>
                  (exceptions = exceptions.filter((_, itemIndex) => itemIndex !== index))}
                >Retirer</Button
              >
            </div>
          {/each}
        </fieldset>
      {/if}

      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="mode-grid">
          <label
            ><input type="radio" name="targetMode" value="all" bind:group={targetMode} /> Tous les lieux
            actifs</label
          >
          <label
            ><input type="radio" name="targetMode" value="explicit" bind:group={targetMode} /> Lieux précis</label
          >
        </div>
        {#if targetMode === 'explicit'}
          <div class="site-list">
            {#each sites as site (site.id)}
              <label class:disabled={!site.isActive}>
                <input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />
                {site.name}{site.isActive ? '' : ' — inactif'}
              </label>
            {/each}
          </div>
          {#if selectedSiteIds.length === 0}
            <p class="warning" role="alert">Sélectionnez au moins un lieu actif.</p>
          {/if}
        {/if}
      </fieldset>

      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button
          type="submit"
          disabled={submitting ||
            !title.trim() ||
            !slug.trim() ||
            !summary.trim() ||
            !body.trim() ||
            !scheduleValid ||
            (targetMode === 'explicit' && selectedSiteIds.length === 0)}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        >
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.activity-dialog) {
    max-width: 780px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .field,
  fieldset {
    display: grid;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
  }
  fieldset {
    padding: 0;
    border: 0;
  }
  legend,
  label span {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  textarea,
  input[type='datetime-local'],
  input[type='text'] {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
  }
  textarea {
    resize: vertical;
  }
  .mode-grid,
  .site-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .mode-grid label,
  .site-list label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .section-head,
  .schedule-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .section-head {
    justify-content: space-between;
  }
  .schedule-row label {
    display: grid;
    gap: var(--space-1);
    flex: 1;
  }
  .hint,
  .warning {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .warning {
    color: var(--warning);
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  code {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--bg-muted);
  }
  @media (max-width: 640px) {
    .schedule-row {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
