<script setup lang="ts">
/**
 * Tiroir « Mes listes » du builder : listes enregistrées côté serveur pour l'utilisateur connecté.
 * Sans session, le tiroir explique que les listes restent dans le navigateur.
 */
import type { Liste } from '~~/shared/codex/liste'
import type { ResumeListe } from '~~/app/composables/useListes'

const props = defineProps<{
  /** codex courant, pour filtrer et pour enregistrer */
  slug: string
  /** liste en cours d'édition */
  courante: Liste
  total: number
  valide: boolean
  /** identifiant serveur de la liste courante, s'il y en a un */
  idServeur: string | null
}>()

const emit = defineEmits<{
  charger: [liste: Liste, id: string]
  enregistree: [id: string]
}>()

const ouvert = defineModel<boolean>({ default: false })

const api = useListes()
const route = useRoute()
/** revenir sur le builder, liste en cours intacte, une fois la connexion faite */
const lienConnexion = computed(() => `/connexion?suivant=${encodeURIComponent(route.fullPath)}`)
const connecte = ref(false)
const listes = ref<ResumeListe[]>([])
const chargement = ref(false)
const erreur = ref('')
const occupe = ref('')
const copie = ref('')

async function rafraichir() {
  chargement.value = true
  erreur.value = ''
  try {
    connecte.value = await api.connecte()
    listes.value = connecte.value ? await api.lister() : []
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    chargement.value = false
  }
}

watch(ouvert, (v) => { if (v) rafraichir() })

const corps = computed(() => ({
  codex: props.slug,
  nom: props.courante.nom,
  limite: props.courante.limite,
  data: props.courante,
  total: props.total,
  valide: props.valide,
}))

