<script lang="ts">
  let { data } = $props()
</script>

<svelte:head>
  <title>LudoHub</title>
</svelte:head>

<main class="home">
  <header class="intro">
    <h1>LudoHub</h1>
    <p>Choisissez votre ludothèque pour vous connecter.</p>
  </header>

  <ul class="grid">
    {#each data.ludos as ludo (ludo.slug)}
      <li>
        <a class="ludo" href="/auth/{ludo.slug}" style="--ludo-color: {ludo.color}">
          <span class="dot" aria-hidden="true"></span>
          <span class="name">{ludo.name}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  .home {
    min-height: 100dvh;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .intro {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .intro h1 {
    margin: 0;
    font-size: var(--text-display);
    font-weight: var(--weight-bold);
    color: var(--text-main);
  }
  .intro p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-body);
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-4);
  }
  .ludo {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
    color: var(--text-main);
    transition:
      box-shadow var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  .ludo:hover {
    border-color: var(--ludo-color);
    box-shadow: var(--shadow-md);
  }
  .dot {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
    box-shadow: var(--shadow-sm);
  }
  .name {
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
  }
</style>
