<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import ColorPicker from '$lib/components/admin/ColorPicker.svelte'

  let { data, form } = $props()

  let color = $state('')
  let saving = $state(false)

  // Synchronise la couleur avec le load (initial + après update), sans écraser la saisie.
  $effect.pre(() => {
    color = data.ludo.color
  })
</script>

<svelte:head>
  <title>Infos ludothèque — {data.ludo.name}</title>
</svelte:head>

<header class="head">
  <div>
    <h1>Infos ludothèque</h1>
    <p class="muted">Coordonnées publiques et apparence de votre ludothèque.</p>
  </div>
</header>

{#if form?.error}
  <p class="banner banner-error" role="alert">{form.error}</p>
{:else if form?.success}
  <p class="banner banner-ok" role="status">Modifications enregistrées.</p>
{/if}

<section class="card">
  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      saving = true
      return async ({ update }) => {
        saving = false
        await update({ reset: false })
      }
    }}
  >
    <div class="field">
      <Label for="ludo-name">Nom</Label>
      <Input id="ludo-name" name="name" value={data.ludo.name} required />
    </div>

    <ColorPicker bind:value={color} name="color" label="Couleur" id="ludo-color" required />

    <div class="field">
      <Label for="ludo-responsible">Responsable</Label>
      <Input
        id="ludo-responsible"
        name="responsible"
        value={data.ludo.responsible ?? ''}
        placeholder="Nom du/de la responsable"
      />
    </div>

    <div class="field">
      <Label for="ludo-address">Adresse</Label>
      <Input
        id="ludo-address"
        name="address"
        value={data.ludo.address ?? ''}
        placeholder="Rue, code postal, ville"
      />
    </div>

    <div class="grid-2">
      <div class="field">
        <Label for="ludo-phone">Téléphone</Label>
        <Input
          id="ludo-phone"
          name="phone"
          type="tel"
          value={data.ludo.phone ?? ''}
          placeholder="022 000 00 00"
        />
      </div>

      <div class="field">
        <Label for="ludo-email">Email</Label>
        <Input
          id="ludo-email"
          name="email"
          type="email"
          value={data.ludo.email ?? ''}
          placeholder="contact@ludo.ch"
        />
      </div>
    </div>

    <div class="field">
      <Label for="ludo-website">Site web</Label>
      <Input
        id="ludo-website"
        name="website"
        value={data.ludo.website ?? ''}
        placeholder="https://ludo.ch"
      />
    </div>

    <div class="actions">
      <Button type="submit" disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  </form>
</section>

<style>
  .head {
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
    font-size: var(--text-small);
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .banner-error {
    background: var(--danger-light);
    color: var(--danger);
  }
  .banner-ok {
    background: var(--success-light);
    color: var(--success);
  }
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
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 640px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
