<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'

  let { data } = $props()

  const slug = $derived(data.ludo.slug)
  const stats = $derived(data.stats)
  const totalAttempted = $derived(stats.sent + stats.failed + stats.bounced)

  const dateTimeFmt = new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const cards = $derived([
    { key: 'sent', label: 'Envoyés', value: stats.sent, tone: 'success' as const },
    { key: 'failed', label: 'Échecs', value: stats.failed, tone: 'warning' as const },
    { key: 'bounced', label: 'Rejets / plaintes', value: stats.bounced, tone: 'danger' as const },
  ])
</script>

<svelte:head>
  <title>Statistiques — {data.campaign.subject} — {data.ludo.name}</title>
</svelte:head>

<main class="stats">
  <a class="back" href={`/${slug}/newsletter`}>
    <ArrowLeftIcon size={16} aria-hidden="true" />
    Campagnes
  </a>

  <header class="head">
    <h1>{data.campaign.subject}</h1>
    <p class="muted">
      {#if data.campaign.sentAt}
        Envoyée le {dateTimeFmt.format(new Date(data.campaign.sentAt))} ·
      {/if}
      {totalAttempted} tentative{totalAttempted > 1 ? 's' : ''} d'envoi
    </p>
  </header>

  <div class="cards">
    {#each cards as card (card.key)}
      <div class="stat-card" data-tone={card.tone}>
        <span class="stat-value">{card.value}</span>
        <span class="stat-label">{card.label}</span>
      </div>
    {/each}
  </div>

  <p class="note muted">
    Les rejets et plaintes sont mis à jour automatiquement via le webhook Resend.
  </p>
</main>

<style>
  .stats {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
    margin-bottom: var(--space-4);
  }
  .head {
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }
  @media (max-width: 640px) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-5);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }
  .stat-value {
    font-size: var(--text-h1);
    font-weight: var(--weight-bold);
    line-height: var(--leading-tight);
  }
  .stat-card[data-tone='success'] .stat-value {
    color: var(--success);
  }
  .stat-card[data-tone='warning'] .stat-value {
    color: var(--warning);
  }
  .stat-card[data-tone='danger'] .stat-value {
    color: var(--danger);
  }
  .stat-label {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .note {
    margin-top: var(--space-4);
    font-size: var(--text-small);
  }
</style>
