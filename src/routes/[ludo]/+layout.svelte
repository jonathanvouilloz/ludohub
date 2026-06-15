<script lang="ts">
  let { data, children } = $props()
</script>

<div class="ludo-scope" style="--ludo-color: {data.ludo.color}">
  {@render children()}
</div>

<style>
  .ludo-scope {
    min-height: 100dvh;
  }
</style>
