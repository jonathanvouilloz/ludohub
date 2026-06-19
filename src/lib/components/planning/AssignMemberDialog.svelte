<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import type { MemberRow } from '$lib/server/schema'

  let {
    open = $bindable(false),
    slotId,
    members,
    assignedIds = [],
  }: {
    open?: boolean
    slotId: string
    members: MemberRow[]
    assignedIds?: string[]
  } = $props()

  let memberId = $state('')
  let submitting = $state(false)

  const available = $derived(members.filter((m) => !assignedIds.includes(m.id)))
  const selectedName = $derived(
    available.find((m) => m.id === memberId)?.name ?? 'Choisir un membre',
  )

  $effect(() => {
    if (open) {
      memberId = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Assigner un membre</Dialog.Title>
      <Dialog.Description>Choisissez un membre actif à ajouter à ce samedi.</Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/assign"
      use:enhance={toastEnhance({
        success: null,
        onPending: (p) => (submitting = p),
        onSuccess: () => (open = false),
      })}
    >
      <input type="hidden" name="slotId" value={slotId} />

      <div class="field">
        <Label for="assign-member">Membre</Label>
        <Select.Root type="single" name="memberId" bind:value={memberId}>
          <Select.Trigger id="assign-member">{selectedName}</Select.Trigger>
          <Select.Content>
            {#each available as m (m.id)}
              <Select.Item value={m.id} label={m.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      {#if available.length === 0}
        <p class="muted">Tous les membres actifs sont déjà assignés à ce samedi.</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !memberId}>
          {submitting ? 'Ajout…' : 'Assigner'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .muted {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
