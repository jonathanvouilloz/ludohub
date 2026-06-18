<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { formatDateCH, formatDayMonth } from '$lib/utils/dates.js'

  type ThemeImage = { id: string; url: string }
  type Checkup = { checkedAt: Date | string; checkedBy?: { name: string } | null }
  type InstallItem = {
    id: string
    condition: 'present' | 'a_reparer' | 'manquant'
    themeItem: { name: string; quantity: number }
  }
  type Installation = {
    id: string
    installedAt: Date | string
    items: InstallItem[]
    checkups: Checkup[]
  }
  type ActiveTheme = {
    id: string
    name: string
    images?: ThemeImage[]
    installations: Installation[]
  }

  let { theme, slug }: { theme: ActiveTheme; slug: string } = $props()

  const install = $derived(theme.installations[0])
  const cover = $derived(theme.images?.[0])
  const activeItems = $derived(install.items)
  const objectCount = $derived(activeItems.length)
  const toRepair = $derived(activeItems.filter((i) => i.condition === 'a_reparer').length)
  const missing = $derived(activeItems.filter((i) => i.condition === 'manquant').length)
  const problems = $derived(toRepair + missing)
  const problemLabel = $derived(
    [
      toRepair > 0 ? `${toRepair} à réparer` : null,
      missing > 0 ? `${missing} manquant${missing > 1 ? 's' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  )
  const lastCheckup = $derived(install.checkups?.[0])
</script>

<article class="active">
  {#if cover}
    <a class="thumb" href="/{slug}/themes/{theme.id}">
      <img src={cover.url} alt="" />
    </a>
  {:else}
    <a class="thumb placeholder" href="/{slug}/themes/{theme.id}" aria-label={theme.name}>
      <span aria-hidden="true">🎲</span>
    </a>
  {/if}

  <div class="body">
    <div class="title">
      <Badge variant="success">Actif</Badge>
      <a href="/{slug}/themes/{theme.id}"><h2>{theme.name}</h2></a>
    </div>
    <p class="installed">
      Installé le {formatDateCH(install.installedAt)} · {objectCount} objet{objectCount > 1
        ? 's'
        : ''}
    </p>

    <a class="status" href="/{slug}/themes/{theme.id}/installations/{install.id}">
      <span class="status-text">
        {#if lastCheckup}
          Dernier check-up le <strong>{formatDayMonth(lastCheckup.checkedAt)}</strong>
          {#if lastCheckup.checkedBy}par {lastCheckup.checkedBy.name}{/if}
        {:else}
          Aucun check-up pour l'instant
        {/if}
      </span>
      {#if problems > 0}
        <Badge variant="warning">⚠ {problemLabel}</Badge>
      {:else}
        <Badge variant="success">Tout OK</Badge>
      {/if}
    </a>

    <div class="actions">
      <Button href="/{slug}/themes/{theme.id}/installations/{install.id}/checkup">
        Faire un check-up
      </Button>
      <Button variant="outline" href="/{slug}/themes/{theme.id}">Gérer les objets</Button>
    </div>
  </div>
</article>

<style>
  .active {
    display: flex;
    gap: var(--space-4);
    background: var(--success-light);
    border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  .thumb {
    flex-shrink: 0;
    width: 9rem;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-hover);
    display: grid;
    place-items: center;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder span {
    font-size: 2rem;
    opacity: 0.5;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .title a {
    text-decoration: none;
    color: inherit;
  }
  .title h2 {
    margin: 0;
    font-size: var(--text-body);
    color: var(--text-main);
  }
  .installed {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-small);
    color: var(--text-muted);
    text-decoration: none;
  }
  .status:hover {
    background: var(--bg-hover);
  }
  .status-text {
    flex: 1;
    min-width: 0;
  }
  .status-text strong {
    color: var(--text-main);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  @media (max-width: 30rem) {
    .active {
      flex-direction: column;
    }
    .thumb {
      width: 100%;
    }
  }
</style>
