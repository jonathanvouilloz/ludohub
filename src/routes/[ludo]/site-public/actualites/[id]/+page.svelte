<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import EditorialAssetsEditor from '$lib/components/public-site/EditorialAssetsEditor.svelte'
  import { compressEditorialImageFormData } from '$lib/media/editorial-image.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  let { data } = $props()
  let pending = $state(false)
  let imagePending = $state(false)
  const news = $derived(data.news)
  const base = $derived(`/${data.ludo.slug}/site-public/actualites`)
  const targetLabel = $derived(
    news.targets.length === 0
      ? 'Tous les lieux actifs'
      : news.targets
          .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
          .join(', '),
  )
  const hasInactiveTargets = $derived(news.targets.some((target) => !target.site.isActive))
</script>

<svelte:head><title>{news.title} · Actualités</title></svelte:head>
<main class="detail-page">
  <a class="back" href={base}
    ><ArrowLeftIcon size={18} aria-hidden="true" /> Retour aux actualités</a
  >
  <header class="detail-header">
    <div>
      <div class="status-line">
        {#if news.status === 'published'}<Badge variant="success">Publiée</Badge
          >{:else if news.status === 'hidden'}<Badge variant="secondary">Masquée</Badge
          >{:else}<Badge variant="secondary">Brouillon</Badge>{/if}{#if hasInactiveTargets}<Badge
            variant="warning">Lieu inactif</Badge
          >{/if}
      </div>
      <h1>{news.title}</h1>
      <p>{news.summary}</p>
    </div>
    <Button href={`${base}/${news.id}/modifier`} variant="outline"
      ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
    >
  </header>

  <section class="publication" aria-labelledby="publication-title">
    <div>
      <h2 id="publication-title">Publication</h2>
      <dl>
        <div>
          <dt>Visible à</dt>
          <dd>{targetLabel}</dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>/{news.slug}</dd>
        </div>
      </dl>
    </div>
    <form
      method="POST"
      action="../?/transition"
      use:enhance={toastEnhance({
        success: news.status === 'published' ? 'Actualité masquée.' : 'Actualité publiée.',
        onPending: (value) => (pending = value),
      })}
    >
      <input type="hidden" name="id" value={news.id} /><input
        type="hidden"
        name="revision"
        value={news.revision}
      /><input
        type="hidden"
        name="status"
        value={news.status === 'published' ? 'hidden' : 'published'}
      />
      <Button
        type="submit"
        variant={news.status === 'published' ? 'outline' : 'default'}
        disabled={pending || (news.status !== 'published' && hasInactiveTargets)}
        >{pending
          ? 'Enregistrement…'
          : news.status === 'published'
            ? 'Masquer du site'
            : 'Publier sur le site'}</Button
      >
    </form>
  </section>

  <section aria-labelledby="article-title">
    <h2 id="article-title">Contenu de l’actualité</h2>
    <div class="article-body">{news.body}</div>
  </section>

  <section aria-labelledby="cover-title">
    <div class="section-heading">
      <div>
        <h2 id="cover-title">Image de couverture</h2>
        <p>Cette image accompagne l’actualité dans les listes du site.</p>
      </div>
    </div>
    {#if news.imageUrl}<img class="cover" src={news.imageUrl} alt={news.imageAlt ?? ''} />{/if}
    <div class="media-actions">
      <form
        method="POST"
        action="../?/uploadImage"
        enctype="multipart/form-data"
        use:enhance={toastEnhance({
          success: news.imageUrl ? 'Image remplacée.' : 'Image ajoutée.',
          prepare: (formData) => compressEditorialImageFormData(formData, 'content'),
          onPending: (value) => (imagePending = value),
        })}
      >
        <input type="hidden" name="id" value={news.id} /><input
          type="hidden"
          name="revision"
          value={news.revision}
        />
        <label
          ><span>Choisir une image</span><input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
          /></label
        ><label
          ><span>Description de l’image</span><input
            type="text"
            name="alt"
            value={news.imageAlt ?? ''}
            maxlength="300"
            required
          /></label
        >
        <Button type="submit" disabled={imagePending}
          >{imagePending
            ? 'Envoi…'
            : news.imageUrl
              ? 'Remplacer l’image'
              : 'Ajouter l’image'}</Button
        >
      </form>
      {#if news.imageUrl}<form
          method="POST"
          action="../?/removeImage"
          use:enhance={toastEnhance({
            success: 'Image retirée.',
            onPending: (value) => (imagePending = value),
          })}
        >
          <input type="hidden" name="id" value={news.id} /><input
            type="hidden"
            name="revision"
            value={news.revision}
          /><Button type="submit" variant="outline" disabled={imagePending}>Retirer l’image</Button>
        </form>{/if}
    </div>
  </section>

  <EditorialAssetsEditor ownerId={news.id} revision={news.revision} assets={news.assets} />
</main>

<style>
  .detail-page {
    display: grid;
    max-width: 920px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-6) var(--space-12);
    gap: var(--space-5);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    width: fit-content;
    color: var(--primary);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    margin-top: var(--space-3);
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  .detail-header p {
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.6;
  }
  .status-line {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  section {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .publication {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin: var(--space-3) 0 0;
  }
  dl div {
    display: grid;
    gap: var(--space-1);
  }
  dt {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  dd {
    margin: 0;
    color: var(--text-main);
    font-weight: var(--weight-semibold);
  }
  .article-body {
    color: var(--text-main);
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .section-heading p {
    margin-top: var(--space-1);
    color: var(--text-muted);
  }
  .cover {
    width: min(100%, 640px);
    max-height: 380px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .media-actions,
  .media-actions form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .media-actions form:first-child {
    flex: 1;
  }
  label {
    display: grid;
    flex: 1;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  input[type='text'],
  input[type='file'] {
    min-height: 44px;
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  @media (max-width: 700px) {
    .detail-page {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    .detail-header,
    .publication,
    .media-actions,
    .media-actions form {
      align-items: stretch;
      flex-direction: column;
      grid-template-columns: 1fr;
    }
    section {
      padding: var(--space-4);
    }
    .detail-header :global(a),
    .publication :global(button),
    .media-actions :global(button) {
      width: 100%;
    }
  }
</style>
