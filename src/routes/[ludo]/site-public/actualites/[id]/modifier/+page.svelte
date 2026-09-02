<script lang="ts">
  import NewsForm from '$lib/components/public-site/NewsForm.svelte'
  let { data } = $props()
  const detailHref = $derived(`/${data.ludo.slug}/site-public/actualites/${data.news.id}`)
</script>

<svelte:head><title>Modifier {data.news.title} · Actualités</title></svelte:head>
<main class="form-page">
  <header>
    <h1>Modifier l’actualité</h1>
    <p>Enregistrez le contenu avant de revenir à sa fiche.</p>
  </header>
  <NewsForm
    news={data.news}
    sites={data.sites}
    action="?/update"
    cancelHref={detailHref}
    successHref={detailHref}
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
  }
  @media (max-width: 640px) {
    .form-page {
      padding: var(--space-4) var(--space-4) var(--space-10);
    }
  }
</style>
