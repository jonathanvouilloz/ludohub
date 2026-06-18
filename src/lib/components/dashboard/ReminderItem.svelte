<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import type { Reminder } from '$lib/server/services/dashboard'

  let { reminder }: { reminder: Reminder } = $props()
</script>

<a href={reminder.href} class="reminder" data-tone={reminder.tone}>
  <span class="dot" aria-hidden="true"></span>
  <span class="label">{reminder.label}</span>
  <ChevronRightIcon size={18} class="chevron" aria-hidden="true" />
</a>

<style>
  .reminder {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-main);
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .reminder:hover {
    background: var(--bg-hover);
  }
  .reminder:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .dot {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
  }
  .reminder[data-tone='urgent'] .dot {
    background: var(--danger);
  }
  .reminder[data-tone='warn'] .dot {
    background: var(--warning);
  }
  .label {
    flex: 1;
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
  }
  .reminder :global(.chevron) {
    flex: 0 0 auto;
    color: var(--text-subtle);
  }
</style>
