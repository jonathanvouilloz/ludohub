<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import SlotCard from './SlotCard.svelte'
  import AssignMemberDialog from './AssignMemberDialog.svelte'
  import SwapDialog from './SwapDialog.svelte'
  import type { AssignmentRow, MemberRow, SaturdaySlotRow } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & { member: MemberRow }
  type SlotWithAssignments = SaturdaySlotRow & { assignments: AssignmentWithMember[] }

  let {
    slots,
    members = [],
    readOnly = false,
  }: {
    slots: SlotWithAssignments[]
    members?: MemberRow[]
    readOnly?: boolean
  } = $props()

  let assignOpen = $state(false)
  let assignSlotId = $state('')
  let swapOpen = $state(false)

  const assignSlot = $derived(slots.find((s) => s.id === assignSlotId))

  function openAssign(slotId: string) {
    assignSlotId = slotId
    assignOpen = true
  }
</script>

{#if !readOnly}
  <div class="toolbar">
    <Button variant="outline" size="sm" onclick={() => (swapOpen = true)}>⇄ Échanger</Button>
  </div>
{/if}

{#if slots.length === 0}
  <p class="muted">Aucun samedi dans cette saison.</p>
{:else}
  <div class="grid">
    {#each slots as slot (slot.id)}
      <SlotCard {slot} {readOnly} onAssign={openAssign} />
    {/each}
  </div>
{/if}

{#if !readOnly}
  {#if assignSlot}
    <AssignMemberDialog
      bind:open={assignOpen}
      slotId={assignSlotId}
      {members}
      assignedIds={assignSlot.assignments.map((a) => a.member.id)}
    />
  {/if}
  <SwapDialog bind:open={swapOpen} {slots} />
{/if}

<style>
  .toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-4);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }
  .muted {
    color: var(--text-muted);
  }
</style>
