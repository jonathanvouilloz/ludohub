<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import type { NewsletterContactRow } from '$lib/server/schema'

  let {
    open = $bindable(false),
    contact = null,
  }: { open?: boolean; contact?: NewsletterContactRow | null } = $props()

  const isEdit = $derived(contact !== null)

  let email = $state('')
  let firstName = $state('')
  let lastName = $state('')
  let notes = $state('')
  let status = $state<string>('subscribed')
  let submitting = $state(false)

  // (Ré)initialise les champs à chaque ouverture, selon le mode.
  $effect(() => {
    if (open) {
      email = contact?.email ?? ''
      firstName = contact?.firstName ?? ''
      lastName = contact?.lastName ?? ''
      notes = contact?.notes ?? ''
      status = contact?.status ?? 'subscribed'
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier le contact' : 'Ajouter un contact'}</Dialog.Title>
      <Dialog.Description>
        {isEdit
          ? "Mettez à jour les informations de l'abonné."
          : 'Un contact du public de votre ludothèque.'}
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Contact mis à jour.' : 'Contact ajouté.',
        onPending: (p) => (submitting = p),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}
        <input type="hidden" name="id" value={contact?.id} />
      {/if}

      <div class="field">
        <Label for="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          bind:value={email}
          placeholder="prenom@exemple.ch"
          required
        />
      </div>

      <div class="grid-2">
        <div class="field">
          <Label for="contact-first">Prénom</Label>
          <Input id="contact-first" name="firstName" bind:value={firstName} placeholder="Prénom" />
        </div>
        <div class="field">
          <Label for="contact-last">Nom</Label>
          <Input id="contact-last" name="lastName" bind:value={lastName} placeholder="Nom" />
        </div>
      </div>

      {#if isEdit}
        <div class="field">
          <Label for="contact-status">Statut</Label>
          <select id="contact-status" name="status" bind:value={status}>
            <option value="subscribed">Abonné</option>
            <option value="unsubscribed">Désabonné</option>
            <option value="bounced">Rejeté</option>
          </select>
        </div>
      {/if}

      <div class="field">
        <Label for="contact-notes">Note (facultatif)</Label>
        <textarea
          id="contact-notes"
          name="notes"
          bind:value={notes}
          rows="2"
          placeholder="Note interne…"
        ></textarea>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  select,
  textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font-family: inherit;
    font-size: var(--text-body);
  }
  textarea {
    resize: vertical;
  }
  @media (max-width: 480px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
