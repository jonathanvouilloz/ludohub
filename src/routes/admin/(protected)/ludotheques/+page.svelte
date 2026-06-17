<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import LudothequeCard from '$lib/components/admin/LudothequeCard.svelte'
  import ColorPicker from '$lib/components/admin/ColorPicker.svelte'

  let { data, form } = $props()

  let dialogOpen = $state(false)
  let submitting = $state(false)
  let error = $state('')

  // Couleur : input natif + champ hexa synchronisés (le service valide #RRGGBB).
  let color = $state('#0073e6')

  function openCreate() {
    error = ''
    color = '#0073e6'
    dialogOpen = true
  }
</script>

<svelte:head>
  <title>Ludothèques — Administration</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="head">
  <div>
    <a class="back" href="/admin">← Administration</a>
    <h1>Ludothèques</h1>
    <p class="muted">{data.ludos.length} ludothèque(s) enregistrée(s).</p>
  </div>
  <Button onclick={openCreate}>Nouvelle ludothèque</Button>
</header>

{#if form?.error}
  <p class="banner" role="alert">{form.error}</p>
{/if}

{#if data.ludos.length === 0}
  <p class="empty">Aucune ludothèque pour le moment. Créez-en une pour démarrer.</p>
{:else}
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Nom</Table.Head>
        <Table.Head>Slug</Table.Head>
        <Table.Head>Couleur</Table.Head>
        <Table.Head>Adresse</Table.Head>
        <Table.Head>Créée le</Table.Head>
        <Table.Head class="actions-col">Actions</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each data.ludos as ludo (ludo.id)}
        <LudothequeCard {ludo} />
      {/each}
    </Table.Body>
  </Table.Root>
{/if}

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouvelle ludothèque</Dialog.Title>
      <Dialog.Description>
        Le slug est dérivé du nom si laissé vide. Il ne sera plus modifiable ensuite.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/create"
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
          dialogOpen = false
        }
      }}
    >
      <div class="field">
        <Label for="ludo-name">Nom</Label>
        <Input id="ludo-name" name="name" placeholder="Ludothèque de Carouge" required />
      </div>

      <div class="field">
        <Label for="ludo-slug">Slug (optionnel)</Label>
        <Input id="ludo-slug" name="slug" placeholder="dérivé du nom" />
      </div>

      <ColorPicker bind:value={color} name="color" label="Couleur" id="ludo-color" required />

      <div class="field">
        <Label for="ludo-password">Mot de passe initial</Label>
        <Input
          id="ludo-password"
          name="password"
          type="text"
          placeholder="6 caractères minimum"
          required
        />
      </div>

      <div class="field">
        <Label for="ludo-address">Adresse (optionnel)</Label>
        <Input id="ludo-address" name="address" placeholder="Rue, ville" />
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Annuler</Button
        >
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
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
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
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
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  :global(.actions-col) {
    text-align: right;
  }
</style>
