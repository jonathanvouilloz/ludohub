<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import UsersIcon from '@lucide/svelte/icons/users'
  import type { MemberRow } from '$lib/server/schema'

  let {
    members,
    password,
    error = '',
  }: { members: MemberRow[]; password: string; error?: string } = $props()

  let submittingId = $state<string | null>(null)
</script>

<div class="picker">
  <p class="prompt">Qui êtes-vous ?</p>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if members.length === 0}
    <EmptyState
      icon={UsersIcon}
      title="Aucun membre actif."
      description="Contactez votre responsable."
    />
  {:else}
    <ul class="list">
      {#each members as member (member.id)}
        <li>
          <form
            method="POST"
            action="?/login"
            use:enhance={toastEnhance({
              success: null,
              errorMode: 'inline',
              onPending: (p) => (submittingId = p ? member.id : null),
              onError: (m) => (error = m),
            })}
          >
            <input type="hidden" name="password" value={password} />
            <input type="hidden" name="memberId" value={member.id} />
            <button type="submit" class="member" disabled={submittingId !== null}>
              <span class="name">{member.name}</span>
              {#if member.role === 'responsable'}
                <span class="badge">Responsable</span>
              {/if}
            </button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .prompt {
    margin: 0;
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .member {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition:
      border-color var(--dur-fast) var(--ease-out-strong),
      background var(--dur-fast) var(--ease-out-strong);
  }
  .member:hover:not(:disabled) {
    border-color: var(--ludo-color);
    background: var(--bg-hover);
  }
  .member:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    flex-shrink: 0;
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--ludo-color);
    background: color-mix(in srgb, var(--ludo-color) 12%, transparent);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
  }
</style>
