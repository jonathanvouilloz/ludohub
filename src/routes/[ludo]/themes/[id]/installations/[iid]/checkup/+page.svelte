<script lang="ts">
  import CheckupForm from '$lib/components/themes/CheckupForm.svelte'

  let { data } = $props()

  const inst = $derived(data.installation)
  // Objets du kit, pré-remplis avec leur état courant.
  const formItems = $derived(
    inst.items.map((it) => ({
      id: it.id,
      name: it.themeItem.name,
      quantity: it.themeItem.quantity,
      status: it.condition,
    })),
  )
</script>

<svelte:head>
  <title>Check-up — {inst.theme.name}</title>
</svelte:head>

<main class="checkup">
  <header class="head">
    <a class="back" href="/{data.ludo.slug}/themes/{inst.themeId}/installations/{inst.id}">
      ← Installation
    </a>
    <h1>Check-up — {inst.theme.name}</h1>
    <p class="muted">Marquez chaque objet présent, à réparer ou manquant.</p>
  </header>

  <CheckupForm items={formItems} />
</main>

<style>
  .checkup {
    max-width: var(--max-content-narrow, 48rem);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    margin-bottom: var(--space-6);
  }
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
    margin: 0;
  }
</style>
