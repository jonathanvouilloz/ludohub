<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import type { MemberRow } from '$lib/server/schema'

  let { open = $bindable(false), member = null }: { open?: boolean; member?: MemberRow | null } =
    $props()

  const roleLabels: Record<string, string> = { member: 'Membre', responsable: 'Responsable' }

  let name = $state('')
  let role = $state<string>('member')
  let error = $state('')
  let submitting = $state(false)

  const isEdit = $derived(member !== null)

  // Réinitialise les champs à chaque ouverture selon le membre édité (ou vide en création).
  $effect(() => {
    if (open) {
      name = member?.name ?? ''
      role = member?.role ?? 'member'
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier le membre' : 'Nouveau membre'}</Dialog.Title>
      <Dialog.Description>Renseignez le nom et le rôle, puis enregistrez.</Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
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
      {#if isEdit && member}
        <input type="hidden" name="id" value={member.id} />
      {/if}

      <div class="field">
        <Label for="member-name">Nom</Label>
        <Input id="member-name" name="name" bind:value={name} placeholder="Prénom Nom" required />
      </div>

      <div class="field">
        <Label for="member-role">Rôle</Label>
        <Select.Root type="single" name="role" bind:value={role}>
          <Select.Trigger id="member-role">{roleLabels[role]}</Select.Trigger>
          <Select.Content>
            <Select.Item value="member" label="Membre" />
            <Select.Item value="responsable" label="Responsable" />
          </Select.Content>
        </Select.Root>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
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
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
