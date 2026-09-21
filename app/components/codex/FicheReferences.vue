<script setup lang="ts">
/**
 * Tiroir « Fiche de références » du builder : profils des unités (type, vitesse, blindage, CC, FF,
 * armes, notes, dégâts). Par défaut les unités présentes dans la liste avec leur nombre,
 * sinon toutes celles du codex.
 */
import type { Unite } from '~~/shared/codex/schema'
import type { IndexCodex, FormationResolue } from '~~/shared/codex/engine'

const props = defineProps<{
  idx: IndexCodex
  formations: FormationResolue[]
  nom: string
}>()
const ouvert = defineModel<boolean>({ default: false })
const tout = ref(false)

/** unités de la liste, par ordre d'apparition, avec leur nombre total */
const dansListe = computed(() => {
  const compte = new Map<string, number>()
  const parcourir = (f: FormationResolue) => {
    for (const u of f.unites) compte.set(u.unite, (compte.get(u.unite) ?? 0) + u.nombre)
    f.sous_formations.forEach(parcourir)
  }
  props.formations.forEach(parcourir)
  return [...compte.entries()].flatMap(([id, n]) => { const u = props.idx.unites.get(id); return u ? [{ unite: u, nombre: n }] : [] })
})
const toutes = computed(() => props.idx.codex.unites.map((u) => ({ unite: u, nombre: 0 })))
const affichees = computed(() => (tout.value || !dansListe.value.length ? toutes.value : dansListe.value))

const degats = (u: Unite) => u.degats ? `CD ${u.degats.cd}${u.degats.bi !== undefined ? ` · BI ${u.degats.bi}` : ''}` : ''

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
  if (v) window.addEventListener('keydown', surTouche)
  else window.removeEventListener('keydown', surTouche)
})
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/60" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-3xl flex-col border-l border-gold/20 bg-surface shadow-2xl" role="dialog" aria-label="Fiche de références">
        <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-widest text-gold">Fiche de références</p>
            <h2 class="truncate font-heading text-lg font-bold text-white">{{ nom }}</h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <div class="flex rounded-md border border-white/10 text-xs">
              <button type="button" class="px-3 py-1.5" :class="!tout ? 'bg-gold/15 text-gold' : 'text-stone-400 hover:text-white'" :disabled="!dansListe.length" @click="tout = false">Ma liste <span v-if="dansListe.length">({{ dansListe.length }})</span></button>
              <button type="button" class="border-l border-white/10 px-3 py-1.5" :class="tout || !dansListe.length ? 'bg-gold/15 text-gold' : 'text-stone-400 hover:text-white'" @click="tout = true">Tout le codex ({{ toutes.length }})</button>
            </div>
            <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <p v-if="!dansListe.length && !tout" class="mb-3 text-xs text-stone-500">La liste est vide : toutes les unités du codex sont affichées.</p>
          <div class="space-y-3">
            <article v-for="{ unite: u, nombre } in affichees" :key="u.id" class="rounded-lg border border-white/10 bg-surface-light">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/5 px-4 py-2">
                <h3 class="font-heading text-base font-semibold text-white">
                  <span v-if="nombre" class="text-gold">{{ nombre }} ×</span> {{ u.nom }}
                </h3>
                <span class="rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-stone-400">{{ u.type }}</span>
                <dl class="ml-auto flex gap-4 text-xs">
                  <div><dt class="inline text-stone-500">Vitesse </dt><dd class="inline text-stone-100">{{ u.vitesse ?? '-' }}</dd></div>
                  <div><dt class="inline text-stone-500">Blindage </dt><dd class="inline text-stone-100">{{ u.blindage ?? '-' }}</dd></div>
                  <div><dt class="inline text-stone-500">CC </dt><dd class="inline text-stone-100">{{ u.cc ?? '-' }}</dd></div>
                  <div><dt class="inline text-stone-500">FF </dt><dd class="inline text-stone-100">{{ u.ff ?? '-' }}</dd></div>
                </dl>
              </div>
              <table v-if="u.armes.length" class="w-full text-xs">
                <thead class="text-left text-[10px] uppercase tracking-wider text-stone-500">
                  <tr><th class="px-4 py-1 font-normal">Arme</th><th class="py-1 font-normal">Portée</th><th class="py-1 pr-4 font-normal">Puissance de feu</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(a, ai) in u.armes" :key="ai" class="border-t border-white/5">
                    <td class="px-4 py-1 text-stone-100">{{ a.nom }}</td>
                    <td class="py-1 text-stone-300">{{ a.portee ?? '-' }}</td>
                    <td class="py-1 pr-4 text-stone-300">{{ a.puissance ?? '-' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="u.notes.length || u.degats || u.transport" class="space-y-1 border-t border-white/5 px-4 py-2 text-xs text-stone-300">
                <p v-if="u.notes.length"><span class="text-stone-500">Notes : </span>{{ u.notes.join(', ') }}</p>
                <p v-if="u.transport"><span class="text-stone-500">Transport : </span>{{ u.transport.capacite }} place{{ u.transport.capacite > 1 ? 's' : '' }}<template v-if="u.transport.accepte.length"> ({{ u.transport.accepte.map((id) => idx.unites.get(id)?.nom ?? id).join(', ') }})</template></p>
                <p v-if="u.degats"><span class="text-stone-500">Dégâts : </span>{{ degats(u) }}<template v-if="u.degats.critique"> <span class="text-stone-500">· Critique : </span>{{ u.degats.critique }}</template></p>
              </div>
            </article>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
