<script lang="ts">
  let { data, form } = $props()
</script>

<svelte:head
  ><title>Postes Orphée — LudoHub</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Postes Orphée</h1>
    <p class="text-muted-foreground">
      Les postes liés ont accès aux adhésions familiales de cette ludothèque.
    </p>
  </div>
  {#if form?.message}<p class="text-sm text-destructive">{form.message}</p>{/if}
  {#if data.sessions.length === 0}<p>Aucun poste actif.</p>{/if}
  <ul class="space-y-3">
    {#each data.sessions as session}
      <li class="flex items-center justify-between rounded-lg border p-4">
        <div>
          <strong>{session.label}</strong>
          <p class="text-sm text-muted-foreground">
            Lié le {new Date(session.createdAt).toLocaleDateString('fr-CH')}
          </p>
        </div>
        <form method="POST" action="?/revoke">
          <input type="hidden" name="id" value={session.id} /><button
            class="rounded-md border px-3 py-2"
            type="submit">Révoquer</button
          >
        </form>
      </li>
    {/each}
  </ul>
</section>
