<script lang="ts" module>
  export type EditableProfile = {
    id: string
    revision: number
    section: 'team' | 'committee'
    displayName: string
    roleTitle: string | null
    bioText: string | null
    status: 'draft' | 'published' | 'hidden'
    photoUrl: string | null
    photoAlt: string | null
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  let {
    open = $bindable(false),
    profile = null,
  }: {
    open?: boolean
    profile?: EditableProfile | null
  } = $props()
  let kind = $state<EditableProfile['section']>('team'),
    displayName = $state(''),
    role = $state(''),
    bio = $state(''),
    submitting = $state(false),
    submitError = $state('')
  const isEdit = $derived(profile !== null)
  $effect(() => {
    if (!open) return
    kind = profile?.section ?? 'team'
    displayName = profile?.displayName ?? ''
    role = profile?.roleTitle ?? ''
    bio = profile?.bioText ?? ''
    submitError = ''
  })
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="profile-dialog"
    ><Dialog.Header
      ><Dialog.Title>{isEdit ? 'Modifier le profil' : 'Nouveau profil'}</Dialog.Title
      ><Dialog.Description
        >Les profils sont affichés automatiquement sur tous les lieux actifs.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: isEdit ? 'Profil mis à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (v) => {
          submitting = v
          if (v) submitError = ''
        },
        onError: (m) => (submitError = m),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}<input type="hidden" name="id" value={profile?.id} /><input
          type="hidden"
          name="revision"
          value={profile?.revision}
        />{/if}
      <div class="field">
        <Label for="profile-kind">Groupe</Label><select
          id="profile-kind"
          name="section"
          bind:value={kind}
          ><option value="team">Équipe</option><option value="committee">Comité</option></select
        >
      </div>
      <div class="field">
        <Label for="profile-name">Nom affiché</Label><Input
          id="profile-name"
          name="displayName"
          bind:value={displayName}
          maxlength={180}
          required
        />
      </div>
      <div class="field">
        <Label for="profile-role">Fonction</Label><Input
          id="profile-role"
          name="roleTitle"
          bind:value={role}
          maxlength={180}
          required
        />
      </div>
      <div class="field">
        <Label for="profile-bio">Biographie</Label><textarea
          id="profile-bio"
          name="bioText"
          bind:value={bio}
          maxlength="255"
          rows="4"
        ></textarea>
      </div>
      <div class="field">
        <Label for="profile-photo">Photo facultative</Label>
        {#if profile?.photoUrl}<img
            class="photo-preview"
            src={profile.photoUrl}
            alt={profile.photoAlt ?? profile.displayName}
          />{/if}
        <input
          id="profile-photo"
          type="file"
          name="photoFile"
          accept="image/jpeg,image/png,image/webp"
        />
        {#if profile?.photoUrl}<label
            ><input type="checkbox" name="removePhoto" /> Retirer la photo</label
          >{/if}
      </div>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}<Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button type="submit" disabled={submitting || !displayName.trim() || !role.trim() || false}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.profile-dialog) {
    max-width: 720px;
    max-height: 90vh;
    overflow-y: auto;
  }
  form,
  .field {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  select,
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
  }
  .photo-preview {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
  }
  textarea {
    resize: vertical;
  }
  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .field :global(label) {
    display: block;
  }
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
