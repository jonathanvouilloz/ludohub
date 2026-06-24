<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import MailIcon from '@lucide/svelte/icons/mail'
  import ChartColumnIcon from '@lucide/svelte/icons/chart-column'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import type { CampaignRow } from '$lib/server/schema'

  let { data } = $props()

  const slug = $derived(data.ludo.slug)
  const campaigns = $derived(data.campaigns as CampaignRow[])

  const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', sent: 'Envoyée' }
  const STATUS_VARIANTS = { draft: 'secondary', sent: 'success' } as const

  const dateFmt = new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const dateTimeFmt = new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const formatDate = (d: Date | string) => dateFmt.format(new Date(d))
  const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d))
</script>

<svelte:head>
  <title>Campagnes — Newsletter — {data.ludo.name}</title>
</svelte:head>

<main class="campaigns">
  <header class="head">
    <div>
      <h1>Campagnes</h1>
      <p class="muted">
        {data.subscriberCount} abonné{data.subscriberCount > 1 ? 's' : ''} recevront vos prochaines campagnes.
      </p>
    </div>
    <form method="POST" action="?/create" use:enhance={toastEnhance({ redirect: null })}>
      <Button type="submit">Nouvelle campagne</Button>
    </form>
  </header>

  {#if campaigns.length === 0}
    <EmptyState
      icon={MailIcon}
      title="Aucune campagne pour le moment"
      description="Créez une campagne, rédigez-la dans le template de votre ludothèque, puis envoyez-la à vos abonnés."
    >
      {#snippet action()}
        <form method="POST" action="?/create" use:enhance={toastEnhance({ redirect: null })}>
          <Button type="submit">Nouvelle campagne</Button>
        </form>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each campaigns as c (c.id)}
        <div class="row">
          <a
            class="row-main"
            href={`/${slug}/newsletter/${c.id}`}
            title={c.status === 'sent' ? 'Voir la campagne' : 'Modifier la campagne'}
          >
            <div class="row-info">
              <span class="row-title">{c.subject}</span>
              <span class="row-byline">
                <StatusBadge
                  status={c.status}
                  labels={STATUS_LABELS}
                  variantMap={STATUS_VARIANTS}
                />
                {#if c.status === 'sent' && c.sentAt}
                  <span class="byline-text">Envoyée le {formatDateTime(c.sentAt)}</span>
                {:else}
                  <span class="byline-text">Créée le {formatDate(c.createdAt)}</span>
                {/if}
              </span>
            </div>
            <div class="row-metrics">
              {#if c.status === 'sent'}
                <div class="metric">
                  <span class="metric-label">Destinataires</span>
                  <span class="metric-value">{c.recipientCount}</span>
                  <span class="metric-sub">100%</span>
                </div>
              {/if}
            </div>
          </a>
          <div class="row-actions">
            {#if c.status === 'sent'}
              <a
                class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                href={`/${slug}/newsletter/${c.id}/stats`}
                title="Statistiques d'envoi"
              >
                <ChartColumnIcon aria-hidden="true" />
                <span class="sr-only">Statistiques d'envoi</span>
              </a>
            {/if}
            <AlertDialog.Root>
              <AlertDialog.Trigger
                class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                title="Supprimer"
              >
                <Trash2Icon class="danger-icon" aria-hidden="true" />
                <span class="sr-only">Supprimer</span>
              </AlertDialog.Trigger>
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Supprimer cette campagne ?</AlertDialog.Title>
                  <AlertDialog.Description>
                    « {c.subject} » sera définitivement supprimée.
                    {#if c.status === 'sent'}
                      L'historique d'envoi sera également retiré.
                    {/if}
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <form
                  method="POST"
                  action="?/delete"
                  use:enhance={toastEnhance({ success: 'Campagne supprimée.' })}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <AlertDialog.Footer>
                    <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
                    <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                      Supprimer
                    </button>
                  </AlertDialog.Footer>
                </form>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .campaigns {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .list {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-card);
  }
  .row {
    display: flex;
    align-items: stretch;
  }
  .row + .row {
    border-top: 1px solid var(--border);
  }
  .row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    text-decoration: none;
    color: inherit;
    transition: background var(--motion-fast, 120ms) ease;
  }
  .row-main:hover {
    background: var(--bg-hover);
  }
  .row-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row-title {
    color: var(--text-main);
    font-weight: var(--weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-byline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .byline-text {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .row-metrics {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex: none;
  }
  .metric {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.3;
  }
  .metric-label {
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
  }
  .metric-value {
    color: var(--text-main);
    font-weight: var(--weight-bold);
    font-size: var(--text-h3, var(--text-body));
  }
  .metric-sub {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .row-actions {
    display: flex;
    align-items: center;
    padding: 0 var(--space-3);
    flex: none;
  }
  @media (max-width: 640px) {
    .row-main {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .metric {
      align-items: flex-start;
    }
  }
</style>
