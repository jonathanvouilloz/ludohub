<script lang="ts">
  import type { Snippet } from 'svelte'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'

  let {
    title,
    count,
    open = false,
    children,
  }: {
    title: string
    count?: number
    open?: boolean
    children: Snippet
  } = $props()
</script>

<details class="collapsible" {open}>
  <summary>
    <ChevronDownIcon class="chevron" size={18} aria-hidden="true" />
    <span class="title">{title}</span>
    {#if count != null}<span class="count">{count}</span>{/if}
  </summary>
  <div class="content">
    {@render children()}
  </div>
</details>

<style>
  .collapsible {
    margin-top: var(--space-6);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
    list-style: none;
    user-select: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    color: var(--text-main);
  }
  .collapsible :global(.chevron) {
    flex-shrink: 0;
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  details[open] summary :global(.chevron) {
    transform: rotate(180deg);
  }
  .count {
    color: var(--text-subtle);
    font-size: var(--text-small);
    font-weight: var(--weight-normal);
  }
  .content {
    margin-top: var(--space-3);
  }
</style>
