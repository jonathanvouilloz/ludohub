<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import ProfileDialog, {
    type EditableProfile,
  } from '$lib/components/public-site/ProfileDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import UsersIcon from '@lucide/svelte/icons/users'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  let { data } = $props()
  let open = $state(false),
    editing = $state<EditableProfile | null>(null),
    pending = $state<string | null>(null),
    mediaPending = $state<string | null>(null)
  function create() {
    editing = null
    open = true
  }
  function edit(x: EditableProfile) {
    editing = x
    open = true
  }
  function inactive(x: EditableProfile) {
    return x.targets.some((t) => !t.site.isActive)
  }
</script>

<svelte:head><title>Profils · {data.ludo.name}</title></svelte:head>
<main>
  <header>
    <div>
      <p>Site public</p>
      <h1>Équipe et comité</h1>
      <span>Présentez les personnes publiquement, sans exposer leur compte membre.</span>
    </div>
    <Button onclick={create}>Nouveau profil</Button>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error">
      {page.form.error}
    </p>{/if}{#if !data.profiles.length}<EmptyState
      icon={UsersIcon}
      title="Aucun profil"
      description="Créez un profil en brouillon."
      >{#snippet action()}<Button onclick={create}>Nouveau profil</Button>{/snippet}</EmptyState
    >{:else}<div class="grid">
      {#each data.profiles as item (item.id)}<article>
          {#if item.photoUrl}<img src={item.photoUrl} alt={item.photoAlt ?? ''} />{/if}
          <div class="head">
            <div>
              <h2>{item.displayName}</h2>
              <p>
                {item.roleTitle || 'Sans fonction'} · {item.section === 'team'
                  ? 'Équipe'
                  : 'Comité'} · ordre {item.sortOrder}
              </p>
            </div>
            <div>
              {#if item.status === 'published'}<Badge variant="success">Publié</Badge
                >{:else if item.status === 'hidden'}<Badge variant="secondary">Masqué</Badge
                >{:else}<Badge variant="outline">Brouillon</Badge>{/if}
            </div>
          </div>
          <p>{item.bioMarkdown || ''}</p>
          <footer>
            <Button size="sm" variant="outline" onclick={() => edit(item)}
              ><PencilIcon size={16} /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Profil masqué.' : 'Profil publié.',
                onPending: (v) => (pending = v ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><input
                type="hidden"
                name="status"
                value={item.status === 'published' ? 'hidden' : 'published'}
              /><Button
                type="submit"
                size="sm"
                disabled={pending === item.id || (item.status !== 'published' && inactive(item))}
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
              action="?/uploadPhoto"
              enctype="multipart/form-data"
              use:enhance={toastEnhance({
                success: item.photoUrl ? 'Photo remplacée.' : 'Photo ajoutée.',
                onPending: (v) => (mediaPending = v ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
              /><input
                type="text"
                name="alt"
                value={item.photoAlt ?? item.displayName}
                maxlength="300"
                aria-label="Texte alternatif de la photo"
                required
              /><Button type="submit" size="sm" disabled={mediaPending === item.id}
                >{item.photoUrl ? 'Remplacer' : 'Ajouter'}</Button
              >
            </form>
            {#if item.photoUrl}<form
                method="POST"
                action="?/removePhoto"
                use:enhance={toastEnhance({ success: 'Photo supprimée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><Button type="submit" size="sm" variant="outline">Retirer</Button>
              </form>{/if}
          </section>
        </article>{/each}
    </div>{/if}<ProfileDialog
    bind:open
    profile={editing}
    sites={data.sites}
    members={data.members}
  />
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
  img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
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
