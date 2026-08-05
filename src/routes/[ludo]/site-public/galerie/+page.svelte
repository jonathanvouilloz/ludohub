<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import GalleryDialog, {
    type EditableGalleryItem,
  } from '$lib/components/public-site/GalleryDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ImagesIcon from '@lucide/svelte/icons/images'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  let { data } = $props()
  let open = $state(false),
    editing = $state<EditableGalleryItem | null>(null),
    pending = $state<string | null>(null),
    mediaPending = $state<string | null>(null)
  function create() {
    editing = null
    open = true
  }
  function edit(x: EditableGalleryItem) {
    editing = x
    open = true
  }
  function inactive(x: EditableGalleryItem) {
    return x.targets.some((t) => !t.site.isActive)
  }
</script>

<svelte:head><title>Galerie · {data.ludo.name}</title></svelte:head>
<main>
  <header>
    <div>
      <p>Site public</p>
      <h1>Galerie</h1>
      <span>Gérez les photos directement, sans albums.</span>
    </div>
    <Button onclick={create}>Nouvelle photo</Button>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error">
      {page.form.error}
    </p>{/if}{#if !data.galleryItems.length}<EmptyState
      icon={ImagesIcon}
      title="Aucune photo"
      description="Créez une photo en brouillon."
      >{#snippet action()}<Button onclick={create}>Nouvelle photo</Button>{/snippet}</EmptyState
    >{:else}<div class="grid">
      {#each data.galleryItems as item (item.id)}<article>
          {#if item.imageUrl}<img src={item.imageUrl} alt={item.alt} />{:else}<div
              class="placeholder"
            >
              Image à ajouter
            </div>{/if}
          <div class="head">
            <div>
              <h2>{item.caption}</h2>
              <small>Ordre {item.sortOrder}</small>
            </div>
            <div>
              {#if item.status === 'published'}<Badge variant="success">Publiée</Badge
                >{:else if item.status === 'hidden'}<Badge variant="secondary">Masquée</Badge
                >{:else}<Badge variant="outline">Brouillon</Badge>{/if}{#if inactive(item)}<Badge
                  variant="warning">Cible inactive</Badge
                >{/if}
            </div>
          </div>
          <footer>
            <Button size="sm" variant="outline" onclick={() => edit(item)}
              ><PencilIcon size={16} /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Photo masquée.' : 'Photo publiée.',
                onPending: (v) => (pending = v ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><input type="hidden" name="alt" value={item.alt ?? ''} /><input
                type="hidden"
                name="status"
                value={item.status === 'published' ? 'hidden' : 'published'}
              /><Button
                type="submit"
                size="sm"
                disabled={pending === item.id ||
                  (item.status !== 'published' && (!item.imageUrl || inactive(item)))}
                >{item.status === 'published' ? 'Masquer' : 'Publier'}</Button
              >
            </form>
            {#if item.status === 'draft'}<form
                method="POST"
                action="?/delete"
                use:enhance={toastEnhance({ success: 'Brouillon supprimé.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><Button type="submit" size="sm" variant="destructive">Supprimer</Button>
              </form>{/if}
          </footer>
          <section>
            <form
              method="POST"
              action="?/uploadImage"
              enctype="multipart/form-data"
              use:enhance={toastEnhance({
                success: item.imageUrl ? 'Image remplacée.' : 'Image ajoutée.',
                onPending: (v) => (mediaPending = v ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><input type="hidden" name="alt" value={item.alt ?? ''} /><input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
              /><Button type="submit" size="sm" disabled={mediaPending === item.id}
                >{item.imageUrl ? 'Remplacer' : 'Ajouter'}</Button
              >
            </form>
            {#if item.imageUrl}<form
                method="POST"
                action="?/removeImage"
                use:enhance={toastEnhance({ success: 'Image supprimée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><Button type="submit" size="sm" variant="outline">Retirer</Button>
              </form>{/if}
          </section>
        </article>{/each}
    </div>{/if}<GalleryDialog bind:open item={editing} sites={data.sites} />
</main>

<style>
  main {
    max-width: var(--max-content);
    margin: auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .head,
  footer,
  section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  header {
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-4);
  }
  article {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  img,
  .placeholder {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .placeholder {
    display: grid;
    place-items: center;
    background: var(--bg-muted);
    color: var(--text-muted);
  }
  footer,
  section {
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  section form {
    display: flex;
    gap: var(--space-2);
  }
  .error {
    padding: var(--space-3);
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
