<script lang="ts">
  let { data } = $props()
  let sending = $state(false); let message = $state(''); let idempotencyKey = $state('')
  let members = $state<Array<{ gender: string; firstName: string; lastName: string; birthDate: string }>>([])
  function changed() { idempotencyKey = '' }
  function addMember() { if (members.length < data.config.maxMembers) { members.push({ gender: 'unspecified', firstName: '', lastName: '', birthDate: '' }); changed() } }
  function removeMember(index: number) { members.splice(index, 1); changed() }
  async function submit(event: SubmitEvent) {
    sending = true; message = ''
    const form = event.currentTarget as HTMLFormElement; const raw = Object.fromEntries(new FormData(form))
    const body = { ...raw, consentAccepted: raw.consentAccepted === 'on', members: members.map((member) => ({ ...member, birthDate: member.birthDate || null })) }
    idempotencyKey ||= crypto.randomUUID() + crypto.randomUUID()
    try {
      const response = await fetch(`/api/forms/v1/${encodeURIComponent(data.ludoSlug)}/family-membership/submissions`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(body) })
      message = response.ok ? 'Votre demande a bien été reçue.' : 'La demande n’a pas pu être envoyée. Vérifiez les champs.'
    } catch { message = 'La demande n’a pas pu être envoyée. Réessayez.' }
    finally { sending = false }
  }
</script>
<svelte:head><title>{data.config.title}</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main class="mx-auto max-w-2xl space-y-6 p-6">
  <h1 class="text-3xl font-bold">{data.config.title}</h1>
  {#if data.config.intro}<p>{data.config.intro}</p>{/if}
  <p>Cotisation annuelle : {(data.config.annualFeeCents / 100).toFixed(2)} {data.config.currency}. Paiement sur place uniquement ({data.config.paymentMethods.join(' ou ')}).</p>
  {#each data.config.documents as document}<section><h2 class="font-semibold">{document.title}</h2><pre class="whitespace-pre-wrap font-sans">{document.contentMarkdown}</pre></section>{/each}
  <form class="grid gap-4" oninput={changed} onsubmit={(event) => { event.preventDefault(); void submit(event) }}>
    <input name="website" class="hidden" tabindex="-1" autocomplete="off" />
    <select name="gender"><option value="unspecified">Genre non précisé</option><option value="female">Femme</option><option value="male">Homme</option><option value="other">Autre</option></select>
    <input required name="firstName" placeholder="Prénom du responsable" /><input required name="lastName" placeholder="Nom du responsable" />
    <input name="birthDate" type="date" /><input required name="address" placeholder="Adresse" /><input required name="postalCode" placeholder="NPA" /><input required name="city" placeholder="Ville" />
    <input required name="phone" placeholder="Téléphone" /><input name="secondaryPhone" placeholder="Second téléphone" /><input required name="email" type="email" placeholder="E-mail" />
    <fieldset class="space-y-3"><legend class="font-semibold">Membres de la famille</legend>
      {#each members as member, index}
        <div class="grid gap-2 rounded border p-3"><select bind:value={member.gender}><option value="unspecified">Genre non précisé</option><option value="female">Femme</option><option value="male">Homme</option><option value="other">Autre</option></select><input required bind:value={member.firstName} placeholder="Prénom"/><input required bind:value={member.lastName} placeholder="Nom"/><input type="date" bind:value={member.birthDate}/><button type="button" onclick={() => removeMember(index)}>Retirer</button></div>
      {/each}
      <button type="button" onclick={addMember} disabled={members.length >= data.config.maxMembers}>Ajouter un membre</button>
    </fieldset>
    {#if data.config.sites.length > 1}<select required name="siteId"><option value="">Choisir un lieu</option>{#each data.config.sites as site}<option value={site.id}>{site.name}</option>{/each}</select>{/if}
    <label><input required type="checkbox" name="consentAccepted" /> {data.config.consentLabel}</label>
    <input required name="consentFullName" placeholder="Nom complet" /><input required name="consentAcceptedOn" type="date" />
    <button disabled={sending} type="submit">{sending ? 'Envoi…' : 'Envoyer la demande'}</button>
  </form>
  {#if message}<p aria-live="polite">{message}</p>{/if}
</main>
