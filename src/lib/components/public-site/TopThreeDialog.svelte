<script lang="ts" module>
  export type TopThreeSite = { id: string; name: string; isActive: boolean }
  export type TopThreeGame = { name: string; description?: string }
  export type EditableTopThree = {
    id: string
    revision: number
    slug: string
    theme: string
    status: 'draft' | 'published' | 'hidden'
    publishedAt: Date | null
    targets: Array<{ siteId: string; site: TopThreeSite }>
    games: TopThreeGame[]
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    open = $bindable(false),
    topThree = null,
    sites,
  }: { open?: boolean; topThree?: EditableTopThree | null; sites: TopThreeSite[] } = $props()

  let theme = $state('')
  let slug = $state('')
  let slugManuallyEdited = $state(false)
  type FormGame = { name: string; description: string }
  let games = $state<FormGame[]>(emptyGames())
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let submitting = $state(false)
  let submitError = $state('')
  const isEdit = $derived(topThree !== null)
  const slugEditable = $derived(!topThree?.publishedAt)
  const formValid = $derived(
    theme.trim().length > 0 &&
      (!slugEditable || slug.trim().length > 0) &&
      games.every((game) => game.name.trim()) &&
      (targetMode === 'all' || selectedSiteIds.length > 0),
  )

  function emptyGames(): FormGame[] {
    return [1, 2, 3].map(() => ({ name: '', description: '' }))
  }

  function slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  }

  function updateTheme(value: string) {
    theme = value
    if (slugEditable && !slugManuallyEdited) slug = slugify(value)
  }

  $effect(() => {
    if (!open) return
    theme = topThree?.theme ?? ''
    slug = topThree?.slug ?? ''
    slugManuallyEdited = topThree !== null
    games = topThree
      ? [0, 1, 2].map((index) => ({
          name: topThree.games[index]?.name ?? '',
          description: topThree.games[index]?.description ?? '',
        }))
      : emptyGames()
    targetMode = topThree && topThree.targets.length > 0 ? 'explicit' : 'all'
    selectedSiteIds =
      topThree?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ??
      []
    submitError = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="top-three-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier le Top 3' : 'Nouveau Top 3'}</Dialog.Title>
      <Dialog.Description>
        Choisissez librement un thème et décrivez exactement trois jeux, sans lien au catalogue.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Top 3 mis à jour.' : 'Brouillon créé.',
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
        <input type="hidden" name="id" value={topThree?.id} />
        <input type="hidden" name="revision" value={topThree?.revision} />
      {/if}
      <input
        type="hidden"
        name="games"
        value={JSON.stringify(
          games.map((game) => (game.description.trim() ? game : { name: game.name })),
        )}
      />

      <div class="field">
        <Label for="top-three-theme">Thème</Label>
        <Input
          id="top-three-theme"
          name="theme"
          value={theme}
          oninput={(event) => updateTheme(event.currentTarget.value)}
          maxlength={160}
          placeholder="Ex. Trois jeux parfaits pour débuter"
          required
        />
      </div>

      <div class="field">
        <Label for="top-three-slug">Adresse de la page</Label>
        {#if slugEditable}
          <Input
            id="top-three-slug"
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
          <code>/{topThree?.slug}</code>
          <p class="hint">Adresse immuable depuis la première publication.</p>
        {/if}
      </div>

      <section class="games" aria-label="Jeux du Top 3">
        {#each games as game, index (index)}
          <fieldset class="game">
            <legend>#{index + 1}</legend>
            <div class="field">
              <Label for={`top-three-game-${index}-name`}>Nom du jeu</Label>
              <Input
                id={`top-three-game-${index}-name`}
                bind:value={game.name}
                maxlength={160}
                required
              />
            </div>
            <div class="field">
              <Label for={`top-three-game-${index}-description`}>Description</Label>
              <textarea
                id={`top-three-game-${index}-description`}
                bind:value={game.description}
                maxlength="1000"
                rows="3"
              ></textarea>
            </div>
          </fieldset>
        {/each}
      </section>

      <fieldset class="targeting">
        <legend>Lieux concernés</legend>
        <div class="mode-list">
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
          {#if selectedSiteIds.length === 0}<p class="warning" role="alert">
              Sélectionnez au moins un lieu actif.
            </p>{/if}
        {/if}
      </fieldset>

      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !formValid}>
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.top-three-dialog) {
    max-width: 760px;
    max-height: 90vh;
    overflow-y: auto;
  }
  form,
  .games,
  .game,
  .field,
  .targeting {
    display: grid;
    gap: var(--space-3);
  }
  form,
  .games {
    gap: var(--space-5);
  }
  .game,
  .targeting {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend {
    padding: 0 var(--space-2);
    color: var(--text-main);
    font-weight: var(--weight-semibold);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  .mode-list,
  .site-list {
    display: grid;
    gap: var(--space-2);
  }
  .mode-list label,
  .site-list label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .disabled {
    color: var(--text-muted);
  }
  .warning,
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
