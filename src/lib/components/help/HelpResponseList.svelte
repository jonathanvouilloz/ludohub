<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import CheckIcon from '@lucide/svelte/icons/check'
  import PhoneIcon from '@lucide/svelte/icons/phone'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import HandHelpingIcon from '@lucide/svelte/icons/hand-helping'

  type Response = {
    id: string
    status: string
    member?: { name: string } | null
    ludo?: { name: string; color?: string | null; phone?: string | null } | null
  }

  let {
    requestId,
    responses,
    confirmable = true,
  }: { requestId: string; responses: Response[]; confirmable?: boolean } = $props()
</script>

{#if responses.length === 0}
  <EmptyState icon={HandHelpingIcon} title="Aucun volontaire pour l'instant." compact />
{:else}
  <ul class="responses">
    {#each responses as resp (resp.id)}
      <li class="response">
        <span class="who">
          <span class="line1">
            <span class="dot" style="background: {resp.ludo?.color ?? 'var(--primary)'}"></span>
            <strong>{resp.member?.name ?? '—'}</strong>
          </span>
          <span class="ludo">{resp.ludo?.name ?? '—'}</span>
        </span>
        <span class="resp-actions">
          {#if resp.ludo?.phone}
            <a
              href="tel:{resp.ludo.phone}"
              class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
              title="Appeler {resp.ludo.name}"
            >
              <PhoneIcon aria-hidden="true" />
              <span class="sr-only">Appeler {resp.ludo?.name ?? 'le volontaire'}</span>
            </a>
          {/if}
          {#if resp.status === 'confirme'}
            <Badge variant="secondary">Confirmé·e</Badge>
          {:else if resp.status === 'refuse'}
            <Badge variant="outline">Non retenu·e</Badge>
          {:else if confirmable}
            <form method="POST" action="?/confirm" use:enhance={toastEnhance({ success: null })}>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="responseId" value={resp.id} />
              <button
                type="submit"
                class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                title="Confirmer ce volontaire"
              >
                <CheckIcon aria-hidden="true" />
                <span class="sr-only">Confirmer</span>
              </button>
            </form>
          {/if}
        </span>
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
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    font-size: var(--text-small);
    color: var(--text-main);
  }
  .line1 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .ludo {
    align-self: flex-end;
    color: var(--text-muted);
    font-size: var(--text-label, var(--text-small));
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: var(--radius-full, 9999px);
    flex-shrink: 0;
  }
  .resp-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  .resp-actions :global(form) {
    display: inline-flex;
  }
</style>
