<script lang="ts">
  import NewsForm from '$lib/components/public-site/NewsForm.svelte'
  let { data } = $props()
  const listHref = $derived(`/${data.ludo.slug}/site-public/actualites`)
</script>

<svelte:head><title>Modifier {data.news.title} · Actualités</title></svelte:head>
<main class="form-page">
  <header>
    <h1>Modifier l’actualité</h1>
    <p>Modifiez le contenu, les images, le document ou la visibilité au même endroit.</p>
  </header>
  <NewsForm news={data.news} action="?/update" cancelHref={listHref} successHref={listHref} />
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
