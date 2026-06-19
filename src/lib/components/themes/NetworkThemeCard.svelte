<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'

  type ThemeImage = { id: string; url: string }
  type ThemeItem = { id: string }
  type NetworkTheme = {
    id: string
    name: string
    description?: string | null
    items?: ThemeItem[]
    images?: ThemeImage[]
    onLoan?: boolean
    myRequestStatus?: string | null
    ownerLudo?: { name: string } | null
  }

  let { theme }: { theme: NetworkTheme } = $props()

  const cover = $derived(theme.images?.[0])
  const itemCount = $derived(theme.items?.length ?? 0)
  const onLoan = $derived(theme.onLoan ?? false)
  const requestStatus = $derived(theme.myRequestStatus ?? null)
  // Demande possible uniquement si rien d'ouvert (ni prêt actif, ni demande à moi).
  const canRequest = $derived(!onLoan && !requestStatus)

  let submitting = $state(false)
</script>

<article class="card">
  <div class="thumb">
    {#if cover}
      <img src={cover.url} alt="" />
    {:else}
      <span class="placeholder" aria-hidden="true">🎲</span>
    {/if}
  </div>
  <div class="body">
    <h3>{theme.name}</h3>
    <p class="owner">{theme.ownerLudo?.name ?? '—'}</p>
    {#if theme.description}<p class="muted">{theme.description}</p>{/if}
    <div class="meta">
      <span class="count">{itemCount} item{itemCount > 1 ? 's' : ''}</span>
      {#if requestStatus === 'actif'}
        <Badge variant="secondary">Emprunté par vous</Badge>
      {:else if requestStatus === 'en_attente'}
        <Badge variant="secondary">Demande envoyée</Badge>
      {:else if onLoan}
        <Badge variant="secondary">En prêt</Badge>
      {:else}
        <Badge variant="outline">Disponible</Badge>
      {/if}
    </div>

    {#if canRequest}
      <form
        method="POST"
        action="?/request"
        use:enhance={toastEnhance({
          success: 'Demande envoyée.',
          onPending: (p) => (submitting = p),
        })}
      >
        <input type="hidden" name="themeId" value={theme.id} />
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Demander ce thème'}
        </Button>
      </form>
    {/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .thumb {
    aspect-ratio: 4 / 3;
    background: var(--bg-hover);
    display: grid;
    place-items: center;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder {
    font-size: 2rem;
    opacity: 0.5;
  }
  .body {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-body);
  }
  .owner {
    margin: 0;
    color: var(--ludo-color, var(--primary));
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .muted {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }
  .count {
    font-size: var(--text-small);
    color: var(--text-subtle);
  }
  form {
    margin-top: var(--space-3);
  }
</style>
