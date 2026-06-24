<script lang="ts">
  import { page } from '$app/state'

  let { children } = $props()

  const slug = $derived(page.params.ludo)
  const current = $derived(page.url.pathname)

  type NavItem = { label: string; href: string; disabled?: boolean }
  const items = $derived<NavItem[]>([
    { label: 'Membres', href: `/${slug}/settings/membres` },
    { label: "Types d'événement", href: `/${slug}/settings/evenements` },
    { label: 'Infos ludothèque', href: `/${slug}/settings/infos` },
  ])
</script>

<div class="settings">
  <aside class="sidebar">
    <p class="sidebar-title">Réglages</p>
    <nav>
      <ul>
        {#each items as item (item.href)}
          <li>
            {#if item.disabled}
              <span class="nav-item nav-item--disabled">{item.label}</span>
            {:else}
              <a
                href={item.href}
                class="nav-item"
                class:nav-item--active={current === item.href}
                aria-current={current === item.href ? 'page' : undefined}
              >
                {item.label}
              </a>
            {/if}
          </li>
        {/each}
      </ul>
    </nav>
  </aside>

  <section class="content">
    {@render children()}
  </section>
</div>

<style>
  .settings {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-10) var(--space-6);
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--space-8);
    align-items: start;
  }

  .sidebar-title {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 var(--space-3);
  }

  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .nav-item {
    display: block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
    color: var(--text-main);
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .nav-item:hover {
    background: var(--bg-hover);
  }
  .nav-item--active {
    background: var(--ludo-color);
    color: var(--text-inverse);
  }
  .nav-item--active:hover {
    background: var(--ludo-color);
  }
  .nav-item--disabled {
    display: block;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-body);
    color: var(--text-muted);
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .settings {
      grid-template-columns: 1fr;
      gap: var(--space-5);
    }
  }
</style>
