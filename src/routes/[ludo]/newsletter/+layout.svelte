<script lang="ts">
  import { page } from '$app/state'

  let { children } = $props()

  const slug = $derived(page.params.ludo)
  const current = $derived(page.url.pathname)
  const onContacts = $derived(current.startsWith(`/${slug}/newsletter/contacts`))

  const tabs = $derived([
    { label: 'Campagnes', href: `/${slug}/newsletter`, active: !onContacts },
    { label: 'Contacts', href: `/${slug}/newsletter/contacts`, active: onContacts },
  ])
</script>

<div class="newsletter-scope">
  <nav class="nl-tabs" aria-label="Sections newsletter">
    {#each tabs as tab (tab.href)}
      <a
        href={tab.href}
        class="nl-tab"
        class:nl-tab--active={tab.active}
        aria-current={tab.active ? 'page' : undefined}
      >
        {tab.label}
      </a>
    {/each}
  </nav>
  {@render children()}
</div>

<style>
  .nl-tabs {
    display: flex;
    gap: var(--space-2);
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) 0;
  }
  .nl-tab {
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
  .nl-tab:hover {
    background: var(--bg-hover);
  }
  .nl-tab--active {
    background: var(--ludo-color);
    border-color: var(--ludo-color);
    color: var(--text-inverse);
  }
  .nl-tab--active:hover {
    background: color-mix(in srgb, var(--ludo-color) 88%, black);
    color: var(--text-inverse);
  }
  .nl-tab:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
</style>
