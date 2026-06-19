<script lang="ts">
  import type { Snippet } from 'svelte'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'

  let {
    title,
    href,
    linkTitle = 'Voir le lien',
    muted = false,
    spacedFooter = false,
    dotColor,
    dotTitle,
    badge,
    notes,
    byline,
    actions,
  }: {
    title: string
    href?: string | null
    linkTitle?: string
    muted?: boolean
    /** Séparation renforcée du footer (byline/actions) du reste de la carte. */
    spacedFooter?: boolean
    dotColor?: string
    dotTitle?: string
    badge?: Snippet
    notes?: Snippet
    byline?: Snippet
    actions?: Snippet
  } = $props()
</script>

<article class="card" class:muted class:spaced-footer={spacedFooter}>
  <div class="title-row">
    {#if dotColor}
      <span class="dot" style="background: {dotColor}" title={dotTitle}></span>
    {/if}
    <h3>{title}</h3>
    {#if badge}{@render badge()}{/if}
    {#if href}
      <a {href} target="_blank" rel="noopener" class="link" title={linkTitle}>
        <ExternalLinkIcon size={16} aria-hidden="true" />
        <span class="sr-only">{linkTitle} (nouvel onglet)</span>
      </a>
    {/if}
  </div>

  {#if notes}<div class="notes">{@render notes()}</div>{/if}

  {#if byline || actions}
    <footer class="card-foot">
      {#if byline}<span class="byline">{@render byline()}</span>{:else}<span></span>{/if}
      {#if actions}<div class="foot-actions">{@render actions()}</div>{/if}
    </footer>
  {/if}
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition:
      box-shadow var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  /* Élévation discrète au survol (la carte n'est pas cliquable : pas de
     translate qui suggérerait une navigation). */
  .card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
  }
  .card.muted {
    opacity: 0.7;
  }
  /* Respiration supplémentaire avant le footer (byline / actions). */
  .card.spaced-footer {
    gap: var(--space-3);
  }
  .card.spaced-footer .card-foot {
    margin-top: var(--space-1);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }
  h3 {
    margin: 0;
    min-width: 0;
    color: var(--text-main);
    font-size: var(--text-card-title);
    font-weight: var(--weight-bold);
    line-height: 1.2;
  }
  .link {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--dur-fast) var(--ease-out-strong);
  }
  .link:hover {
    color: var(--primary);
  }
  .notes {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .byline {
    color: var(--text-muted);
    font-size: var(--text-body);
  }
  .foot-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .foot-actions :global(form) {
    display: inline-flex;
  }
  .foot-actions :global(.danger-icon) {
    color: var(--danger);
  }
</style>
