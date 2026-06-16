<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'

  type Response = {
    id: string
    status: string
    member?: { name: string } | null
    ludo?: { name: string; color?: string | null } | null
  }

  let {
    requestId,
    responses,
    confirmable = true,
  }: { requestId: string; responses: Response[]; confirmable?: boolean } = $props()
</script>

{#if responses.length === 0}
  <p class="empty">Aucun volontaire pour l'instant.</p>
{:else}
  <ul class="responses">
    {#each responses as resp (resp.id)}
      <li class="response">
        <span class="who">
          <span class="dot" style="background: {resp.ludo?.color ?? 'var(--primary)'}"></span>
          <strong>{resp.member?.name ?? '—'}</strong>
          <span class="muted">· {resp.ludo?.name ?? '—'}</span>
        </span>
        {#if resp.status === 'confirme'}
          <Badge variant="secondary">Confirmé·e</Badge>
        {:else if resp.status === 'refuse'}
          <Badge variant="outline">Non retenu·e</Badge>
        {:else if confirmable}
          <form method="POST" action="?/confirm" use:enhance>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="responseId" value={resp.id} />
            <Button type="submit" size="sm">Confirmer</Button>
          </form>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .responses {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .response {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-small);
    color: var(--text-main);
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: var(--radius-full, 9999px);
    flex-shrink: 0;
  }
  .muted {
    color: var(--text-muted);
  }
  .empty {
    margin: 0;
    color: var(--text-subtle);
    font-size: var(--text-small);
    font-style: italic;
  }
</style>
