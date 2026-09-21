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
    assets: Array<{
      id: string
      kind: 'support_image' | 'pdf_attachment'
      url: string
      fileName: string | null
      caption: string | null
      alt: string | null
    }>
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
  import {
    compressEditorialImageEntries,
    compressEditorialImageFields,
    compressEditorialPdfFields,
  } from '$lib/media/editorial-image.js'
  import RichTextEditor from './RichTextEditor.svelte'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import { formatZurichDateTimeLocal } from '$lib/zurich-wall-clock.js'

  let {
    open = $bindable(false),
    activity = null,
  }: { open?: boolean; activity?: EditableActivity | null } = $props()

  let title = $state('')
  let summary = $state('')
  let body = $state('')
  let location = $state('')
  let type = $state<EditableActivity['type']>('one_off')
  let recurrenceFrequency = $state<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY')
  let recurrenceEndMode = $state<'count' | 'until'>('count')
  let recurrenceCount = $state(52)
  let recurrenceUntil = $state('')
  let dates = $state<Array<{ key: number; startsAt: string; endsAt: string }>>([])
  let exceptions = $state<Array<{ key: number; excludedAt: string; reason: string }>>([])
  let nextKey = 1
  let visible = $state(true)
  let submitting = $state(false)
  let submitError = $state('')

  const isEdit = $derived(activity !== null)
  const contentImages = $derived(
    activity?.assets.filter((asset) => asset.kind === 'support_image') ?? [],
  )
  const scheduleValid = $derived(
    type === 'permanent' ||
      (type === 'recurring'
        ? dates.length > 0 &&
          (recurrenceEndMode === 'count'
            ? Number.isSafeInteger(recurrenceCount) && recurrenceCount >= 1 && recurrenceCount <= 366
            : Boolean(recurrenceUntil))
        : dates.length > 0),
  )

  $effect(() => {
    if (open) {
      title = activity?.title ?? ''
      summary = activity?.summary ?? ''
      body = activity?.body ?? ''
      location = activity?.location ?? ''
      type = activity?.type ?? 'one_off'
      const values = new Map(
        (activity?.recurrenceRule ?? '')
          .split(';')
          .map((part) => part.split('=', 2) as [string, string]),
      )
      const frequency = values.get('FREQ')
      recurrenceFrequency =
        frequency === 'DAILY' || frequency === 'WEEKLY' || frequency === 'MONTHLY' || frequency === 'YEARLY'
          ? frequency
          : 'WEEKLY'
      const count = Number(values.get('COUNT'))
      recurrenceEndMode = Number.isSafeInteger(count) && count > 0 ? 'count' : 'until'
      recurrenceCount = Number.isSafeInteger(count) && count > 0 ? count : 52
      const until = values.get('UNTIL')
      recurrenceUntil = until && /^\d{8}T\d{6}Z$/.test(until)
        ? formatZurichDateTimeLocal(new Date(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}T${until.slice(9, 11)}:${until.slice(11, 13)}:${until.slice(13, 15)}Z`)).slice(0, 10)
        : ''
      visible = activity ? activity.status === 'published' : true
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
      submitError = ''
    }
  })

  function updateTitle(value: string) {
    title = value
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
      <Dialog.Description>Décrivez l’activité, ses dates et les informations utiles aux familles.</Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: isEdit ? 'Activité mise à jour.' : 'Activité créée.',
        errorMode: 'inline',
        prepare: async (formData) => {
          await Promise.all([
            compressEditorialImageFields(formData, ['coverFile'], 'content'),
            compressEditorialImageEntries(formData, 'contentImageFiles', 'gallery'),
            compressEditorialPdfFields(formData, ['attachmentFile']),
          ])
        },
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
      {#if !isEdit}
        <input type="hidden" name="targetMode" value="all" />
        <input type="hidden" name="slug" value={title} />
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
        <Label for="activity-summary">Résumé</Label>
        <textarea id="activity-summary" name="summary" bind:value={summary} rows="3" required
        ></textarea>
      </div>
      <div class="field">
        <Label for="activity-body">Description</Label>
        <p class="hint">Utilisez les titres, listes et liens pour présenter l’activité clairement.</p>
        <RichTextEditor
          id="activity-body"
          name="body"
          bind:value={body}
          ariaLabel="Description de l’activité"
          placeholder="Décrivez l’activité, son déroulement et les informations utiles…"
        />
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
        <fieldset class="recurrence">
          <legend>Répétition</legend>
          <div class="field">
            <Label for="activity-recurrence-frequency">À quelle fréquence ?</Label>
            <select id="activity-recurrence-frequency" name="recurrenceFrequency" bind:value={recurrenceFrequency}>
              <option value="DAILY">Chaque jour</option>
              <option value="WEEKLY">Chaque semaine</option>
              <option value="MONTHLY">Chaque mois</option>
              <option value="YEARLY">Chaque année</option>
            </select>
          </div>
          <div class="field">
            <Label>La répétition se termine</Label>
            <div class="mode-grid">
              <label><input type="radio" name="recurrenceEndMode" value="count" bind:group={recurrenceEndMode} /> Après un nombre de séances</label>
              <label><input type="radio" name="recurrenceEndMode" value="until" bind:group={recurrenceEndMode} /> À une date choisie</label>
            </div>
          </div>
          {#if recurrenceEndMode === 'count'}
            <div class="field compact-field">
              <Label for="activity-recurrence-count">Nombre de séances</Label>
              <Input id="activity-recurrence-count" name="recurrenceCount" type="number" min="1" max="366" bind:value={recurrenceCount} required />
            </div>
          {:else}
            <div class="field compact-field">
              <Label for="activity-recurrence-until">Dernier jour</Label>
              <Input id="activity-recurrence-until" name="recurrenceUntil" type="date" bind:value={recurrenceUntil} required />
            </div>
          {/if}
          <p class="hint">Le jour et l’horaire de la première séance sont repris automatiquement.</p>
        </fieldset>
      {/if}

      {#if type !== 'permanent'}
        <fieldset>
          <div class="section-head">
            <legend>{type === 'recurring' ? 'Première séance et horaire' : 'Dates et horaires'}</legend>
            <Button type="button" size="sm" variant="outline" onclick={addDate}>{type === 'recurring' ? 'Ajouter un autre horaire' : 'Ajouter'}</Button>
          </div>
          {#if type === 'recurring'}<p class="hint">Ajoutez une première séance : elle sera ensuite répétée au rythme choisi.</p>{/if}
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
        <legend>Publication</legend>
        <p class="hint">La date de publication est ajoutée automatiquement à la première mise en ligne.</p>
        <label class="visibility-choice">
          <input type="checkbox" name="visible" value="true" bind:checked={visible} />
          <span>
            <strong>Visible sur le site</strong>
            <small>{visible
              ? 'L’activité sera publiée dès son enregistrement.'
              : 'L’activité sera enregistrée, mais restera cachée du site.'}</small>
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Images et document</legend>
        <p class="hint">Tous ces ajouts sont facultatifs. Les images et le PDF sont optimisés avant l’envoi.</p>
        <div class="field">
          <Label for="activity-cover-file">Image de couverture</Label>
          {#if activity?.imageUrl}
            <img class="image-preview" src={activity.imageUrl} alt={activity.imageAlt ?? ''} />
          {/if}
          <input id="activity-cover-file" type="file" name="coverFile" accept="image/jpeg,image/png,image/webp" />
          <Input name="coverAlt" value={activity?.imageAlt ?? ''} maxlength={300} placeholder="Description de l’image (facultative)" />
          {#if activity?.imageUrl}
            <label class="remove-choice"><input type="checkbox" name="removeCover" /> Retirer l’image de couverture</label>
          {/if}
        </div>
        <div class="field">
          <Label for="activity-content-images">Images dans l’activité</Label>
          <input id="activity-content-images" type="file" name="contentImageFiles" accept="image/jpeg,image/png,image/webp" multiple />
          <Input name="contentImagesAlt" maxlength={300} placeholder="Description des images (facultative)" />
          <p class="hint">Jusqu’à 5 images, affichées sous le texte. {contentImages.length}/5 ajoutée{contentImages.length > 1 ? 's' : ''}.</p>
          {#if contentImages.length}
            <div class="image-list">
              {#each contentImages as image (image.id)}
                <label class="media-item"><img src={image.url} alt={image.alt ?? ''} /><span><input type="checkbox" name="removeAssetIds" value={image.id} /> Retirer cette image</span></label>
              {/each}
            </div>
          {/if}
        </div>
        <div class="field">
          <Label for="activity-attachment-file">Document PDF</Label>
          <input id="activity-attachment-file" type="file" name="attachmentFile" accept="application/pdf" />
          <Input name="attachmentTitle" maxlength={500} placeholder="Titre du document" />
          {#if activity?.assets.filter((asset) => asset.kind === 'pdf_attachment').length}
            <ul class="attachments">
              {#each activity.assets.filter((asset) => asset.kind === 'pdf_attachment') as attachment (attachment.id)}
                <li><label class="remove-choice"><input type="checkbox" name="removeAssetIds" value={attachment.id} /> Retirer « {attachment.caption ?? attachment.fileName} »</label></li>
              {/each}
            </ul>
          {/if}
        </div>
      </fieldset>

      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button
          type="submit"
          disabled={submitting ||
            !title.trim() ||
            !summary.trim() ||
            !body.trim() ||
            !scheduleValid}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’activité'}</Button
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
  input[type='text'],
  select {
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
  .compact-field {
    max-width: 20rem;
  }
  .mode-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .mode-grid label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
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
  .visibility-choice,
  .remove-choice,
  .media-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .visibility-choice {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .visibility-choice span {
    display: grid;
    gap: var(--space-1);
  }
  .visibility-choice small {
    color: var(--text-muted);
  }
  input[type='file'] {
    width: 100%;
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }
  .image-preview {
    width: min(100%, 460px);
    max-height: 220px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .image-list,
  .attachments {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .media-item {
    align-items: center;
  }
  .media-item img {
    width: 72px;
    height: 54px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  @media (max-width: 640px) {
    .schedule-row {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
