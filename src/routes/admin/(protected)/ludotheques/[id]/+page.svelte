<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import ColorPicker from '$lib/components/admin/ColorPicker.svelte'

  let { data, form } = $props()

  let color = $state('')
  let savingInfo = $state(false)
  let savingPassword = $state(false)

  // Synchronise la couleur avec le load (initial + après update), sans écraser la saisie.
  $effect.pre(() => {
    color = data.ludo.color
  })
</script>

<svelte:head>
  <title>{data.ludo.name} — Administration</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="head">
  <a class="back" href="/admin/ludotheques">← Ludothèques</a>
  <h1>{data.ludo.name}</h1>
  <p class="slug">
    Slug : <code>{data.ludo.slug}</code>
    <Badge variant="outline">non modifiable</Badge>
  </p>
</header>

<section class="card">
  <h2>Informations</h2>

  {#if form?.error}
    <p class="banner banner-error" role="alert">{form.error}</p>
  {:else if form?.success}
    <p class="banner banner-ok" role="status">Modifications enregistrées.</p>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      savingInfo = true
      return async ({ update }) => {
        savingInfo = false
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
      <Label for="ludo-address">Adresse</Label>
      <Input
        id="ludo-address"
        name="address"
        value={data.ludo.address ?? ''}
        placeholder="Rue, ville"
      />
    </div>

    <div class="actions">
      <Button type="submit" disabled={savingInfo}>
        {savingInfo ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  </form>
</section>

<section class="card">
  <h2>Réinitialiser le mot de passe</h2>
  <p class="muted">
    Le nouveau mot de passe remplace immédiatement l'ancien pour cette ludothèque.
  </p>

  {#if form?.passwordError}
    <p class="banner banner-error" role="alert">{form.passwordError}</p>
  {:else if form?.passwordSuccess}
    <p class="banner banner-ok" role="status">Mot de passe réinitialisé.</p>
  {/if}

  <form
    method="POST"
    action="?/resetPassword"
    use:enhance={() => {
      savingPassword = true
      return async ({ result, update }) => {
        savingPassword = false
        await update({ reset: result.type === 'success' })
      }
    }}
  >
    <div class="field">
      <Label for="ludo-password">Nouveau mot de passe</Label>
      <Input
        id="ludo-password"
        name="password"
        type="text"
        placeholder="6 caractères minimum"
        required
      />
    </div>

    <div class="field">
      <Label for="ludo-confirm">Confirmation</Label>
      <Input id="ludo-confirm" name="confirm" type="text" required />
    </div>

    <div class="actions">
      <Button type="submit" variant="outline" disabled={savingPassword}>
        {savingPassword ? 'Réinitialisation…' : 'Réinitialiser'}
      </Button>
    </div>
  </form>
</section>

<style>
  .head {
    margin-bottom: var(--space-6);
  }
  .back {
    display: inline-block;
    margin-bottom: var(--space-2);
    font-size: var(--text-small);
    color: var(--text-muted);
    text-decoration: none;
  }
  .back:hover {
    color: var(--text-main);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .slug {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    margin-bottom: var(--space-6);
  }
  h2 {
    color: var(--text-main);
    margin: 0 0 var(--space-4);
    font-size: var(--text-h3);
  }
  .muted {
    color: var(--text-muted);
    margin: 0 0 var(--space-4);
    font-size: var(--text-small);
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
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
