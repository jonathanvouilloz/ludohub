<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'
  import type { MemberRow } from '$lib/server/schema'

  let {
    open = $bindable(false),
    responsable = false,
    members = [],
  }: { open?: boolean; responsable?: boolean; members?: MemberRow[] } = $props()

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  // En mode responsable : planification directe (approuvée) pour un membre.
  // En mode membre : demande classique (en attente).
  let memberId = $state('')
  let type = $state<string>('conge')
  let startDate = $state('')
  let endDate = $state('')
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  const selectedMemberName = $derived(
    members.find((m) => m.id === memberId)?.name ?? 'Choisir un membre',
  )

  // Réinitialise les champs à chaque ouverture.
  $effect(() => {
    if (open) {
      memberId = ''
      type = responsable ? 'vacances' : 'conge'
      startDate = ''
      endDate = ''
      notes = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>
        {responsable ? 'Planifier une absence' : "Nouvelle demande d'absence"}
      </Dialog.Title>
      <Dialog.Description>
        {responsable
          ? "L'absence est enregistrée directement, sans validation."
          : 'Indiquez le type et la période. Un·e responsable validera votre demande.'}
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={responsable ? '?/createForMember' : '?/request'}
      use:enhance={toastEnhance({
        success: responsable ? 'Absence créée.' : 'Demande envoyée.',
        errorMode: 'inline',
        onPending: (p) => (submitting = p),
        onError: (m) => (error = m),
        onSuccess: () => (open = false),
      })}
    >
      {#if responsable}
        <div class="field">
          <Label for="absence-member">Membre</Label>
          <Select.Root type="single" name="memberId" bind:value={memberId}>
            <Select.Trigger id="absence-member">{selectedMemberName}</Select.Trigger>
            <Select.Content>
              {#each members as m (m.id)}
                <Select.Item value={m.id} label={m.name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}

      <div class="field">
        <Label for="absence-type">Type</Label>
        <Select.Root type="single" name="type" bind:value={type}>
          <Select.Trigger id="absence-type">{typeLabels[type]}</Select.Trigger>
          <Select.Content>
            <Select.Item value="conge" label="Congé" />
            <Select.Item value="vacances" label="Vacances" />
            <Select.Item value="formation" label="Formation" />
            <Select.Item value="indisponible" label="Indisponible" />
          </Select.Content>
        </Select.Root>
      </div>

      <div class="row">
        <div class="field">
          <Label for="absence-start">Du</Label>
          <DatePicker id="absence-start" name="startDate" bind:value={startDate} />
        </div>
        <div class="field">
          <Label for="absence-end">Au</Label>
          <DatePicker id="absence-end" name="endDate" bind:value={endDate} minValue={startDate} />
        </div>
      </div>

      <div class="field">
        <Label for="absence-notes">Note (facultatif)</Label>
        <textarea
          id="absence-notes"
          name="notes"
          bind:value={notes}
          rows="3"
          placeholder="Précisez si besoin…"
        ></textarea>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || (responsable && !memberId)}>
          {#if submitting}
            {responsable ? 'Enregistrement…' : 'Envoi…'}
          {:else}
            {responsable ? "Enregistrer l'absence" : 'Envoyer la demande'}
          {/if}
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
  .row {
    display: flex;
    gap: var(--space-4);
  }
  .row .field {
    flex: 1;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  textarea {
    font: inherit;
    color: var(--text-main);
    background: var(--bg-input, var(--bg-card));
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--ring, var(--ludo-color));
    outline-offset: 1px;
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
