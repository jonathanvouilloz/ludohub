<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import PublicSiteSectionCard from '$lib/components/public-site/PublicSiteSectionCard.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import BellIcon from '@lucide/svelte/icons/bell'
  import BookOpenIcon from '@lucide/svelte/icons/book-open'
  import CalendarIcon from '@lucide/svelte/icons/calendar-days'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import HelpCircleIcon from '@lucide/svelte/icons/circle-help'
  import ImagesIcon from '@lucide/svelte/icons/images'
  import InboxIcon from '@lucide/svelte/icons/inbox'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import NewspaperIcon from '@lucide/svelte/icons/newspaper'
  import TrophyIcon from '@lucide/svelte/icons/trophy'
  import UserRoundIcon from '@lucide/svelte/icons/user-round'

  let { data } = $props()
  const enabled = $derived(data.publicSiteState.enabled)
  const base = $derived(`/${data.ludo.slug}/site-public`)
  let saving = $state(false)
</script>

<svelte:head><title>Site public · LudoHub</title></svelte:head>

<main class="public-site-home">
  <header class="page-header">
    <div>
      <h1>Site public</h1>
      <p>Choisissez ce que vous souhaitez mettre à jour sur le site de la ludothèque.</p>
    </div>
    <span class:enabled class="status">{enabled ? 'Site actif' : 'Site désactivé'}</span>
  </header>

  {#if page.form?.error}<p class="error" role="alert">{page.form.error}</p>{/if}

  {#if enabled}
    <section aria-labelledby="publish-title">
      <div class="section-heading">
        <h2 id="publish-title">Publier</h2>
        <p>Les contenus régulièrement ajoutés ou mis en avant.</p>
      </div>
      <div class="section-grid">
        <PublicSiteSectionCard
          href={`${base}/annonces`}
          title="Annonces"
          description="Afficher une information urgente ou temporaire."
          icon={BellIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/actualites`}
          title="Actualités"
          description="Rédiger et publier les nouvelles de la ludothèque."
          icon={NewspaperIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/activites`}
          title="Activités"
          description="Présenter les activités et leurs dates."
          icon={CalendarIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/top-3`}
          title="Top 3"
          description="Mettre en avant trois jeux autour d’un thème."
          icon={TrophyIcon}
        />
      </div>
    </section>

    <section aria-labelledby="information-title">
      <div class="section-heading">
        <h2 id="information-title">Informations du site</h2>
        <p>Les contenus de référence consultés par les familles.</p>
      </div>
      <div class="section-grid">
        <PublicSiteSectionCard
          href={`${base}/lieux-horaires`}
          title="Lieux et horaires"
          description="Modifier les adresses, les accès et les horaires affichés sur le site."
          icon={MapPinIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/faq`}
          title="Questions fréquentes"
          description="Répondre simplement aux questions courantes."
          icon={HelpCircleIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/documents`}
          title="Documents"
          description="Publier des règlements, rapports et fichiers PDF."
          icon={FileTextIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/galerie`}
          title="Galerie"
          description="Ajouter les photos visibles sur le site."
          icon={ImagesIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/profils`}
          title="Équipe et comité"
          description="Présenter les personnes de la ludothèque."
          icon={UserRoundIcon}
        />
        <PublicSiteSectionCard
          href={`${base}/annuaire`}
          title="Annuaire genevois"
          description="Référencer les autres ludothèques du canton."
          icon={BookOpenIcon}
        />
      </div>
    </section>

    <section aria-labelledby="requests-title">
      <div class="section-heading">
        <h2 id="requests-title">Messages et demandes</h2>
        <p>Ce qui a été envoyé depuis le site et demande votre attention.</p>
      </div>
      <div class="section-grid">
        <PublicSiteSectionCard
          href={`${base}/contacts`}
          title="Messages reçus"
          description="Lire et traiter les demandes de contact."
          icon={InboxIcon}
        />
      </div>
    </section>
  {:else}
    <section class="inactive-panel">
      <h2>Le site public est désactivé</h2>
      <p>
        Activez-le pour accéder aux rubriques et publier du contenu. Un lieu principal actif est
        nécessaire.
      </p>
    </section>
    {#if data.canConfigure}
      <section aria-labelledby="prepare-title">
        <div class="section-heading">
          <h2 id="prepare-title">Préparer le site</h2>
          <p>Vérifiez les informations pratiques avant l’activation.</p>
        </div>
        <div class="section-grid">
          <PublicSiteSectionCard
            href={`${base}/lieux-horaires`}
            title="Lieux et horaires"
            description="Configurer les adresses, les accès et les horaires du site."
            icon={MapPinIcon}
          />
        </div>
      </section>
    {/if}
  {/if}

  {#if data.canConfigure}
    <section class="settings" aria-labelledby="settings-title">
      <div>
        <h2 id="settings-title">Réglage du site</h2>
        <p>
          {enabled
            ? 'La désactivation masque les contenus du site public.'
            : 'L’activation rend les rubriques éditoriales disponibles.'}
        </p>
      </div>
      <form
        method="POST"
        action="?/toggle"
        use:enhance={toastEnhance({
          onPending: (pending) => (saving = pending),
          success: enabled ? 'Module désactivé.' : 'Module activé.',
        })}
      >
        <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
        <Button type="submit" variant={enabled ? 'destructive' : 'default'} disabled={saving}
          >{saving ? 'Enregistrement…' : enabled ? 'Désactiver le site' : 'Activer le site'}</Button
        >
      </form>
    </section>
  {/if}
</main>

<style>
  .public-site-home {
    display: grid;
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-12);
    gap: var(--space-10);
  }
  .page-header {
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
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  .page-header p,
  .section-heading p,
  .settings p,
  .inactive-panel p {
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .status {
    flex: 0 0 auto;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--bg-muted);
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
  }
  .status.enabled {
    background: var(--success-light);
    color: var(--success);
  }
  section {
    display: grid;
    gap: var(--space-4);
  }
  .section-heading h2,
  .settings h2,
  .inactive-panel h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .section-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .settings,
  .inactive-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  .inactive-panel {
    grid-template-columns: 1fr;
  }
  .settings form {
    display: flex;
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 720px) {
    .public-site-home {
      padding: var(--space-4) var(--space-4) var(--space-10);
      gap: var(--space-8);
    }
    .page-header {
      flex-direction: column;
    }
    .settings {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
    .section-grid {
      grid-template-columns: 1fr;
    }
    .settings :global(button) {
      width: 100%;
    }
  }
</style>
