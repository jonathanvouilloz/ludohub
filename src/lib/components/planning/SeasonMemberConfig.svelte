<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'
  import DataTable from '$lib/components/ui/data-table/DataTable.svelte'
  import * as Table from '$lib/components/ui/table/index.js'
  import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow, SeasonMemberSettingRow, SeasonRow } from '$lib/server/schema'

  let {
    season,
    members,
    memberSettings,
    seasonAbsences,
    readOnly = false,
  }: {
    season: SeasonRow
    members: MemberRow[]
    memberSettings: SeasonMemberSettingRow[]
    seasonAbsences: AbsenceRow[]
    readOnly?: boolean
  } = $props()

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  const settingsMap = $derived(new Map(memberSettings.map((s) => [s.memberId, s.isPermanent])))

  const absencesByMember = $derived.by(() => {
    const m = new Map<string, AbsenceRow[]>()
    for (const a of seasonAbsences) {
      const list = m.get(a.memberId)
      if (list) list.push(a)
      else m.set(a.memberId, [a])
    }
    // Ordre chronologique : la dernière ajoutée n'atterrit pas au hasard dans la liste.
    for (const list of m.values()) list.sort((a, b) => a.startDate.localeCompare(b.startDate))
    return m
  })

  function absencesOf(memberId: string): AbsenceRow[] {
    return absencesByMember.get(memberId) ?? []
  }

  let addingIndispo = $state<string | null>(null)
  let indispoStart = $state('')
  let indispoEnd = $state('')
  let indispoError = $state('')
  let submitting = $state(false)

  // Consultation seule, depuis le compteur de la colonne « Indisponibilités ».
  let viewingMember = $state<MemberRow | null>(null)

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

  // Après un ajout : on vide les dates mais on GARDE le panneau ouvert, pour que
  // la ligne fraîchement créée s'affiche juste au-dessus du formulaire — c'est le
  // retour visuel qui manquait (on ne savait pas si l'ajout avait été pris).
  function resetIndispoForm() {
    indispoStart = ''
    indispoEnd = ''
    indispoError = ''
  }
</script>

{#snippet absenceList(list: AbsenceRow[], emptyText: string)}
  {#if list.length === 0}
    <p class="empty">{emptyText}</p>
  {:else}
    <ul class="indispo-list">
      {#each list as a (a.id)}
        <li>
          <div class="indispo-main">
            <span class="indispo-dates">
              {formatDateShort(a.startDate)} – {formatDateShort(a.endDate)}
            </span>
            <span class="indispo-type">{typeLabels[a.type] ?? a.type}</span>
          </div>
          {#if a.notes}
            <p class="indispo-notes">{a.notes}</p>
          {/if}
          {#if !readOnly}
            <form
              method="POST"
              action="?/deleteUnavailability"
              use:enhance={toastEnhance({ success: 'Indisponibilité supprimée.' })}
            >
              <input type="hidden" name="absenceId" value={a.id} />
              <button type="submit" class="btn-delete" aria-label="Supprimer cette période">
                <Trash2Icon size={15} aria-hidden="true" />
              </button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

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
        {@const absences = absencesOf(member.id)}

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

          <!-- Compteur cliquable : ouvre la liste complète du membre. Les chips
               seules ne suffisaient pas à confirmer qu'un ajout avait été pris. -->
          <Table.Cell>
            {#if absences.length > 0}
              <button type="button" class="count-btn" onclick={() => (viewingMember = member)}>
                {absences.length}
                {absences.length > 1 ? 'périodes' : 'période'}
                <span class="count-hint">Voir</span>
              </button>
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
                {addingIndispo === member.id ? 'Fermer' : '+ Indispo'}
              </button>
            </Table.Cell>
          {/if}
        </Table.Row>

        {#if addingIndispo === member.id}
          <Table.Row>
            <Table.Cell colspan={4} style="background: var(--bg-sidebar); padding: var(--space-4);">
              <div class="panel">
                <div class="panel-current">
                  <h3 class="panel-title">Indisponibilités de {member.name}</h3>
                  {@render absenceList(absences, 'Aucune période enregistrée pour cette saison.')}
                </div>

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
                    onSuccess: () => resetIndispoForm(),
                  })}
                >
                  <input type="hidden" name="memberId" value={member.id} />
                  <div class="field">
                    <Label>Du</Label>
                    <DatePicker
                      bind:value={indispoStart}
                      name="startDate"
                      placeholder="Date de début"
                      minValue={season.startDate}
                      maxValue={season.endDate}
                    />
                  </div>
                  <div class="field">
                    <Label>Au</Label>
                    <DatePicker
                      bind:value={indispoEnd}
                      name="endDate"
                      placeholder="Date de fin"
                      minValue={indispoStart || season.startDate}
                      maxValue={season.endDate}
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
                <!-- Les dates sont bornées à la saison : hors saison, la période
                     serait enregistrée mais invisible ici (la liste est filtrée
                     sur la plage de la saison). -->
                <p class="bounds-hint">
                  Saison du {formatDateShort(season.startDate)} au {formatDateShort(
                    season.endDate,
                  )}.
                </p>

                {#if indispoError}
                  <p class="error" role="alert">{indispoError}</p>
                {/if}
              </div>
            </Table.Cell>
          </Table.Row>
        {/if}
      {/each}
    {/snippet}
  </DataTable>
{/if}

<Dialog.Root
  open={viewingMember != null}
  onOpenChange={(v) => {
    if (!v) viewingMember = null
  }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>
        Indisponibilités — {viewingMember?.name ?? ''}
      </Dialog.Title>
      <Dialog.Description>
        Périodes sur la saison « {season.name} » ({formatDateShort(season.startDate)} – {formatDateShort(
          season.endDate,
        )}).
      </Dialog.Description>
    </Dialog.Header>

    {#if viewingMember}
      {@const list = absencesOf(viewingMember.id)}
      {#if list.length === 0}
        <div class="modal-empty">
          <CalendarOffIcon size={28} aria-hidden="true" />
          <p>Aucune période enregistrée pour cette saison.</p>
        </div>
      {:else}
        {@render absenceList(list, '')}
      {/if}
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (viewingMember = null)}>Fermer</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

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

  /* Compteur d'indisponibilités : lisible d'un coup d'œil et cliquable. */
  .count-btn {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    border: 1px solid var(--border);
    background: var(--warning-light);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-small);
    color: var(--text-main);
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s;
  }
  .count-btn:hover {
    border-color: var(--primary);
  }
  .count-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
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

  /* Panneau déplié : liste courante au-dessus du formulaire d'ajout. */
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .panel-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-small);
    font-weight: 600;
    color: var(--text-main);
  }
  .indispo-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .indispo-list li {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .indispo-main {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .indispo-dates {
    font-size: var(--text-small);
    font-weight: 500;
    color: var(--text-main);
    white-space: nowrap;
  }
  .indispo-type {
    font-size: var(--text-xs);
    color: var(--text-muted);
    background: var(--warning-light);
    border-radius: var(--radius-sm);
    padding: 1px var(--space-2);
  }
  .indispo-notes {
    grid-column: 1 / -1;
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .btn-delete {
    display: inline-flex;
    align-items: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }
  .btn-delete:hover {
    color: var(--danger);
    background: var(--bg-hover);
  }
  .empty {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .modal-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) 0;
    color: var(--text-muted);
  }
  .modal-empty p {
    margin: 0;
    font-size: var(--text-small);
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
  .bounds-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
