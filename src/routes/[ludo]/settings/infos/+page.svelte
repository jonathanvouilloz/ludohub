<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import ColorPicker from '$lib/components/admin/ColorPicker.svelte'

  let { data, form } = $props()

  let color = $state('')
  let saving = $state(false)
  let logoInput = $state<HTMLInputElement | null>(null)

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
{/if}

<section class="card logo-card">
  <div class="logo-head">
    <div>
      <h2>Logo</h2>
      <p class="muted">Affiché dans l'en-tête de vos emails (jpg, png, webp ou svg — 2 Mo max).</p>
    </div>
    {#if data.ludo.logoUrl}
      <img class="logo-preview" src={data.ludo.logoUrl} alt="Logo {data.ludo.name}" />
    {/if}
  </div>

  <div class="logo-actions">
    <form
      method="POST"
      action="?/uploadLogo"
      enctype="multipart/form-data"
      use:enhance={toastEnhance({ success: 'Logo mis à jour.', errorMode: 'inline' })}
    >
      <input
        type="file"
        name="logo"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        required
        bind:this={logoInput}
        onchange={() => logoInput?.form?.requestSubmit()}
      />
    </form>

    {#if data.ludo.logoUrl}
      <form
        method="POST"
        action="?/removeLogo"
        use:enhance={toastEnhance({ success: 'Logo retiré.' })}
      >
        <Button type="submit" variant="ghost" size="sm">Retirer</Button>
      </form>
    {/if}
  </div>
</section>

<section class="card">
  <form
    method="POST"
    action="?/update"
    use:enhance={toastEnhance({
      success: 'Infos mises à jour.',
      errorMode: 'inline',
      onPending: (p) => (saving = p),
      updateOptions: { reset: false },
    })}
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
  .logo-card {
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .logo-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }
  h2 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
    font-size: var(--text-body);
  }
  .logo-preview {
    max-height: 56px;
    max-width: 160px;
    object-fit: contain;
    border-radius: var(--radius-sm);
  }
  .logo-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
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
