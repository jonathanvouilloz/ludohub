<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  let {
    href,
    title,
    description = null,
    meta = [],
    status,
    statusVariant = 'secondary',
    warning = null,
    imageUrl = null,
    imageAlt = '',
  }: {
    href: string
    title: string
    description?: string | null
    meta?: string[]
    status: string
    statusVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
    warning?: string | null
    imageUrl?: string | null
    imageAlt?: string
  } = $props()
</script>

<a {href} class="list-item" class:with-image={Boolean(imageUrl)}>
  {#if imageUrl}<img src={imageUrl} alt={imageAlt} />{/if}
  <span class="main"
    ><span class="title-row"
      ><span class="title">{title}</span><Badge variant={statusVariant}>{status}</Badge></span
    >{#if description}<span class="description">{description}</span>{/if}{#if meta.length > 0}<span
        class="meta">{meta.join(' · ')}</span
      >{/if}{#if warning}<span class="warning">{warning}</span>{/if}</span
  >
  <ArrowRightIcon class="arrow" size={20} aria-hidden="true" />
</a>

<style>
  .list-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4);
    min-height: 88px;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
    color: var(--text-main);
    text-decoration: none;
    transition: background-color var(--dur-fast) var(--ease-out-strong);
  }
  .list-item.with-image {
    grid-template-columns: 96px minmax(0, 1fr) auto;
  }
  .list-item:last-child {
    border-bottom: 0;
  }
  .list-item:hover {
    background: var(--bg-hover);
  }
  .list-item:focus-visible {
    position: relative;
    outline: none;
    box-shadow: inset var(--shadow-focus);
  }
  img {
    width: 96px;
    height: 68px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .main {
    display: grid;
    min-width: 0;
    gap: var(--space-1);
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .title {
    overflow-wrap: anywhere;
    font-size: var(--text-card-title);
    font-weight: var(--weight-bold);
  }
  .description {
    display: -webkit-box;
    overflow: hidden;
    color: var(--text-main);
    line-height: 1.5;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .meta,
  .warning {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .warning {
    color: var(--warning);
    font-weight: var(--weight-semibold);
  }
  :global(.arrow) {
    color: var(--primary);
  }
  @media (max-width: 640px) {
    .list-item,
    .list-item.with-image {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: var(--space-4);
    }
    img {
      display: none;
    }
    .title-row {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }
  }
</style>
