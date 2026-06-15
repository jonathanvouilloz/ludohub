<script lang="ts">
  let { data } = $props()
</script>

<main class="dashboard">
  <p class="eyebrow" style="color: var(--ludo-color)">{data.ludo.name}</p>
  <h1>Bonjour {data.currentMember.name} 👋</h1>
  <p class="muted">Vous êtes connecté·e. Le tableau de bord arrivera dans un prochain epic.</p>
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
</style>
