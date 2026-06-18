<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { formatDateCH } from '$lib/utils/dates.js'
  import PhoneIcon from '@lucide/svelte/icons/phone'
  import HelpResponseList from './HelpResponseList.svelte'

  type Response = {
    id: string
    status: string
    memberId: string
    member?: { name: string } | null
    ludo?: { name: string; color?: string | null; phone?: string | null } | null
  }
  type FeedRequest = {
    id: string
    date: string
    slotInfo?: string | null
    notes?: string | null
    status: string
    ludo?: { name: string; color?: string | null; phone?: string | null } | null
    responses: Response[]
    isMine?: boolean
    myResponse?: Response | null
  }

  let { request, readonly = false }: { request: FeedRequest; readonly?: boolean } = $props()

  const statusLabels: Record<string, string> = {
    ouverte: 'Ouverte',
    pourvue: 'Pourvue',
    annulee: 'Annulée',
  }
</script>

<article class="card">
  <header>
    <span class="who">
      <span class="dot" style="background: {request.ludo?.color ?? 'var(--primary)'}"></span>
      <strong>{request.ludo?.name ?? '—'}</strong>
    </span>
    <span class="head-actions">
      {#if request.ludo?.phone}
        <a
          href="tel:{request.ludo.phone}"
          class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          title="Appeler {request.ludo.name}"
        >
          <PhoneIcon aria-hidden="true" />
          <span class="sr-only">Appeler {request.ludo.name}</span>
        </a>
      {/if}
      {#if request.status === 'ouverte'}
        <Badge variant="outline">{statusLabels[request.status]}</Badge>
      {:else}
        <Badge variant="secondary">{statusLabels[request.status] ?? request.status}</Badge>
      {/if}
    </span>
  </header>

  <p class="date">{formatDateCH(request.date)}</p>
  {#if request.slotInfo}<p class="slot">{request.slotInfo}</p>{/if}
  {#if request.notes}<p class="notes">{request.notes}</p>{/if}

  {#if request.isMine}
    <div class="section">
      <h4>Volontaires</h4>
      <HelpResponseList
        requestId={request.id}
        responses={request.responses}
        confirmable={!readonly && request.status === 'ouverte'}
      />
    </div>
    {#if !readonly && request.status === 'ouverte'}
      <form method="POST" action="?/cancel" use:enhance class="cancel">
        <input type="hidden" name="requestId" value={request.id} />
        <Button type="submit" variant="ghost" size="sm">Annuler la demande</Button>
      </form>
    {/if}
  {:else if !readonly}
    <div class="section">
      {#if request.myResponse}
        <Badge variant="secondary">Vous êtes volontaire</Badge>
      {:else}
        <form method="POST" action="?/respond" use:enhance>
          <input type="hidden" name="requestId" value={request.id} />
          <Button type="submit" size="sm">Je suis disponible</Button>
        </form>
      {/if}
    </div>
  {/if}
</article>

<style>
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: var(--radius-full, 9999px);
    flex-shrink: 0;
  }
  .date {
    margin: var(--space-2) 0 0;
    color: var(--text-main);
    font-weight: var(--weight-medium);
  }
  .slot {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .notes {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .section {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .section h4 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-small);
    color: var(--text-subtle);
    font-weight: var(--weight-medium);
  }
  .cancel {
    margin-top: var(--space-2);
  }
</style>
