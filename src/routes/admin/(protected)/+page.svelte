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
    <!-- Écrans métier branchés en phase 3 -->
    <span class="todo">Ludothèques (à venir)</span>
    <span class="todo">Journal d'activité (à venir)</span>
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
  .todo {
    padding: var(--space-4);
    font-size: var(--text-body);
    color: var(--text-muted);
    background: var(--bg-card);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
  }
</style>
