<script lang="ts">
  import { isResponsable } from '$lib/utils/permissions.js'

  let { data } = $props()
</script>

<main class="dashboard">
  <p class="eyebrow" style="color: var(--ludo-color)">{data.ludo.name}</p>
  <h1>Bonjour {data.currentMember.name} 👋</h1>
  <p class="muted">Vous êtes connecté·e. Le tableau de bord arrivera dans un prochain epic.</p>

  {#if isResponsable(data.currentMember)}
    <a class="settings-link" href="/{data.ludo.slug}/settings/membres">Gérer l'équipe →</a>
  {/if}
</main>

<style>
  .dashboard {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-12) var(--space-6);
  }
  .eyebrow {
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-small);
    margin: 0 0 var(--space-2);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-2);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .settings-link {
    display: inline-block;
    margin-top: var(--space-6);
    font-weight: var(--weight-medium);
    color: var(--ludo-color);
    text-decoration: none;
  }
  .settings-link:hover {
    text-decoration: underline;
  }
</style>
