<script lang="ts" module>
  export type ProfileSite = { id: string; name: string; isActive: boolean }
  export type ProfileMember = { id: string; displayName: string }
  export type EditableProfile = {
    id: string
    revision: number
    section: 'team' | 'committee'
    displayName: string
    roleTitle: string | null
    bioMarkdown: string | null
    sortOrder: number
    memberId: string | null
    status: 'draft' | 'published' | 'hidden'
    photoUrl: string | null
    photoAlt: string | null
    targets: Array<{ siteId: string; site: ProfileSite }>
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
    sites,
    members,
  }: {
    open?: boolean
    profile?: EditableProfile | null
    sites: ProfileSite[]
    members: ProfileMember[]
  } = $props()
  let kind = $state<EditableProfile['section']>('team'),
    displayName = $state(''),
    role = $state(''),
    bio = $state(''),
    sortOrder = $state(0),
    memberId = $state(''),
    targetMode = $state<'all' | 'explicit'>('all'),
    selectedSiteIds = $state<string[]>([]),
    submitting = $state(false),
    submitError = $state('')
  const isEdit = $derived(profile !== null)
  $effect(() => {
    if (!open) return
    kind = profile?.section ?? 'team'
    displayName = profile?.displayName ?? ''
    role = profile?.roleTitle ?? ''
    bio = profile?.bioMarkdown ?? ''
    sortOrder = profile?.sortOrder ?? 0
    memberId = profile?.memberId ?? ''
    targetMode = profile && profile.targets.length ? 'explicit' : 'all'
    selectedSiteIds = profile?.targets.filter((x) => x.site.isActive).map((x) => x.siteId) ?? []
    submitError = ''
  })
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="profile-dialog"
    ><Dialog.Header
      ><Dialog.Title>{isEdit ? 'Modifier le profil' : 'Nouveau profil'}</Dialog.Title
      ><Dialog.Description
        >Le lien membre reste interne et n’est jamais affiché sur le site public.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
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
      <div class="row">
        <div class="field">
          <Label for="profile-kind">Groupe</Label><select
            id="profile-kind"
            name="section"
            bind:value={kind}
            ><option value="team">Équipe</option><option value="committee">Comité</option></select
          >
        </div>
        <div class="field">
          <Label for="profile-order">Ordre</Label><Input
            id="profile-order"
            name="sortOrder"
            type="number"
            bind:value={sortOrder}
            min={0}
            step={1}
            required
          />
        </div>
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
          name="bioMarkdown"
          bind:value={bio}
          maxlength="5000"
          rows="7"
          required
        ></textarea>
      </div>
      <div class="field">
        <Label for="profile-member">Membre lié — interne, facultatif</Label><select
          id="profile-member"
          name="memberId"
          bind:value={memberId}
          ><option value="">Aucun membre</option>{#each members as member (member.id)}<option
              value={member.id}>{member.displayName}</option
            >{/each}</select
        >
      </div>
      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="modes">
          <label
            ><input type="radio" name="targetMode" value="all" bind:group={targetMode} /> Tous les lieux
            actifs</label
          ><label
            ><input type="radio" name="targetMode" value="explicit" bind:group={targetMode} /> Lieux précis</label
          >
        </div>
        {#if targetMode === 'explicit'}<div class="sites">
            {#each sites as site (site.id)}<label class:disabled={!site.isActive}
                ><input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />{site.name}{site.isActive ? '' : ' — inactif'}</label
              >{/each}
          </div>{/if}
      </fieldset>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}<Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting ||
            !displayName.trim() ||
            !role.trim() ||
            !bio.trim() ||
            (targetMode === 'explicit' && !selectedSiteIds.length)}
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
  .field,
  fieldset {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  .row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-4);
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
  textarea {
    resize: vertical;
  }
  fieldset {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend {
    padding: 0 var(--space-2);
    font-weight: var(--weight-semibold);
  }
  .modes,
  .sites {
    display: grid;
    gap: var(--space-2);
  }
  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .field :global(label) {
    display: block;
  }
  .disabled {
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
