<script lang="ts">
  import { enhance } from '$app/forms'
</script>

<svelte:head>
  <title>Administration — LudoHub</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="admin">
  <header class="head">
    <div>
      <h1>Administration</h1>
      <p class="sub">Super-admin LudoHub</p>
    </div>
    <form method="POST" action="/admin/logout" use:enhance>
      <button type="submit" class="logout">Se déconnecter</button>
    </form>
  </header>

  <nav class="links">
    <a class="link" href="/admin/ludotheques">
      <span class="link-title">Ludothèques</span>
      <span class="link-sub">Créer, configurer et réinitialiser les accès</span>
    </a>
    <a class="link" href="/admin/logs">
      <span class="link-title">Journal d'activité</span>
      <span class="link-sub">Consulter les événements de toutes les ludothèques</span>
    </a>
  </nav>
</main>

<style>
  .admin {
    max-width: 920px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  h1 {
    margin: 0;
    font-size: var(--text-h1);
    color: var(--text-main);
  }
  .sub {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .logout {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .logout:hover {
    background: var(--bg-base);
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .link {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    text-decoration: none;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: border-color var(--dur-fast) var(--ease-out-strong);
  }
  .link:hover {
    border-color: var(--border-strong);
  }
  .link-title {
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
  }
  .link-sub {
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