async function enregistrer() {
  occupe.value = 'enregistrement'
  erreur.value = ''
  try {
    if (props.idServeur) {
      await api.enregistrer(props.idServeur, corps.value)
      emit('enregistree', props.idServeur)
    } else {
      const id = await api.creer(corps.value)
      emit('enregistree', id)
    }
    await rafraichir()
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function enregistrerCopie() {
  occupe.value = 'copie'
  erreur.value = ''
  try {
    const id = await api.creer({ ...corps.value, nom: `${props.courante.nom} (copie)` })
    emit('enregistree', id)
    await rafraichir()
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

/** Le tiroir ne reçoit que les en-têtes : l'armée elle-même est lue à l'ouverture. */
async function charger(l: ResumeListe) {
  occupe.value = l.id
  erreur.value = ''
  try {
    const complete = await api.lire(l.id)
    emit('charger', complete.data, l.id)
    ouvert.value = false
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function supprimer(l: ResumeListe) {
  if (!confirm(`Supprimer « ${l.nom} » ? Cette action est définitive.`)) return
  occupe.value = l.id
  try {
    await api.supprimer(l.id)
    // une ligne en moins ne justifie pas de relire toute la liste
    listes.value = listes.value.filter((x) => x.id !== l.id)
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

function lienDe(code: string) {
  return `${window.location.origin}/builder/${props.slug}?liste=${code}`
}

async function basculerPartage(l: ResumeListe) {
  occupe.value = l.id
  erreur.value = ''
  try {
    // le code est la seule chose qui change : la relecture complète n'apprend rien de plus
    if (l.code_partage) { await api.retirerPartage(l.id); l.code_partage = null }
    else l.code_partage = await api.partager(l.id)
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function copierLien(l: ResumeListe) {
  if (!l.code_partage) return
  try {
    await navigator.clipboard.writeText(lienDe(l.code_partage))
    copie.value = l.id
    setTimeout(() => { if (copie.value === l.id) copie.value = '' }, 2000)
  } catch {
    erreur.value = 'Copie impossible, sélectionne le lien à la main'
  }
}

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
  if (v) window.addEventListener('keydown', surTouche)
  else window.removeEventListener('keydown', surTouche)
})
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))

const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/60" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-2xl flex-col border-l border-gold/20 bg-surface shadow-2xl" role="dialog" aria-label="Mes listes">
        <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-widest text-gold">Construction d'armée</p>
            <h2 class="truncate font-heading text-lg font-bold text-white">Mes listes</h2>
          </div>
          <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
        </header>

        <div v-if="connecte" class="flex flex-wrap items-center gap-2 border-b border-gold/10 bg-surface-light/60 px-5 py-3">
          <button type="button" class="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50" :disabled="!!occupe" @click="enregistrer">
            {{ occupe === 'enregistrement' ? 'Enregistrement…' : idServeur ? 'Enregistrer les modifications' : 'Enregistrer cette liste' }}
          </button>
          <button v-if="idServeur" type="button" class="rounded-md border border-white/15 px-3 py-1.5 text-sm text-stone-200 hover:bg-white/5 disabled:opacity-50" :disabled="!!occupe" @click="enregistrerCopie">
            {{ occupe === 'copie' ? 'Copie…' : 'Enregistrer comme copie' }}
          </button>
          <span class="ml-auto text-xs text-stone-500">{{ total }} pts · {{ valide ? 'valide' : 'à corriger' }}</span>
        </div>

        <p v-if="erreur" class="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-300">{{ erreur }}</p>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div v-if="!connecte" class="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-stone-400">
            <p class="text-stone-200">Tes listes restent dans ce navigateur.</p>
            <p class="mt-2">Connecte-toi pour les enregistrer sur ton compte, les retrouver sur un autre appareil et partager un lien.</p>
            <NuxtLink :to="lienConnexion" class="mt-4 inline-block rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light">Se connecter</NuxtLink>
          </div>

          <ul v-else-if="chargement" class="space-y-2" aria-label="Chargement des listes" aria-busy="true">
            <li v-for="n in 3" :key="n" class="animate-pulse rounded-lg border border-white/10 bg-surface-light p-3">
              <div class="flex items-center gap-3">
                <div class="h-4 w-40 rounded bg-white/10" />
                <div class="ml-auto h-3 w-24 rounded bg-white/5" />
              </div>
              <div class="mt-3 flex gap-2">
                <div class="h-6 w-16 rounded bg-white/5" />
                <div class="h-6 w-28 rounded bg-white/5" />
              </div>
            </li>
          </ul>

          <p v-else-if="!listes.length" class="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-stone-400">
            Aucune liste enregistrée. Le bouton ci-dessus enregistre celle que tu construis.
          </p>

          <ul v-else class="space-y-2">
            <li v-for="l in listes" :key="l.id" class="rounded-lg border p-3" :class="l.id === idServeur ? 'border-gold/50 bg-gold/5' : 'border-white/10 bg-surface-light'">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button type="button" class="font-heading text-base font-semibold text-white hover:text-gold" @click="charger(l)">{{ l.nom }}</button>
                <span v-if="l.id === idServeur" class="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gold">ouverte</span>
                <span v-if="l.codex !== slug" class="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stone-400">{{ l.codex }}</span>
                <span class="ml-auto text-xs text-stone-500">
                  <template v-if="l.total !== null">{{ l.total }} / {{ l.limite }} pts · </template>{{ dateCourte(l.updated_at) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <button type="button" class="rounded border border-white/15 px-2 py-1 text-stone-200 hover:bg-white/5" @click="charger(l)">Ouvrir</button>
                <button type="button" class="rounded border border-white/15 px-2 py-1 text-stone-300 hover:bg-white/5 disabled:opacity-50" :disabled="occupe === l.id" @click="basculerPartage(l)">
                  {{ l.code_partage ? 'Ne plus partager' : 'Partager par lien' }}
                </button>
                <button v-if="l.code_partage" type="button" class="rounded border border-gold/30 px-2 py-1 text-gold hover:bg-gold/10" @click="copierLien(l)">
                  {{ copie === l.id ? 'Lien copié' : 'Copier le lien' }}
                </button>
                <button type="button" class="ml-auto rounded border border-red-400/30 px-2 py-1 text-red-300 hover:bg-red-500/10 disabled:opacity-50" :disabled="occupe === l.id" @click="supprimer(l)">Supprimer</button>
              </div>
              <p v-if="l.code_partage" class="mt-1 truncate font-mono text-[11px] text-stone-500">/builder/{{ l.codex }}?liste={{ l.code_partage }}</p>
            </li>
          </ul>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
