<script lang="ts">
  let { data, form } = $props()
</script>

<svelte:head
  ><title>Lier un poste Orphée — LudoHub</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>

<main class="mx-auto max-w-lg space-y-6 p-6">
  <h1 class="text-2xl font-semibold">Lier un poste Orphée</h1>
  {#if form?.success}
    <p>Le poste « {form.clientName} » est lié à {data.ludoName}. Vous pouvez fermer cette page.</p>
  {:else if !data.connected}
    <p>
      Le code <strong class="font-mono">{data.userCode || 'non renseigné'}</strong> reste affiché sur
      cette page pendant que vous vous connectez.
    </p>
    <p>
      Ouvrez LudoHub dans un nouvel onglet, connectez-vous comme responsable, puis revenez ici et
      actualisez cette page.
    </p>
    <a
      class="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
      href="/"
      target="_blank"
      rel="noopener noreferrer">Se connecter dans un nouvel onglet</a
    >
  {:else}
    <p>
      Vérifiez que le code affiché par l’extension correspond avant d’autoriser ce poste pour {data.ludoName}.
    </p>
    <form method="POST" class="space-y-4">
      <label class="block space-y-2"
        ><span>Code de liaison</span><input
          class="w-full rounded-md border p-3 font-mono uppercase"
          name="userCode"
          value={data.userCode}
          maxlength="9"
          autocomplete="one-time-code"
          required
        /></label
      >
      {#if form?.message}<p class="text-sm text-destructive">{form.message}</p>{/if}
      <button class="rounded-md bg-primary px-4 py-2 text-primary-foreground" type="submit"
        >Autoriser ce poste</button
      >
    </form>
  {/if}
</main>
