<script setup lang="ts">
/**
 * Signalements de bugs envoyés depuis le builder.
 *
 * Le tableau montre d'un coup d'œil le souci, l'endroit et l'armée ; le tiroir
 * porte le reste, dont la copie de la liste au moment du signalement, qui est
 * ce qui permet de reproduire.
 */
import type { Liste } from '~~/shared/codex/liste'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Signalements' })

interface Resume {
  id: string
  user_id: string | null
  pseudo: string | null
  email: string | null
  categorie: string
  message: string
  page: string
  emplacement: string | null
  url: string | null
  codex: string | null
  codex_nom: string | null
  codex_version: string | null
  faction: string | null
  liste_id: string | null
  liste_nom: string | null
  liste_total: number | null
  liste_limite: number | null
  liste_valide: boolean | null
  user_agent: string | null
  ecran: string | null
  statut: string
  note_admin: string | null
  traite_le: string | null
  created_at: string
}
type Detail = Resume & { liste_data: Liste | null; liste_erreurs: string[] | null }

const api = useAdminApi()
const { isSuperAdmin } = useAuth()

const LIBELLE_CATEGORIE: Record<string, string> = {
  points: 'Points',
  formation: 'Formation',
  option: 'Option',
  regles: 'Règles',
  affichage: 'Affichage',
  sauvegarde: 'Sauvegarde',
  pdf: 'PDF',
  autre: 'Autre',
}
const STATUTS = [
  { id: 'nouveau', label: 'Nouveaux', classe: 'border-red-400/40 bg-red-500/10 text-red-300' },
  { id: 'en_cours', label: 'En cours', classe: 'border-gold/40 bg-gold/10 text-gold' },
  { id: 'resolu', label: 'Résolus', classe: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' },
  { id: 'refuse', label: 'Refusés', classe: 'border-white/15 bg-white/5 text-stone-400' },
]
const classeStatut = (s: string) => STATUTS.find((x) => x.id === s)?.classe ?? 'border-white/15 text-stone-400'
const libelleStatut = (s: string) => STATUTS.find((x) => x.id === s)?.label.replace(/s$/, '') ?? s

const lignes = ref<Resume[]>([])
const compteurs = ref<Record<string, number>>({})
const chargement = ref(true)
const erreur = ref('')

/** Par défaut, seuls les signalements ouverts : le reste est de l'archive. */
const filtreStatut = ref<string>('nouveau,en_cours')
const filtreCodex = ref('')
const recherche = ref('')

async function rafraichir() {
  chargement.value = true
  erreur.value = ''
  try {
    const params = new URLSearchParams()
    if (filtreStatut.value) params.set('statut', filtreStatut.value)
    if (filtreCodex.value) params.set('codex', filtreCodex.value)
    if (recherche.value.trim()) params.set('q', recherche.value.trim())
    const r = await api.get<{ lignes: Resume[]; compteurs: Record<string, number> }>(`/api/admin/signalements?${params}`)
    lignes.value = r.lignes
    compteurs.value = r.compteurs
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    chargement.value = false
  }
}
onMounted(rafraichir)
watch([filtreStatut, filtreCodex], rafraichir)

let minuteur: ReturnType<typeof setTimeout>
watch(recherche, () => {
  clearTimeout(minuteur)
  minuteur = setTimeout(rafraichir, 300)
})

/** Codex présents dans les signalements : filtrer sur tout le catalogue n'aurait pas de sens. */
const codexPresents = computed(() => {
  const m = new Map<string, string>()
  for (const l of lignes.value) if (l.codex) m.set(l.codex, l.codex_nom ?? l.codex)
  return [...m].map(([slug, nom]) => ({ slug, nom })).sort((a, b) => a.nom.localeCompare(b.nom))
})

const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/* --- Tiroir de détail --- */

const detail = ref<Detail | null>(null)
const chargementDetail = ref(false)
const note = ref('')
const occupe = ref('')
const messageAction = ref('')

async function ouvrir(id: string) {
  chargementDetail.value = true
  messageAction.value = ''
  try {
    detail.value = await api.get<Detail>(`/api/admin/signalements/${id}`)
    note.value = detail.value.note_admin ?? ''
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    chargementDetail.value = false
  }
}

async function changerStatut(statut: string) {
  if (!detail.value) return
  occupe.value = statut
  try {
    await api.put(`/api/admin/signalements/${detail.value.id}`, { statut })
    detail.value.statut = statut
    await rafraichir()
  } catch (e) {
    messageAction.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function enregistrerNote() {
  if (!detail.value) return
  occupe.value = 'note'
  try {
    await api.put(`/api/admin/signalements/${detail.value.id}`, { note_admin: note.value })
    detail.value.note_admin = note.value
    messageAction.value = 'Note enregistrée.'
    await rafraichir()
  } catch (e) {
    messageAction.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function supprimer() {
  if (!detail.value) return
  if (!confirm('Supprimer définitivement ce signalement ?')) return
  occupe.value = 'suppression'
  try {
    await api.del(`/api/admin/signalements/${detail.value.id}`)
    detail.value = null
    await rafraichir()
  } catch (e) {
    messageAction.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

/**
 * Reproduire le bug : la liste jointe est déposée dans le brouillon local du
 * builder pour ce codex, puis le builder s'ouvre dessus. Elle écrase le
 * brouillon de l'admin, d'où la confirmation.
 */
function rejouer() {
  const d = detail.value
  if (!d?.liste_data || !d.codex) return
  if (!confirm(`Cela remplace ton brouillon local du builder « ${d.codex_nom ?? d.codex} ». Continuer ?`)) return
  try {
    localStorage.setItem(`builder:${d.codex}`, JSON.stringify(d.liste_data))
    localStorage.removeItem(`builder:${d.codex}:id`)
  } catch {
    messageAction.value = 'Stockage local indisponible.'
    return
  }
  window.open(`/builder/${d.codex}`, '_blank')
}

async function copierJson() {
  if (!detail.value?.liste_data) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(detail.value.liste_data, null, 2))
    messageAction.value = 'JSON de la liste copié.'
  } catch {
    messageAction.value = 'Copie refusée par le navigateur.'
  }
}
</script>

<template>
  <div>
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-heading text-2xl font-bold text-gold">Signalements</h1>
        <p class="mt-1 text-sm text-gray-500">Bugs remontés depuis le builder, avec l'armée et la liste concernées.</p>
      </div>
      <button type="button" class="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-lighter" @click="rafraichir">Rafraîchir</button>
    </header>

    <!-- Filtres -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        :class="['rounded-full border px-3 py-1 text-xs', filtreStatut === 'nouveau,en_cours' ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-gray-400 hover:bg-surface-lighter']"
        @click="filtreStatut = 'nouveau,en_cours'"
      >
        Ouverts ({{ (compteurs.nouveau ?? 0) + (compteurs.en_cours ?? 0) }})
      </button>
      <button
        v-for="s in STATUTS"
        :key="s.id"
        type="button"
        :class="['rounded-full border px-3 py-1 text-xs', filtreStatut === s.id ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-gray-400 hover:bg-surface-lighter']"
        @click="filtreStatut = s.id"
      >
        {{ s.label }} ({{ compteurs[s.id] ?? 0 }})
      </button>
      <button
        type="button"
        :class="['rounded-full border px-3 py-1 text-xs', !filtreStatut ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-gray-400 hover:bg-surface-lighter']"
        @click="filtreStatut = ''"
      >
        Tous
      </button>

      <select v-model="filtreCodex" class="ml-auto rounded-lg border border-white/10 bg-surface-light px-3 py-1.5 text-sm text-gray-200">
        <option value="">Toutes les armées</option>
        <option v-for="c in codexPresents" :key="c.slug" :value="c.slug">{{ c.nom }}</option>
      </select>
      <input v-model="recherche" type="search" placeholder="Rechercher…" class="rounded-lg border border-white/10 bg-surface-light px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600">
    </div>

    <p v-if="erreur" class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{{ erreur }}</p>

    <div v-if="chargement" class="rounded-lg border border-white/10 bg-surface-light p-8 text-center text-sm text-gray-500">Chargement…</div>
    <div v-else-if="!lignes.length" class="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-gray-500">Aucun signalement pour ce filtre.</div>

    <div v-else class="overflow-hidden rounded-lg border border-white/10">
      <table class="w-full text-left text-sm">
        <thead class="bg-surface-light text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-2 font-medium">Statut</th>
            <th class="px-4 py-2 font-medium">Le souci</th>
            <th class="px-4 py-2 font-medium">Endroit</th>
            <th class="px-4 py-2 font-medium">Armée</th>
            <th class="px-4 py-2 font-medium">Auteur</th>
            <th class="px-4 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr
            v-for="l in lignes"
            :key="l.id"
            class="cursor-pointer align-top transition-colors hover:bg-surface-lighter"
            @click="ouvrir(l.id)"
          >
            <td class="whitespace-nowrap px-4 py-3">
              <span :class="['rounded-full border px-2 py-0.5 text-xs', classeStatut(l.statut)]">{{ libelleStatut(l.statut) }}</span>
            </td>
            <td class="max-w-md px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-gold/80">{{ LIBELLE_CATEGORIE[l.categorie] ?? l.categorie }}</p>
              <p class="line-clamp-2 text-gray-200">{{ l.message }}</p>
            </td>
            <td class="px-4 py-3 text-gray-400">
              <p>{{ l.emplacement ?? '(non précisé)' }}</p>
              <p class="text-xs text-gray-600">{{ l.page }}</p>
            </td>
            <td class="px-4 py-3 text-gray-300">
              <p>{{ l.codex_nom ?? l.codex ?? '(aucune)' }}</p>
              <p v-if="l.liste_nom" class="text-xs text-gray-600">{{ l.liste_nom }} · {{ l.liste_total ?? 0 }} / {{ l.liste_limite ?? 0 }} pts</p>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ l.pseudo ?? l.email ?? 'Anonyme' }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ dateCourte(l.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tiroir de détail -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="detail || chargementDetail" class="fixed inset-0 z-[60] bg-black/60" @click="detail = null" />
      </Transition>
      <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
        <aside v-if="detail" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-2xl flex-col border-l border-gold/20 bg-surface shadow-2xl" role="dialog" aria-label="Détail du signalement">
          <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-widest text-gold">{{ LIBELLE_CATEGORIE[detail.categorie] ?? detail.categorie }}</p>
              <h2 class="truncate font-heading text-lg font-bold text-white">{{ detail.codex_nom ?? detail.codex ?? 'Signalement' }}</h2>
            </div>
            <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" @click="detail = null">✕</button>
          </header>

          <!-- Statuts -->
          <div class="flex flex-wrap items-center gap-2 border-b border-gold/10 bg-surface-light/60 px-5 py-3">
            <button
              v-for="s in STATUTS"
              :key="s.id"
              type="button"
              :class="['rounded-full border px-3 py-1 text-xs disabled:opacity-50', detail.statut === s.id ? s.classe : 'border-white/10 text-gray-400 hover:bg-surface-lighter']"
              :disabled="!!occupe"
              @click="changerStatut(s.id)"
            >
              {{ libelleStatut(s.id) }}
            </button>
            <button
              v-if="isSuperAdmin"
              type="button"
              class="ml-auto rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              :disabled="!!occupe"
              @click="supprimer"
            >
              Supprimer
            </button>
          </div>

          <p v-if="messageAction" class="border-b border-gold/10 bg-gold/5 px-5 py-2 text-xs text-gold">{{ messageAction }}</p>

          <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
            <section>
              <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Le souci</h3>
              <p class="whitespace-pre-wrap rounded border border-white/10 bg-surface-light p-3 text-gray-200">{{ detail.message }}</p>
            </section>

            <section class="grid gap-3 sm:grid-cols-2">
              <div>
                <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Endroit</h3>
                <p class="text-gray-300">{{ detail.emplacement ?? '(non précisé)' }}</p>
                <p class="text-xs text-gray-600">Écran : {{ detail.page }}</p>
                <a v-if="detail.url" :href="detail.url" target="_blank" class="mt-1 block break-all text-xs text-gold hover:underline">{{ detail.url }}</a>
              </div>
              <div>
                <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Armée</h3>
                <p class="text-gray-300">{{ detail.codex_nom ?? detail.codex ?? '(aucune)' }}</p>
                <p class="text-xs text-gray-600">
                  <span v-if="detail.codex_version">v{{ detail.codex_version }}</span>
                  <span v-if="detail.faction"> · {{ detail.faction }}</span>
                </p>
              </div>
              <div>
                <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Liste</h3>
                <p class="text-gray-300">{{ detail.liste_nom ?? '(aucune)' }}</p>
                <p class="text-xs text-gray-600">
                  {{ detail.liste_total ?? 0 }} / {{ detail.liste_limite ?? 0 }} pts ·
                  {{ detail.liste_valide === null ? 'état inconnu' : detail.liste_valide ? 'valide' : 'à corriger' }}
                </p>
              </div>
              <div>
                <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Auteur</h3>
                <p class="text-gray-300">{{ detail.pseudo ?? 'Anonyme' }}</p>
                <p v-if="detail.email" class="text-xs text-gold">{{ detail.email }}</p>
                <p class="text-xs text-gray-600">{{ dateCourte(detail.created_at) }}</p>
              </div>
            </section>

            <section v-if="detail.liste_erreurs?.length">
              <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Erreurs affichées à ce moment ({{ detail.liste_erreurs.length }})</h3>
              <ul class="list-inside list-disc space-y-1 rounded border border-white/10 bg-surface-light p-3 text-xs text-gray-400">
                <li v-for="(e, i) in detail.liste_erreurs" :key="i">{{ e }}</li>
              </ul>
            </section>

            <section v-if="detail.liste_data">
              <h3 class="mb-2 text-xs uppercase tracking-wide text-gray-500">Liste jointe</h3>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10" @click="rejouer">Ouvrir dans le builder</button>
                <button type="button" class="rounded border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5" @click="copierJson">Copier le JSON</button>
              </div>
              <details class="mt-3 rounded border border-white/10 bg-surface-light">
                <summary class="cursor-pointer px-3 py-2 text-xs text-gray-400">Voir le JSON ({{ detail.liste_data.formations.length }} formations)</summary>
                <pre class="max-h-72 overflow-auto px-3 pb-3 text-[11px] leading-snug text-gray-500">{{ JSON.stringify(detail.liste_data, null, 2) }}</pre>
              </details>
            </section>

            <section>
              <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Note interne</h3>
              <textarea v-model="note" rows="3" class="w-full rounded border border-white/10 bg-surface-light px-3 py-2 text-sm text-gray-200 focus:border-gold focus:outline-none" placeholder="Diagnostic, correctif prévu…" />
              <button
                type="button"
                class="mt-2 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
                :disabled="!!occupe"
                @click="enregistrerNote"
              >
                {{ occupe === 'note' ? 'Enregistrement…' : 'Enregistrer la note' }}
              </button>
            </section>

            <section>
              <h3 class="mb-1 text-xs uppercase tracking-wide text-gray-500">Contexte technique</h3>
              <p class="break-all text-xs text-gray-600">{{ detail.user_agent ?? '(inconnu)' }}</p>
              <p class="text-xs text-gray-600">Fenêtre : {{ detail.ecran ?? '(inconnue)' }}</p>
            </section>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>
