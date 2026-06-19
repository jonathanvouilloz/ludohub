<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { formatDateCH } from '$lib/utils/dates.js'
  import type { AbsenceRow, AssignmentRow, ClosurePeriodRow, MemberRow } from '$lib/server/schema'
  import type { SaturdaySlotRow } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & { member: MemberRow; absence?: AbsenceRow | null }
  type TimelineSlot = SaturdaySlotRow & {
    closure: ClosurePeriodRow | null
    assignments: AssignmentWithMember[]
  }

  let {
    open = $bindable(false),
    mySlot,
    currentMemberId,
    slots,
    today,
  }: {
    open?: boolean
    mySlot: TimelineSlot | null
    currentMemberId: string
    slots: TimelineSlot[]
    today: string
  } = $props()

  let slotBId = $state('')
  let memberBId = $state('')
  let submitting = $state(false)

  // Samedis échangeables : à venir, ouverts, hors fermeture, où quelqu'un d'autre
  // que moi est assigné, et où je ne suis pas déjà présent.
  const eligible = $derived(
    slots.filter(
      (s) =>
        s.id !== mySlot?.id &&
        s.date >= today &&
        !s.isCancelled &&
        !s.closure &&
        s.assignments.some((a) => a.member.id !== currentMemberId) &&
        !s.assignments.some((a) => a.member.id === currentMemberId),
    ),
  )
  const targetSlot = $derived(eligible.find((s) => s.id === slotBId) ?? null)
  const targetMembers = $derived(
    targetSlot?.assignments.filter((a) => a.member.id !== currentMemberId).map((a) => a.member) ??
      [],
  )

  const slotLabel = (id: string) => {
    const s = eligible.find((x) => x.id === id)
    return s ? formatDateCH(s.date) : 'Choisir un samedi'
  }
  const memberLabel = (id: string) =>
    targetMembers.find((m) => m.id === id)?.name ?? 'Choisir un membre'

  // Auto-sélection du membre quand un seul candidat sur le samedi cible.
  $effect(() => {
    if (targetMembers.length === 1) memberBId = targetMembers[0].id
  })

  $effect(() => {
    if (open) {
      slotBId = ''
      memberBId = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Échanger un samedi</Dialog.Title>
    </Dialog.Header>

    {#if mySlot}
      <p class="mine">
        <span class="label">Mon samedi :</span>
        <strong>{formatDateCH(mySlot.date)}</strong>
      </p>
    {/if}

    {#if eligible.length === 0}
      <p class="muted">Aucun samedi disponible pour un échange.</p>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Fermer</Button>
      </Dialog.Footer>
    {:else}
      <form
        method="POST"
        action="?/swap"
        use:enhance={toastEnhance({
          success: 'Échange effectué.',
          onPending: (p) => (submitting = p),
          onSuccess: () => (open = false),
        })}
      >
        <input type="hidden" name="slotAId" value={mySlot?.id} />
        <input type="hidden" name="memberAId" value={currentMemberId} />
        <input type="hidden" name="slotBId" value={slotBId} />
        <input type="hidden" name="memberBId" value={memberBId} />

        <div class="field">
          <Label>Avec quel samedi veux-tu échanger ?</Label>
          <Select.Root type="single" bind:value={slotBId}>
            <Select.Trigger>{slotLabel(slotBId)}</Select.Trigger>
            <Select.Content>
              {#each eligible as s (s.id)}
                <Select.Item value={s.id} label={formatDateCH(s.date)} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        {#if targetSlot && targetMembers.length > 1}
          <div class="field">
            <Label>Avec qui ?</Label>
            <Select.Root type="single" bind:value={memberBId}>
              <Select.Trigger>{memberLabel(memberBId)}</Select.Trigger>
              <Select.Content>
                {#each targetMembers as m (m.id)}
                  <Select.Item value={m.id} label={m.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        {/if}

        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
          <Button type="submit" disabled={submitting || !slotBId || !memberBId}>
            {submitting ? 'Échange…' : 'Échanger'}
          </Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  .mine {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--primary-light);
    color: var(--text-main);
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    text-transform: capitalize;
  }
  .mine .label {
    color: var(--text-muted);
    text-transform: none;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .muted {
    margin: var(--space-2) 0 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
