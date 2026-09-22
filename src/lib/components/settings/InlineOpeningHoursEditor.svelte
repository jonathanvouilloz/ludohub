<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import type { OpeningHourInput } from '$lib/utils/opening-hours.js'
  import OpeningHoursEditor from './OpeningHoursEditor.svelte'

  let {
    siteId,
    openingHours,
    onDone = () => {},
    onCancel = () => {},
  }: {
    siteId: string
    openingHours: OpeningHourInput[]
    onDone?: () => void
    onCancel?: () => void
  } = $props()

  let hours = $state<OpeningHourInput[]>([])
  let initialized = $state(false)
  let saving = $state(false)

  $effect(() => {
    if (initialized) return
    hours = openingHours.map((item) => ({ ...item }))
    initialized = true
  })
</script>

<form
  method="POST"
  action="?/updateHours"
  use:enhance={toastEnhance({
    success: 'Horaires enregistrés.',
    errorMode: 'inline',
    onPending: (value) => (saving = value),
    onSuccess: () => onDone(),
    updateOptions: { reset: false },
  })}
>
  <input type="hidden" name="siteId" value={siteId} />
  <input type="hidden" name="openingHours" value={JSON.stringify(hours)} />
  <OpeningHoursEditor bind:value={hours} />
  <div class="actions">
    <Button type="button" variant="outline" onclick={onCancel} disabled={saving}>Annuler</Button>
    <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
  </div>
</form>

<style>
  form {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
