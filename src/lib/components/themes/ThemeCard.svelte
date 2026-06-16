<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'

  type ThemeImage = { id: string; url: string }
  type ThemeItem = { id: string }
  type ThemeLoan = { status: string }
  type ThemeCardData = {
    id: string
    name: string
    description?: string | null
    isShareable: boolean
    items?: ThemeItem[]
    images?: ThemeImage[]
    loans?: ThemeLoan[]
  }

  let { theme, slug }: { theme: ThemeCardData; slug: string } = $props()

  const cover = $derived(theme.images?.[0])
  const itemCount = $derived(theme.items?.length ?? 0)
  const onLoan = $derived((theme.loans ?? []).some((l) => l.status === 'actif'))
</script>

<a class="card" href="/{slug}/themes/{theme.id}">
  <div class="thumb">
    {#if cover}
      <img src={cover.url} alt="" />
    {:else}
      <span class="placeholder" aria-hidden="true">🎲</span>
    {/if}
  </div>
  <div class="body">
    <h3>{theme.name}</h3>
    {#if theme.description}<p class="muted">{theme.description}</p>{/if}
    <div class="meta">
      <span class="count">{itemCount} item{itemCount > 1 ? 's' : ''}</span>
      {#if theme.isShareable}<Badge variant="outline">Partagé</Badge>{/if}
      {#if onLoan}<Badge variant="secondary">En prêt</Badge>{/if}
    </div>
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: box-shadow var(--motion-fast, 150ms) ease;
  }
  .card:hover {
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
  }
  .thumb {
    aspect-ratio: 16 / 9;
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
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-body);
  }
  .muted {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: auto;
  }
  .count {
    font-size: var(--text-small);
    color: var(--text-subtle);
  }
</style>
