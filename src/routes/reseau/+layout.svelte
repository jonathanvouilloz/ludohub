<script lang="ts">
  import { page } from '$app/state'
  import AppShell from '$lib/components/nav/AppShell.svelte'

  let { data, children } = $props()

  // Onglets du réseau : seul l'item « Réseau » du shell mène ici, on expose donc
  // ses deux sections (aide + catalogue) via une sous-nav interne.
  const tabs = [
    { label: "Demandes d'aide", href: '/reseau/aide' },
    { label: 'Catalogue thèmes', href: '/reseau/themes' },
  ]
  const showTabs = $derived(
    page.url.pathname.startsWith('/reseau/aide') || page.url.pathname.startsWith('/reseau/themes'),
  )
</script>

<!-- Routes cross-ludo : pas de slug dans l'URL, identité résolue via la session. -->
<div class="ludo-scope" style="--ludo-color: {data.ludo.color}">
  <AppShell ludo={data.ludo} member={data.currentMember} notifCount={data.notifCount}>
    {#if showTabs}
      <nav class="reseau-tabs" aria-label="Sections réseau">
        {#each tabs as tab (tab.href)}
          <a
            href={tab.href}
            class="reseau-tab"
            class:reseau-tab--active={page.url.pathname.startsWith(tab.href)}
            aria-current={page.url.pathname.startsWith(tab.href) ? 'page' : undefined}
          >
            {tab.label}
          </a>
        {/each}
      </nav>
    {/if}
    {@render children()}
  </AppShell>
</div>

<style>
  .ludo-scope {
    min-height: 100dvh;
  }

  .reseau-tabs {
    display: flex;
    gap: var(--space-2);
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) 0;
  }
  .reseau-tab {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .reseau-tab:hover {
    background: var(--bg-hover);
  }
  .reseau-tab--active {
    background: var(--ludo-color);
    border-color: var(--ludo-color);
    color: var(--text-inverse);
  }
  /* Onglet actif au survol : garder un fond foncé (sinon le texte blanc
     devient illisible sur le fond clair du hover générique). */
  .reseau-tab--active:hover {
    background: color-mix(in srgb, var(--ludo-color) 88%, black);
    color: var(--text-inverse);
  }
  .reseau-tab:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
</style>
