<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AssignmentRow, MemberRow, SaturdaySlotRow } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & { member: MemberRow }
  type SlotWithAssignments = SaturdaySlotRow & { assignments: AssignmentWithMember[] }

  let { open = $bindable(false), slots }: { open?: boolean; slots: SlotWithAssignments[] } =
    $props()

  let slotAId = $state('')
  let memberAId = $state('')
  let slotBId = $state('')
  let memberBId = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Seuls les samedis non annulés avec au moins une personne assignée sont échangeables.
  const eligible = $derived(slots.filter((s) => !s.isCancelled && s.assignments.length > 0))
  const slotLabel = (id: string) => {
    const s = eligible.find((x) => x.id === id)
    return s ? formatDateShort(s.date) : 'Choisir un samedi'
  }
  const memberLabel = (slotId: string, memberId: string) => {
    const s = eligible.find((x) => x.id === slotId)
    return s?.assignments.find((a) => a.member.id === memberId)?.member.name ?? 'Choisir un membre'
  }
  const membersOf = (slotId: string) =>
    eligible.find((x) => x.id === slotId)?.assignments.map((a) => a.member) ?? []

  $effect(() => {
    if (open) {
      slotAId = ''
      memberAId = ''
      slotBId = ''
      memberBId = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Échanger deux membres</Dialog.Title>
      <Dialog.Description>
        Le membre de gauche prend le samedi de droite, et inversement.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/swap"
      use:enhance={() => {
        submitting = true
        return async ({ result, update }) => {
          submitting = false
          if (result.type === 'failure') {
            error = String(result.data?.error ?? 'Une erreur est survenue.')
            await update({ reset: false })
            return
          }
          await update()
          open = false
        }
      }}
    >
      <input type="hidden" name="slotAId" value={slotAId} />
      <input type="hidden" name="memberAId" value={memberAId} />
      <input type="hidden" name="slotBId" value={slotBId} />
      <input type="hidden" name="memberBId" value={memberBId} />

      <div class="pair">
        <div class="side">
          <div class="field">
            <Label>Samedi A</Label>
            <Select.Root type="single" bind:value={slotAId}>
              <Select.Trigger>{slotLabel(slotAId)}</Select.Trigger>
              <Select.Content>
                {#each eligible as s (s.id)}
                  <Select.Item value={s.id} label={formatDateShort(s.date)} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="field">
            <Label>Membre A</Label>
            <Select.Root type="single" bind:value={memberAId}>
              <Select.Trigger>{memberLabel(slotAId, memberAId)}</Select.Trigger>
              <Select.Content>
                {#each membersOf(slotAId) as m (m.id)}
                  <Select.Item value={m.id} label={m.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <span class="swap-icon" aria-hidden="true">⇄</span>

        <div class="side">
          <div class="field">
            <Label>Samedi B</Label>
            <Select.Root type="single" bind:value={slotBId}>
              <Select.Trigger>{slotLabel(slotBId)}</Select.Trigger>
              <Select.Content>
                {#each eligible as s (s.id)}
                  <Select.Item value={s.id} label={formatDateShort(s.date)} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="field">
            <Label>Membre B</Label>
            <Select.Root type="single" bind:value={memberBId}>
              <Select.Trigger>{memberLabel(slotBId, memberBId)}</Select.Trigger>
              <Select.Content>
                {#each membersOf(slotBId) as m (m.id)}
                  <Select.Item value={m.id} label={m.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button
          type="submit"
          disabled={submitting || !memberAId || !memberBId || slotAId === slotBId}
        >
          {submitting ? 'Échange…' : 'Échanger'}
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
  .pair {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .swap-icon {
    color: var(--text-muted);
    font-size: var(--text-h3);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
