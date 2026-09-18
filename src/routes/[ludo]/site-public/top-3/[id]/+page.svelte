<script lang="ts">
  import TopThreeForm from '$lib/components/public-site/TopThreeForm.svelte'
  let { data } = $props()
  const listHref = $derived(`/${data.ludo.slug}/site-public/top-3`)
</script>

<svelte:head><title>Modifier {data.topThree.theme} · Top 3</title></svelte:head>
<main class="form-page">
  <header>
    <h1>Modifier le Top 3</h1>
    <p>Les changements sont en ligne dès l’enregistrement.</p>
  </header>
  <TopThreeForm
    topThree={data.topThree}
    action="?/update"
    cancelHref={listHref}
    successHref={listHref}
  />
</main>

<style>
  .form-page {
    display: grid;
    max-width: 860px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-12);
    gap: var(--space-6);
  }
  h1,
  p {
    margin: 0;
  }
  h1 {
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  header p {
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  @media (max-width: 640px) {
    .form-page {
      padding: var(--space-4) var(--space-4) var(--space-10);
    }
  }
</style>
