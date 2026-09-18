<script lang="ts" module>
  export type TopThreeFormGame = {
    name: string
    description?: string
    imageUrl?: string
    imageAlt?: string
  }
  export type TopThreeFormValue = {
    id: string
    revision: number
    theme: string
    isHomepage: boolean
    games: TopThreeFormGame[]
  }
  export const TOP_THREE_IMAGE_FIELDS = ['image0', 'image1', 'image2'] as const
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto, invalidateAll } from '$app/navigation'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { compressEditorialImageFields } from '$lib/media/editorial-image.js'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    topThree = null,
    action,
    cancelHref,
    successHref,
  }: {
    topThree?: TopThreeFormValue | null
    action: string
    cancelHref: string
    successHref: string
  } = $props()

  const isEdit = $derived(topThree !== null)
  const positions = [0, 1, 2]

  type FormGame = { name: string; description: string }
  let theme = $state('')
  let games = $state<FormGame[]>(emptyGames())
  let isHomepage = $state(false)
  let removals = $state([false, false, false])
  let previews = $state<Array<string | null>>([null, null, null])
  let initializedFor = $state<string | null>(null)
  let submitting = $state(false)
  let submitError = $state('')

  const formValid = $derived(theme.trim().length > 0 && games.every((game) => game.name.trim()))

  function emptyGames(): FormGame[] {
    return [0, 1, 2].map(() => ({ name: '', description: '' }))
  }

  $effect(() => {
    const key = topThree?.id ?? 'new'
    if (initializedFor === key) return
    theme = topThree?.theme ?? ''
    games = [0, 1, 2].map((index) => ({
      name: topThree?.games[index]?.name ?? '',
      description: topThree?.games[index]?.description ?? '',
    }))
    isHomepage = topThree?.isHomepage ?? false
    removals = [false, false, false]
    releasePreviews()
    initializedFor = key
  })

  function releasePreviews() {
    for (const preview of previews) if (preview) URL.revokeObjectURL(preview)
    previews = [null, null, null]
  }

  function onPickImage(index: number, event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0] ?? null
    const previous = previews[index]
    if (previous) URL.revokeObjectURL(previous)
    previews[index] = file ? URL.createObjectURL(file) : null
    if (file) removals[index] = false
  }

  function shownImage(index: number) {
    const preview = previews[index]
    if (preview) return preview
    if (removals[index]) return undefined
    return topThree?.games[index]?.imageUrl
  }
</script>

<form
  method="POST"
  {action}
  enctype="multipart/form-data"
  use:enhance={toastEnhance({
    success: isEdit ? 'Top 3 enregistré.' : 'Top 3 créé et mis en ligne.',
    errorMode: 'inline',
    skipUpdate: true,
    prepare: (formData) =>
      compressEditorialImageFields(formData, TOP_THREE_IMAGE_FIELDS, 'gallery'),
    onPending: (pending) => {
      submitting = pending
      if (pending) submitError = ''
    },
    onError: async (message) => {
      submitError = message
      await invalidateAll()
    },
    onSuccess: () => goto(successHref),
  })}
>
  {#if isEdit}
    <input type="hidden" name="id" value={topThree?.id} />
    <input type="hidden" name="revision" value={topThree?.revision} />
  {/if}

  <section aria-labelledby="top-three-name-title">
    <div class="section-heading">
      <h2 id="top-three-name-title">Nom du Top 3</h2>
      <p>Le titre que les familles liront au-dessus des trois jeux.</p>
    </div>
    <div class="field">
      <Label for="top-three-theme">Nom</Label>
      <Input
        id="top-three-theme"
        name="theme"
        bind:value={theme}
        maxlength={160}
        placeholder="Trois jeux parfaits pour débuter"
        required
      />
    </div>
  </section>

  {#each positions as index (index)}
    <section aria-labelledby={`top-three-game-${index}-title`}>
      <div class="section-heading">
        <h2 id={`top-three-game-${index}-title`}>Jeu {index + 1}</h2>
      </div>
      <div class="game">
        <div class="media">
          {#if shownImage(index)}
            <img src={shownImage(index)} alt={topThree?.games[index]?.imageAlt ?? ''} />
          {:else}
            <p class="placeholder">Aucune photo</p>
          {/if}
          <label class="file">
            <span>{shownImage(index) ? 'Remplacer la photo' : 'Ajouter une photo'}</span>
            <input
              type="file"
              name={`image${index}`}
              accept="image/jpeg,image/png,image/webp"
              onchange={(event) => onPickImage(index, event)}
            />
          </label>
          {#if topThree?.games[index]?.imageUrl && !previews[index]}
            <label class="remove">
              <input type="checkbox" name={`removeImage${index}`} bind:checked={removals[index]} />
              <span>Retirer la photo</span>
            </label>
          {/if}
        </div>
        <div class="texts">
          <div class="field">
            <Label for={`top-three-name-${index}`}>Nom du jeu</Label>
            <Input
              id={`top-three-name-${index}`}
              name={`name${index}`}
              bind:value={games[index].name}
              maxlength={160}
              required
            />
          </div>
          <div class="field">
            <Label for={`top-three-description-${index}`}>Description courte</Label>
            <textarea
              id={`top-three-description-${index}`}
              name={`description${index}`}
              bind:value={games[index].description}
              maxlength="500"
              rows="3"
              placeholder="Une ou deux phrases sur ce jeu."
            ></textarea>
          </div>
        </div>
      </div>
    </section>
  {/each}

  <section aria-labelledby="top-three-homepage-title">
    <div class="section-heading">
      <h2 id="top-three-homepage-title">Page d’accueil</h2>
      <p>Un seul Top 3 s’affiche sur la page d’accueil du site.</p>
    </div>
    <label class="choice">
      <input type="checkbox" name="isHomepage" value="true" bind:checked={isHomepage} />
      <span>
        <strong>Afficher ce Top 3 sur la page d’accueil</strong>
        <small>Le Top 3 qui y était remplacé revient simplement dans la liste.</small>
      </span>
    </label>
  </section>

  {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
  <footer>
    <Button href={cancelHref} variant="outline">Annuler et revenir</Button>
    <Button type="submit" disabled={submitting || !formValid}>
      {submitting ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  </footer>
</form>

<style>
  form {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  h2,
  p {
    margin: 0;
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .section-heading p {
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .game {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: var(--space-5);
  }
  .media,
  .texts {
    display: grid;
    align-content: start;
    gap: var(--space-3);
  }
  .media img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .placeholder {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .field,
  .file {
    display: grid;
    gap: var(--space-2);
  }
  .file span {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .file input,
  textarea {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .file input {
    min-height: 40px;
  }
  textarea {
    padding: var(--space-3);
    font: inherit;
    line-height: 1.5;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .remove,
  .choice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-height: 44px;
    cursor: pointer;
  }
  .remove {
    align-items: center;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .choice {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .choice:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .choice span {
    display: grid;
    gap: var(--space-1);
  }
  .choice small {
    color: var(--text-muted);
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
  @media (max-width: 720px) {
    section {
      padding: var(--space-4);
    }
    .game {
      grid-template-columns: 1fr;
    }
    .media img,
    .placeholder {
      max-width: 220px;
    }
    footer {
      align-items: stretch;
      flex-direction: column-reverse;
    }
    footer :global(a),
    footer :global(button) {
      width: 100%;
    }
  }
</style>
