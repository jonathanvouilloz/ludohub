<script lang="ts">
  import { page } from '$app/state'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'

  let { ludoSlug }: { ludoSlug: string } = $props()

  const sections: Record<string, string> = {
    'lieux-horaires': 'Lieux et horaires',
    annonces: 'Annonces',
    actualites: 'Actualités',
    activites: 'Activités',
    inscriptions: 'Inscriptions',
    'top-3': 'Top 3',
    faq: 'Questions fréquentes',
    documents: 'Documents',
    galerie: 'Galerie',
    profils: 'Équipe et comité',
    annuaire: 'Annuaire genevois',
    contacts: 'Messages reçus',
  }
  const baseHref = $derived(`/${ludoSlug}/site-public`)
  const relativePath = $derived(page.url.pathname.slice(baseHref.length).replace(/^\//, ''))
  const sectionKey = $derived(relativePath.split('/')[0] ?? '')
  const sectionLabel = $derived(sections[sectionKey] ?? '')
</script>

{#if relativePath}
  <nav class="module-nav" aria-label="Navigation du site public">
    <a href={baseHref}><LayoutGridIcon size={18} aria-hidden="true" /> Toutes les rubriques</a>
    {#if sectionLabel}
      <ChevronRightIcon class="separator" size={16} aria-hidden="true" />
      <span aria-current="page">{sectionLabel}</span>
    {/if}
  </nav>
{/if}

<style>
  .module-nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: var(--max-content);
    min-height: 52px;
    margin: 0 auto;
    padding: var(--space-2) var(--space-6);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    color: var(--primary);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  a:focus-visible {
    border-radius: var(--radius-sm);
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  :global(.separator) {
    flex: 0 0 auto;
    color: var(--text-subtle);
  }
  span {
    overflow: hidden;
    color: var(--text-main);
    font-weight: var(--weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .module-nav {
      padding-inline: var(--space-4);
    }
  }
</style>
