<script lang="ts">
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import type { Component } from 'svelte'
  let {
    href,
    title,
    description,
    icon: Icon,
    attention = null,
  }: {
    href: string
    title: string
    description: string
    icon: Component
    attention?: string | null
  } = $props()
</script>

<a {href} class="section-card">
  <Icon size={24} aria-hidden="true" />
  <span class="content"
    ><span class="title">{title}</span><span class="description">{description}</span
    >{#if attention}<span class="attention">{attention}</span>{/if}</span
  >
  <ArrowRightIcon class="arrow" size={20} aria-hidden="true" />
</a>

<style>
  .section-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-4);
    min-height: 112px;
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-main);
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition:
      border-color var(--dur-fast) var(--ease-out-strong),
      box-shadow var(--dur-fast) var(--ease-out-strong);
  }
  .section-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }
  .section-card:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .content {
    display: grid;
    gap: var(--space-1);
  }
  .title {
    font-size: var(--text-card-title);
    font-weight: var(--weight-bold);
  }
  .description {
    color: var(--text-muted);
    line-height: 1.5;
  }
  .attention {
    margin-top: var(--space-1);
    color: var(--warning);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  :global(.arrow) {
    align-self: center;
    color: var(--primary);
  }
  @media (max-width: 640px) {
    .section-card {
      min-height: 0;
    }
  }
</style>
