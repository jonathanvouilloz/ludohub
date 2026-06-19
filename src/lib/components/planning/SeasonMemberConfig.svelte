<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'
  import DataTable from '$lib/components/ui/data-table/DataTable.svelte'
  import * as Table from '$lib/components/ui/table/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow, SeasonMemberSettingRow } from '$lib/server/schema'

  let {
    members,
    memberSettings,
    seasonAbsences,
    readOnly = false,
  }: {
    members: MemberRow[]
    memberSettings: SeasonMemberSettingRow[]
    seasonAbsences: AbsenceRow[]
    readOnly?: boolean
  } = $props()

  const settingsMap = $derived(new Map(memberSettings.map((s) => [s.memberId, s.isPermanent])))

  const absencesByMember = $derived(() => {
    const m = new Map<string, AbsenceRow[]>()
    for (const a of seasonAbsences) {
      const list = m.get(a.memberId)
      if (list) list.push(a)
      else m.set(a.memberId, [a])
    }
    return m
  })

  let addingIndispo = $state<string | null>(null)
  let indispoStart = $state('')
  let indispoEnd = $state('')
  let indispoError = $state('')
  let submitting = $state(false)

  function openIndispo(memberId: string) {
    addingIndispo = memberId
    indispoStart = ''
    indispoEnd = ''
    indispoError = ''
  }

  function closeIndispo() {
    addingIndispo = null
    indispoError = ''
  }
</script>

{#if members.length === 0}
  <p class="muted">Aucun membre actif dans cette ludothèque.</p>
{:else}
  <DataTable>
    {#snippet head()}
      <Table.Row>
        <Table.Head>Membre</Table.Head>
        <Table.Head>Statut</Table.Head>
        <Table.Head>Indisponibilités</Table.Head>
        {#if !readOnly}
          <Table.Head class="text-right"></Table.Head>
        {/if}
      </Table.Row>
    {/snippet}

    {#snippet body()}
      {#each members as member (member.id)}
        {@const isPermanent = settingsMap.get(member.id) ?? false}
        {@const absences = absencesByMember().get(member.id) ?? []}

        <Table.Row>
          <Table.Cell class="font-medium">{member.name}</Table.Cell>

          <Table.Cell>
            {#if !readOnly}
              <form
                method="POST"
                action="?/saveMemberConfig"
                use:enhance={toastEnhance({ success: 'Configuration enregistrée.' })}
              >
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="isPermanent" value={isPermanent ? 'false' : 'true'} />
                <button type="submit" class="badge-btn" class:permanent={isPermanent}>
                  {isPermanent ? '★ Permanent' : '☆ Pool'}
                </button>
              </form>
            {:else}
              <span class="badge-static" class:permanent={isPermanent}>
                {isPermanent ? '★ Permanent' : 'Pool'}
              </span>
            {/if}
          </Table.Cell>

          <Table.Cell>
            {#if absences.length > 0}
              <div class="chips">
                {#each absences as a (a.id)}
                  <span class="chip">
                    {formatDateShort(a.startDate)}–{formatDateShort(a.endDate)}
                  </span>
                {/each}
              </div>
            {:else}
              <span class="none">—</span>
            {/if}
          </Table.Cell>

          {#if !readOnly}
            <Table.Cell class="text-right">
              <button
                type="button"
                class="btn-indispo"
                onclick={() =>
                  addingIndispo === member.id ? closeIndispo() : openIndispo(member.id)}
              >
                {addingIndispo === member.id ? 'Annuler' : '+ Indispo'}
              </button>
            </Table.Cell>
          {/if}
        </Table.Row>

        {#if addingIndispo === member.id}
          <Table.Row>
            <Table.Cell colspan={4} style="background: var(--bg-sidebar); padding: var(--space-4);">
              <form
                class="indispo-form"
                method="POST"
                action="?/addUnavailability"
                use:enhance={toastEnhance({
                  success: 'Indisponibilité ajoutée.',
                  errorMode: 'inline',
                  errorFallback: 'Erreur.',
                  onPending: (p) => (submitting = p),
                  onError: (m) => (indispoError = m),
                  onSuccess: () => closeIndispo(),
                })}
              >
                <input type="hidden" name="memberId" value={member.id} />
                <div class="field">
                  <Label>Du</Label>
                  <DatePicker
                    bind:value={indispoStart}
                    name="startDate"
                    placeholder="Date de début"
                  />
                </div>
                <div class="field">
                  <Label>Au</Label>
                  <DatePicker
                    bind:value={indispoEnd}
                    name="endDate"
                    placeholder="Date de fin"
                    minValue={indispoStart}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !indispoStart || !indispoEnd}
                >
                  {submitting ? 'Ajout…' : 'Ajouter'}
                </Button>
              </form>
              {#if indispoError}
                <p class="error" role="alert">{indispoError}</p>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/if}
      {/each}
    {/snippet}
  </DataTable>
{/if}

<style>
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .badge-btn {
    border: 1px solid var(--border);
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-small);
    color: var(--text-muted);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .badge-btn.permanent {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
  }
  .badge-btn:hover:not(.permanent) {
    border-color: var(--primary);
    color: var(--primary);
  }
  .badge-static {
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .badge-static.permanent {
    color: var(--primary);
    font-weight: 600;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .chip {
    font-size: var(--text-xs);
    color: var(--text-muted);
    background: var(--warning-light);
    border-radius: var(--radius-sm);
    padding: 1px var(--space-2);
    white-space: nowrap;
  }
  .none {
    color: var(--text-muted);
    opacity: 0.5;
  }
  .btn-indispo {
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--text-small);
    color: var(--text-muted);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }
  .btn-indispo:hover {
    color: var(--primary);
    background: var(--bg-hover);
  }
  .indispo-form {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 160px;
  }
  .error {
    margin: var(--space-2) 0 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
