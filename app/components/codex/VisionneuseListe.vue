<script setup lang="ts">
/**
 * Aperçu du document d'armée, en tiroir.
 *
 * Le cadre pointe sur /builder/imprimer/{slug}, qui relit la liste dans le
 * `localStorage` du navigateur. L'aperçu montre donc la liste en cours de
 * construction, enregistrée sur le compte ou non : rien ne transite par le
 * serveur. Le compteur `v` force le rechargement à chaque ouverture, sans quoi
 * on reverrait l'état figé de la fois précédente.
 */
const props = defineProps<{
  slug: string
  /** nom de la liste, pour l'entête du tiroir */
  nom?: string
  /** code de partage, quand le builder lit une liste partagée plutôt que le brouillon local */
  partage?: string
}>()

const ouvert = defineModel<boolean>({ default: false })

const version = ref(0)
const chargement = ref(true)

/** sens de la page, retenu d'une ouverture à l'autre comme pour l'aperçu des codex */
const CLE_ORIENTATION = 'builder:pdf:orientation'
const orientation = ref<'portrait' | 'paysage'>('portrait')
onMounted(() => {
  try { if (localStorage.getItem(CLE_ORIENTATION) === 'paysage') orientation.value = 'paysage' } catch { /* stockage indisponible */ }
})
watch(orientation, (o) => {
  try { localStorage.setItem(CLE_ORIENTATION, o) } catch { /* ignore */ }
})

const parametres = computed(() => {
  const p = new URLSearchParams()
  if (props.partage) p.set('liste', props.partage)
  if (orientation.value === 'paysage') p.set('orientation', 'paysage')
  return p
})
/** dans le cadre : la barre d'écran de la page perd son lien de retour, le tiroir a déjà sa croix */
const src = computed(() => {
  const p = new URLSearchParams(parametres.value)
  p.set('cadre', '1')
  p.set('v', String(version.value))
  return `/builder/imprimer/${props.slug}?${p}`
})
const lienOnglet = computed(() => {
  const q = parametres.value.toString()
  return `/builder/imprimer/${props.slug}${q ? `?${q}` : ''}`
})

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
  if (v) {
    version.value += 1
    chargement.value = true
    window.addEventListener('keydown', surTouche)
  } else {
    window.removeEventListener('keydown', surTouche)
  }
})
// changer de sens recharge le cadre : le voile d'attente doit revenir avec lui
watch(src, () => { chargement.value = true })
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/60" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full flex-col border-l border-gold/20 bg-surface shadow-2xl transition-[max-width] duration-300" :class="orientation === 'paysage' ? 'max-w-[92rem]' : 'max-w-5xl'" role="dialog" :aria-label="`Document d'armée ${nom ?? slug}`">
        <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-widest text-gold">Document d'armée</p>
            <h2 class="truncate font-heading text-lg font-bold text-white">{{ nom ?? slug }}</h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <div class="flex overflow-hidden rounded-md border border-gold/25" role="group" aria-label="Sens de la page">
              <button type="button" class="px-3 py-1.5 text-xs font-semibold transition" :class="orientation === 'portrait' ? 'bg-gold text-surface' : 'text-stone-300 hover:bg-white/5'" :aria-pressed="orientation === 'portrait'" @click="orientation = 'portrait'">Portrait</button>
              <button type="button" class="border-l border-gold/25 px-3 py-1.5 text-xs font-semibold transition" :class="orientation === 'paysage' ? 'bg-gold text-surface' : 'text-stone-300 hover:bg-white/5'" :aria-pressed="orientation === 'paysage'" @click="orientation = 'paysage'">Paysage</button>
            </div>
            <a :href="lienOnglet" target="_blank" rel="noopener" class="hidden rounded-md border border-gold/30 px-3 py-1.5 text-sm text-gold hover:bg-gold/10 sm:inline-block">Ouvrir dans un onglet</a>
            <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
          </div>
        </header>

        <div class="relative flex-1 bg-[#4a4540]">
          <div v-if="chargement" class="absolute inset-0 flex items-center justify-center text-sm text-gray-300">Composition du document…</div>
          <iframe :src="src" class="h-full w-full" :class="chargement ? 'opacity-0' : 'opacity-100'" title="Document d'armée" @load="chargement = false" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
