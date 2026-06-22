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
    background: color-mix(in srgb, var(--ludo-color) 6%, transparent);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-main);
    text-decoration: none;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  .reminder:hover {
    background: color-mix(in srgb, var(--ludo-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--ludo-color) 20%, transparent);
  }
  /* Teinte d'alerte pour les rappels urgents/warn (fond léger assorti au dot). */
  .reminder[data-tone='urgent'] {
    background: var(--danger-light);
  }
  .reminder[data-tone='warn'] {
    background: var(--warning-light);
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
