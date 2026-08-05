<script lang="ts" module>
  export type AnnouncementSite = { id: string; name: string; isActive: boolean }
  export type EditableAnnouncement = {
    id: string
    revision: number
    title: string
    message: string
    targets: Array<{ siteId: string; site: AnnouncementSite }>
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let {
    open = $bindable(false),
    announcement = null,
    sites,
  }: {
    open?: boolean
    announcement?: EditableAnnouncement | null
    sites: AnnouncementSite[]
  } = $props()

  const isEdit = $derived(announcement !== null)
  let title = $state('')
  let message = $state('')
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let submitting = $state(false)
  let submitError = $state('')

  $effect(() => {
    if (open) {
      title = announcement?.title ?? ''
      message = announcement?.message ?? ''
      targetMode = announcement && announcement.targets.length > 0 ? 'explicit' : 'all'
      selectedSiteIds =
        announcement?.targets
          .filter((target) => target.site.isActive)
          .map((target) => target.siteId) ?? []
      submitError = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier l’annonce' : 'Nouvelle annonce'}</Dialog.Title>
      <Dialog.Description>
        Une information courte affichée en priorité sur le site public lorsqu’elle est active.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Annonce mise à jour.' : 'Annonce créée.',
        errorMode: 'inline',
        onPending: (pending) => {
          submitting = pending
          if (pending) submitError = ''
        },
        onError: (error) => (submitError = error),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}
        <input type="hidden" name="id" value={announcement?.id} />
        <input type="hidden" name="revision" value={announcement?.revision} />
      {/if}

      <div class="field">
        <Label for="announcement-title">Titre</Label>
        <Input id="announcement-title" name="title" bind:value={title} maxlength={160} required />
      </div>

      <div class="field">
        <Label for="announcement-message">Message</Label>
        <textarea
          id="announcement-message"
          name="message"
          bind:value={message}
          maxlength="2000"
          rows="5"
          required
        ></textarea>
      </div>

      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="mode-list">
          <label class="mode-option">
            <input type="radio" name="targetMode" value="all" bind:group={targetMode} />
            <span>
              <strong>Tous les lieux actifs</strong>
              <small>La liste suivra automatiquement les lieux actifs.</small>
            </span>
          </label>
          <label class="mode-option">
            <input type="radio" name="targetMode" value="explicit" bind:group={targetMode} />
            <span>
              <strong>Lieux précis</strong>
              <small>Choisissez au moins un lieu actif.</small>
            </span>
          </label>
        </div>

        {#if targetMode === 'explicit'}
          <div class="site-list">
            {#each sites as site (site.id)}
              <label class="site-option" class:disabled={!site.isActive}>
                <input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />
                <span>{site.name}{site.isActive ? '' : ' — inactif'}</span>
              </label>
            {/each}
          </div>
          {#if selectedSiteIds.length === 0}
            <p class="warning" role="alert">Sélectionnez au moins un lieu actif.</p>
          {/if}
        {/if}
      </fieldset>

      {#if submitError}
        <p class="error" role="alert">{submitError}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button
          type="submit"
          disabled={submitting ||
            !title.trim() ||
            !message.trim() ||
            (targetMode === 'explicit' && selectedSiteIds.length === 0)}
        >
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’annonce'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .field,
  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
  }
  fieldset {
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-1);
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  .mode-list {
    display: grid;
    gap: var(--space-2);
  }
  .mode-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .mode-option span {
    display: grid;
    gap: var(--space-1);
  }
  .mode-option small {
    color: var(--text-muted);
  }
  .site-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .site-option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-main);
    cursor: pointer;
  }
  .site-option:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .site-option.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .warning {
    margin: 0;
    color: var(--warning-foreground, var(--text-main));
    font-size: var(--text-small);
  }
  .error {
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
