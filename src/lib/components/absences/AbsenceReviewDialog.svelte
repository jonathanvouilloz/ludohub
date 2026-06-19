<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { toast } from '$lib/components/ui/sonner/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow } from '$lib/server/schema'

  type AbsenceWithMember = AbsenceRow & { member?: MemberRow | null }

  let {
    open = $bindable(false),
    absence = null,
  }: { open?: boolean; absence?: AbsenceWithMember | null } = $props()

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  let note = $state('')
  let error = $state('')
  let submitting = $state(false)
  // Mémorise quelle décision a été soumise (refuse/approve) pour le message toast.
  let pendingAction = $state<'refuse' | 'approve' | null>(null)

  $effect(() => {
    if (open) {
      note = ''
      error = ''
    }
  })

  const handler = toastEnhance({
    success: null,
    errorMode: 'inline',
    onPending: (p) => (submitting = p),
    onError: (m) => (error = m),
    onSuccess: () => {
      toast.success(pendingAction === 'refuse' ? 'Demande refusée.' : 'Demande approuvée.')
      open = false
    },
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Examiner la demande</Dialog.Title>
      <Dialog.Description>Approuvez ou refusez la demande d'absence.</Dialog.Description>
    </Dialog.Header>

    {#if absence}
      <dl class="summary">
        <div>
          <dt>Membre</dt>
          <dd>{absence.member?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{typeLabels[absence.type] ?? absence.type}</dd>
        </div>
        <div>
          <dt>Période</dt>
          <dd>{formatDateShort(absence.startDate)} → {formatDateShort(absence.endDate)}</dd>
        </div>
        {#if absence.notes}
          <div>
            <dt>Note du membre</dt>
            <dd>{absence.notes}</dd>
          </div>
        {/if}
      </dl>

      <form method="POST" use:enhance={handler}>
        <input type="hidden" name="id" value={absence.id} />

        <div class="field">
          <Label for="review-note">Note (obligatoire pour un refus)</Label>
          <textarea id="review-note" name="note" bind:value={note} rows="3"></textarea>
        </div>

        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}

        <Dialog.Footer>
          <Button
            type="submit"
            formaction="?/refuse"
            variant="destructive"
            disabled={submitting}
            onclick={() => (pendingAction = 'refuse')}
          >
            Refuser
          </Button>
          <Button
            type="submit"
            formaction="?/approve"
            disabled={submitting}
            onclick={() => (pendingAction = 'approve')}
          >
            Approuver
          </Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  .summary {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .summary div {
    display: flex;
    gap: var(--space-3);
  }
  .summary dt {
    flex: 0 0 7rem;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .summary dd {
    margin: 0;
    color: var(--text-main);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
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
    margin: var(--space-2) 0 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
