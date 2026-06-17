<script lang="ts">
  import ActivityLogTable from '$lib/components/admin/ActivityLogTable.svelte'

  let { data } = $props()
</script>

<svelte:head>
  <title>Journal d'activité — Administration</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="head">
  <a class="back" href="/admin">← Administration</a>
  <h1>Journal d'activité</h1>
  <p class="muted">
    {data.logs.length} entrée(s) — {data.logs.length === 200
      ? 'limité aux 200 plus récentes'
      : 'toutes affichées'}.
  </p>
</header>

<ActivityLogTable logs={data.logs} ludos={data.ludos} filters={data.filters} />

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
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
</style>
