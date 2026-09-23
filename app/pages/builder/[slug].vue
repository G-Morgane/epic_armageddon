<script setup lang="ts">
import type { Codex } from '~~/shared/codex/schema'
import { indexerCodex, calculerListe, optionsObligatoires, plafondFormation, type ResultatListe } from '~~/shared/codex/engine'
import type { Liste, FormationInstance } from '~~/shared/codex/liste'
import { genererId } from '~~/shared/codex/liste'
import { lignesFormation, prefixeFormation } from '~~/shared/codex/phrases'

const route = useRoute()
const slug = route.params.slug as string
const brouillon = route.query.brouillon ? '?brouillon=1' : ''
const { data: codex, error } = await useFetch<Codex>(`/api/codex/${slug}${brouillon}`)
if (error.value || !codex.value) throw createError({ statusCode: 404, statusMessage: 'Codex introuvable' })
const c = codex.value
const idx = indexerCodex(c)
useHead({ title: `Construction d'armée · ${c.codex.nom}` })

/**
 * Retour : là d'où l'on vient, pas une destination fixe.
 *
 * Le lien renvoyait toujours vers /codex, alors qu'on arrive ici depuis la
 * fiche d'armée, depuis l'admin ou depuis un lien de partage. `history.state.back`
 * est nul quand l'onglet s'ouvre directement sur cette page : il n'y a alors
 * rien derrière, et on retombe sur la fiche de l'armée, qui est le contexte de
 * cette liste.
 */
const router = useRouter()
function revenir() {
  // `history` n'existe pas au rendu serveur : une fonction, pas un `computed`,
  // pour qu'il n'y ait aucun acces possible en dehors du clic.
  if (import.meta.client && history.state?.back) return router.back()
  // La fiche d'armee est indexee par l'UUID, pas par le slug : sans `armee_id`
  // on ne peut pas la viser, et la liste de la faction est le plus proche.
  const id = c.codex.armee_id
  return navigateTo(id ? `/armees/${c.codex.faction}/${id}` : `/armees/${c.codex.faction}`)
}

const cle = `builder:${slug}`
const liste = ref<Liste>({ id: genererId('l'), nom: `Ma liste ${c.codex.nom}`, codex: slug, limite: 3000, formations: [] })
const pret = ref(false)

/**
 * Une liste enregistrée ou partagée se lit sur le serveur, après le montage :
 * la colonne centrale le dit, au lieu d'afficher « ajoutez des formations »
 * pendant l'aller-retour puis de se remplir d'un coup. Un builder ouvert sans
 * liste à lire n'a rien à attendre et ne montre pas ce squelette.
 */
const listeDistante = computed(() => !pret.value && !!(route.query.ouvrir || route.query.liste))

/** identifiant de la liste côté serveur, quand elle y est enregistrée */
const idServeur = ref<string | null>(null)
const cleServeur = `builder:${slug}:id`
const listesApi = useListes()
const listesOuvert = ref(false)
const messagePartage = ref('')

onMounted(async () => {
  // un lien de partage prend le pas sur le brouillon local
  const code = route.query.liste
  if (typeof code === 'string' && code) {
    try {
      const partagee = await listesApi.lirePartage(code)
      liste.value = partagee.data
      const auteur = partagee.pseudo ? ` de ${partagee.pseudo}` : ''
      messagePartage.value = `Liste partagée « ${partagee.nom} »${auteur} ouverte en lecture. Enregistre-la pour en garder ta propre copie.`
      pret.value = true
      return
    } catch {
      messagePartage.value = "Ce lien de partage n'est plus valable."
    }
  }
  // « Mes listes » de la page compte ouvre directement une liste enregistrée
  const enregistree = route.query.ouvrir
  if (typeof enregistree === 'string' && enregistree) {
    try {
      const mienne = await listesApi.lire(enregistree)
      liste.value = mienne.data
      idServeur.value = mienne.id
      try { localStorage.setItem(cleServeur, mienne.id) } catch { /* stockage indisponible */ }
      pret.value = true
      return
    } catch {
      messagePartage.value = "Cette liste enregistrée est introuvable."
    }
  }
  try {
    const brut = localStorage.getItem(cle)
    if (brut) liste.value = JSON.parse(brut)
    idServeur.value = localStorage.getItem(cleServeur)
  } catch { /* stockage indisponible */ }
  pret.value = true
})

function chargerListe(l: Liste, id: string) {
  liste.value = l
  idServeur.value = id
  messagePartage.value = ''
  try { localStorage.setItem(cleServeur, id) } catch { /* ignore */ }
}
function listeEnregistree(id: string) {
  idServeur.value = id
  try { localStorage.setItem(cleServeur, id) } catch { /* ignore */ }
}
watch(liste, (l) => { if (pret.value) try { localStorage.setItem(cle, JSON.stringify(l)) } catch { /* ignore */ } }, { deep: true })

const resultat = computed<ResultatListe>(() => calculerListe(idx, liste.value))

/**
 * Un seul parcours de l'armée par changement, au lieu d'un par question posée.
 * Le catalogue interroge les plafonds à chaque ligne et chaque carte interroge
 * les limites par armée à chaque amélioration proposée : compter à la demande
 * relisait toute la liste des dizaines de fois par frappe.
 */
const comptes = computed(() => {
  const formations = new Map<string, number>()
  const options = new Map<string, number>()
  const parcourir = (f: FormationInstance) => {
    formations.set(f.formation, (formations.get(f.formation) ?? 0) + 1)
    for (const o of f.options) options.set(o.option, (options.get(o.option) ?? 0) + 1)
    f.sous_formations.forEach(parcourir)
  }
  liste.value.formations.forEach(parcourir)
  return { formations, options }
})
const compteArmee = (optionId: string) => comptes.value.options.get(optionId) ?? 0

const resolueParId = computed(() => new Map(resultat.value.formations.map((f) => [f.instance.id, f])))
const resolueDe = (id: string) => resolueParId.value.get(id)

const sectionsCatalogue = computed(() => c.sections.filter((s) => !s.contraintes.some((k) => k.type === 'non_autonome')))
/** Lignes du catalogue préparées une fois : le gabarit relisait l'index quatre fois par ligne. */
const catalogue = computed(() => sectionsCatalogue.value.map((s) => ({
  id: s.id,
  titre: s.titre,
  total: s.formations.length,
  lignes: s.formations.flatMap((fid) => {
    const def = idx.formations.get(fid)
    if (!def) return []
    return [{
      fid,
      def,
      nom: `${prefixeFormation(idx, def)}${def.nom}`,
      couts: [...new Set(def.variantes.map((v) => v.cout))].join(' / '),
    }]
  }),
})))
/** accordéon du catalogue : sections dépliées (la première par défaut), mémorisé par codex */
const cleAccordeon = `builder:${slug}:sections`
const ouvertes = ref<string[]>([sectionsCatalogue.value[0]?.id ?? ''])
onMounted(() => { try { const v = localStorage.getItem(cleAccordeon); if (v) ouvertes.value = JSON.parse(v) } catch { /* ignore */ } })
function basculer(id: string) {
  ouvertes.value = ouvertes.value.includes(id) ? ouvertes.value.filter((x) => x !== id) : [...ouvertes.value, id]
  try { localStorage.setItem(cleAccordeon, JSON.stringify(ouvertes.value)) } catch { /* ignore */ }
}
const nbParSection = computed(() => {
  const m = new Map<string, number>()
  for (const f of resultat.value.formations) m.set(f.section.id, (m.get(f.section.id) ?? 0) + 1)
  return m
})
const nbDansListe = (sectionId: string) => nbParSection.value.get(sectionId) ?? 0

/** plafonds par armée : ils ne dépendent que du codex, ils se calculent une fois */
const plafonds = new Map<string, number | null>()
function plafondDe(fid: string) {
  if (!plafonds.has(fid)) plafonds.set(fid, plafondFormation(idx, fid))
  return plafonds.get(fid)!
}
/** limite atteinte : le bouton d'ajout du catalogue est désactivé */
function plafondAtteint(fid: string) {
  const max = plafondDe(fid)
  return max !== null && (comptes.value.formations.get(fid) ?? 0) >= max
}
/** formation dépliée dans le catalogue : sa composition (les profils sont sur les cartes de la liste) */
const detail = ref<string | null>(null)

/**
 * La liste est un tableau plat, l'affichage est groupé par catégorie : la section
 * d'une instance se lit toujours par sa formation, jamais par sa position.
 */
const sectionIdDe = (fid: string) => idx.sectionDe.get(fid)?.id ?? '?'
const sectionInstance = (id: string) => {
  const f = liste.value.formations.find((x) => x.id === id)
  return f ? sectionIdDe(f.formation) : null
}
/**
 * Colonne centrale rangée dans les mêmes catégories que le catalogue, et dans le
 * même ordre : une liste d'une vingtaine de cartes à plat ne se relit pas. Les
 * formations dont la section est inconnue (liste partagée d'un codex plus vieux)
 * finissent dans un groupe de fin plutôt que de disparaître.
 */
const groupes = computed(() => {
  const parSection = new Map<string, FormationInstance[]>()
  for (const f of liste.value.formations) {
    const sid = sectionIdDe(f.formation)
    const g = parSection.get(sid)
    if (g) g.push(f)
    else parSection.set(sid, [f])
  }
  const ordre = c.sections.map((s) => ({ id: s.id, titre: s.titre }))
  if (parSection.has('?')) ordre.push({ id: '?', titre: 'Autres' })
  return ordre.flatMap((s) => {
    const formations = parSection.get(s.id)
    return formations?.length ? [{ ...s, formations }] : []
  })
})

/**
 * Accordéon de la liste. Plusieurs cartes peuvent rester dépliées en même temps :
 * on compare deux formations, on ne les règle pas l'une après l'autre. Seul un
 * ajout repart d'une seule carte ouverte, pour poser sous les yeux celle qu'on
 * vient de prendre.
 */
const cartesOuvertes = ref<string[]>([])
function basculerCarte(id: string) {
  cartesOuvertes.value = cartesOuvertes.value.includes(id)
    ? cartesOuvertes.value.filter((x) => x !== id)
    : [...cartesOuvertes.value, id]
}

function ajouter(fid: string, variante?: string) {
  const f = idx.formations.get(fid)
  if (!f) return
  const options = optionsObligatoires(idx, fid).map((option) => ({ id: genererId('o'), option }))
  const instance: FormationInstance = { id: genererId('f'), formation: fid, variante: variante ?? f.variantes[0]!.id, choix: {}, options, sous_formations: [] }
  // en tête de sa catégorie : le dernier ajout est celui qu'on règle, il doit être sous les yeux
  const i = liste.value.formations.findIndex((x) => sectionIdDe(x.formation) === sectionIdDe(fid))
  if (i < 0) liste.value.formations.push(instance)
  else liste.value.formations.splice(i, 0, instance)
  cartesOuvertes.value = [instance.id]
}
function supprimer(id: string) {
  liste.value.formations = liste.value.formations.filter((f) => f.id !== id)
  cartesOuvertes.value = cartesOuvertes.value.filter((x) => x !== id)
}
function dupliquer(id: string) {
  const src = liste.value.formations.find((f) => f.id === id)
  if (!src) return
  const copie: FormationInstance = JSON.parse(JSON.stringify(src))
  const renommer = (f: FormationInstance) => { f.id = genererId('f'); f.options.forEach((o) => (o.id = genererId('o'))); f.sous_formations.forEach(renommer) }
  renommer(copie)
  const i = liste.value.formations.findIndex((f) => f.id === id)
  liste.value.formations.splice(i + 1, 0, copie)
  cartesOuvertes.value = [copie.id]
}

/**
 * Réorganisation à l'intérieur d'une catégorie.
 * L'ordre affiché d'un groupe est celui du tableau plat filtré : déplacer une
 * carte devant ou derrière une autre de la même section suffit, et les autres
 * sections ne bougent pas puisque leurs éléments ne changent pas d'ordre relatif.
 */
function deplacer(sourceId: string, cibleId: string, avant: boolean) {
  const arr = [...liste.value.formations]
  const i = arr.findIndex((f) => f.id === sourceId)
  if (i < 0) return
  const [item] = arr.splice(i, 1)
  const j = arr.findIndex((f) => f.id === cibleId)
  if (j < 0) return
  arr.splice(avant ? j : j + 1, 0, item!)
  liste.value.formations = arr
}
/** poignée pressée : la carte ne devient déplaçable qu'à ce moment, sinon les champs du corps ne seraient plus sélectionnables */
const glissable = ref<string | null>(null)
const glissee = ref<string | null>(null)
const cible = ref<{ id: string; avant: boolean } | null>(null)
function finGlisse() {
  glissable.value = null
  glissee.value = null
  cible.value = null
}
function debutGlisse(id: string, e: DragEvent) {
  glissee.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}
function survol(f: FormationInstance, e: DragEvent) {
  const src = glissee.value
  // sans `preventDefault`, le dépôt est refusé : c'est ce qui interdit de sortir de sa catégorie
  if (!src || src === f.id || sectionInstance(src) !== sectionIdDe(f.formation)) return
  e.preventDefault()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  cible.value = { id: f.id, avant: e.clientY < r.top + r.height / 2 }
}
function deposer(id: string, e: DragEvent) {
  e.preventDefault()
  const src = glissee.value
  const pos = cible.value
  finGlisse()
  if (src && pos && pos.id === id) deplacer(src, pos.id, pos.avant)
}
/** même déplacement au clavier et au doigt : le glisser-déposer natif ne répond pas au tactile */
function decaler(id: string, delta: -1 | 1) {
  const g = groupes.value.find((x) => x.formations.some((f) => f.id === id))
  if (!g) return
  const voisin = g.formations[g.formations.findIndex((f) => f.id === id) + delta]
  if (voisin) deplacer(id, voisin.id, delta < 0)
}
/**
 * Vider demande confirmation sur le bouton lui-même, pas dans une boîte du
 * navigateur, et laisse une porte de sortie : le contenu est gardé de côté le
 * temps d'un « Annuler ». Perdre une liste de vingt formations sur un clic de
 * travers n'a aucune raison d'être définitif.
 */
const confirmationVider = ref(false)
const vidage = ref<FormationInstance[] | null>(null)
let minuterieVider: ReturnType<typeof setTimeout> | null = null
let minuterieAnnuler: ReturnType<typeof setTimeout> | null = null
function vider() {
  if (!confirmationVider.value) {
    confirmationVider.value = true
    if (minuterieVider) clearTimeout(minuterieVider)
    minuterieVider = setTimeout(() => { confirmationVider.value = false }, 4000)
    return
  }
  confirmationVider.value = false
  if (!liste.value.formations.length) return
  vidage.value = liste.value.formations
  liste.value.formations = []
  cartesOuvertes.value = []
  if (minuterieAnnuler) clearTimeout(minuterieAnnuler)
  minuterieAnnuler = setTimeout(() => { vidage.value = null }, 15000)
}
function annulerVidage() {
  if (!vidage.value) return
  liste.value.formations = vidage.value
  vidage.value = null
}
onBeforeUnmount(() => {
  if (minuterieVider) clearTimeout(minuterieVider)
  if (minuterieAnnuler) clearTimeout(minuterieAnnuler)
})

/** Règles de l'armée, en tiroir : elles ne vivaient que dans le document imprimable. */
const reglesOuvert = ref(false)
/**
 * Le document s'ouvre en tiroir, sur la liste en cours : il la relit dans le
 * navigateur, donc enregistrée sur le compte ou non. Il est recomposé à part
 * et non caché en `@media print`, la colonne d'édition n'étant faite que de
 * menus et de compteurs.
 */
const documentOuvert = ref(false)
const codePartage = computed(() => (typeof route.query.liste === 'string' ? route.query.liste : undefined))

/**
 * Enregistrement direct depuis la barre d'outils.
 *
 * Sauver imposait d'ouvrir le tiroir « Mes listes », donc un aller-retour pour
 * le geste le plus courant. Le tiroir reste la seule porte d'entrée sans
 * session : c'est lui qui explique le stockage local et propose la connexion.
 */
const etatSauvegarde = ref<'' | 'en_cours' | 'fait'>('')
const erreurSauvegarde = ref('')
async function sauvegarder() {
  if (!listesApi.connecte()) { listesOuvert.value = true; return }
  etatSauvegarde.value = 'en_cours'
  erreurSauvegarde.value = ''
  try {
    const corps = {
      codex: slug,
      nom: liste.value.nom,
      limite: liste.value.limite,
      data: liste.value,
      total: resultat.value.total,
      valide: resultat.value.valide,
    }
    if (idServeur.value) await listesApi.enregistrer(idServeur.value, corps)
    else listeEnregistree(await listesApi.creer(corps))
    etatSauvegarde.value = 'fait'
    setTimeout(() => { if (etatSauvegarde.value === 'fait') etatSauvegarde.value = '' }, 2000)
  } catch (e) {
    etatSauvegarde.value = ''
    erreurSauvegarde.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  }
}

/**
 * Partage direct depuis la barre d'outils.
 *
 * Le lien n'existe que pour une liste enregistrée sur le compte : on
 * l'enregistre d'abord si besoin, puis on demande son code (l'API rend le même
 * s'il existe déjà) et on met le lien dans le presse-papiers. Sans session, le
 * tiroir prend le relais, c'est lui qui propose la connexion.
 */
const etatPartage = ref<'' | 'en_cours' | 'copie'>('')
const lienPartage = ref('')
async function partager() {
  if (!listesApi.connecte()) { listesOuvert.value = true; return }
  etatPartage.value = 'en_cours'
  erreurSauvegarde.value = ''
  try {
    if (!idServeur.value) await sauvegarder()
    if (!idServeur.value) throw new Error("la liste n'a pas pu être enregistrée")
    const code = await listesApi.partager(idServeur.value)
    const lien = `${window.location.origin}/builder/${slug}?liste=${code}`
    lienPartage.value = lien
    try {
      await navigator.clipboard.writeText(lien)
      etatPartage.value = 'copie'
      setTimeout(() => { if (etatPartage.value === 'copie') etatPartage.value = '' }, 3000)
    } catch {
      // presse-papiers refusé (navigateur, page non sécurisée) : le lien s'affiche, à copier à la main
      etatPartage.value = ''
    }
  } catch (e) {
    etatPartage.value = ''
    erreurSauvegarde.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  }
}

/**
 * Bilan : toutes les erreurs, pas seulement celles qui ne visent aucune
 * formation. Une erreur de formation ne s'affichait que sur sa carte, donc
 * invisible dès que la carte était repliée ou hors de l'écran, et le compteur
 * « n problème(s) » ne disait pas où chercher. Ici chaque erreur mène à sa carte.
 */
const racineParInstance = computed(() => {
  const m = new Map<string, string>()
  const parcourir = (f: FormationInstance, racine: string) => {
    m.set(f.id, racine)
    f.sous_formations.forEach((s) => parcourir(s, racine))
  }
  liste.value.formations.forEach((f) => parcourir(f, f.id))
  return m
})
const erreursBilan = computed(() => resultat.value.erreurs.map((e) => ({
  message: e.message,
  // une erreur peut viser une sous-formation : c'est la carte racine qui se déplie
  carte: e.formation ? racineParInstance.value.get(e.formation) : undefined,
})))

/**
 * Un seul bouton pour toutes les actions.
 *
 * Sept boutons alignés dans la barre : le geste courant (poser des formations)
 * se jouait à côté d'un mur d'actions rares. Le menu les range, et le bouton
 * lui-même porte l'état de la dernière action, sinon la confirmation d'une
 * sauvegarde repartirait avec le menu qui se referme.
 */
const menuOuvert = ref(false)
const signalementOuvert = ref(false)
const menuRacine = ref<HTMLElement | null>(null)

const libelleMenu = computed(() => {
  if (etatSauvegarde.value === 'en_cours') return 'Sauvegarde…'
  if (etatSauvegarde.value === 'fait') return '✓ Sauvegardée'
  if (etatPartage.value === 'en_cours') return 'Partage…'
  if (etatPartage.value === 'copie') return '✓ Lien copié'
  return 'Actions'
})

/** Une entrée du menu le referme, sauf « Vider » qui y demande sa confirmation. */
function action(faire: () => void) {
  menuOuvert.value = false
  faire()
}

onMounted(() => {
  const dehors = (e: MouseEvent) => {
    if (menuOuvert.value && !menuRacine.value?.contains(e.target as Node)) menuOuvert.value = false
  }
  const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') menuOuvert.value = false }
  document.addEventListener('click', dehors)
  window.addEventListener('keydown', echap)
  onBeforeUnmount(() => {
    document.removeEventListener('click', dehors)
    window.removeEventListener('keydown', echap)
  })
})

/** erreurs jointes à un signalement de bug : le texte seul, la carte visée n'a de sens qu'ici */
const erreursSignalement = computed(() => resultat.value.erreurs.map((e) => e.message))

/** carte montrée du doigt après un clic sur une erreur, le temps qu'on la repère */
const carteSignalee = ref<string | null>(null)
async function allerVersCarte(id: string) {
  if (!cartesOuvertes.value.includes(id)) cartesOuvertes.value = [...cartesOuvertes.value, id]
  await nextTick()
  document.getElementById(`carte-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  carteSignalee.value = id
  setTimeout(() => { if (carteSignalee.value === id) carteSignalee.value = null }, 1800)
}
const pourcentage = (b: { utilise: number; capacite: number }) => (b.capacite ? Math.min(100, Math.round((b.utilise / b.capacite) * 100)) : b.utilise ? 100 : 0)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-24 pt-8 lg:pb-8">
    <div class="impression-cacher">
      <button type="button" class="inline-flex min-h-[32px] items-center text-xs uppercase tracking-widest text-gold hover:underline" @click="revenir">← Retour</button>
      <h1 class="mt-1 font-heading text-3xl font-bold text-white">Construction d'armée · {{ c.codex.nom }} <span class="text-base font-normal text-stone-400">v{{ c.codex.version }}</span></h1>
      <!--
        Barre d'outils sur sa propre ligne, pleine largeur : partagée avec le titre,
        elle passait à la ligne dès que le nom du codex était long, et les actions
        retombaient alors n'importe où. Ici le réglage de la liste reste à gauche,
        les actions sont toujours à droite.
      -->
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <input v-model="liste.nom" class="champ w-56" placeholder="Nom de la liste">
        <label class="flex items-center gap-2 text-sm text-stone-300">Limite <input v-model.number="liste.limite" type="number" step="250" min="250" class="champ w-24"> pts</label>
        <div ref="menuRacine" class="relative ml-auto">
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-gold/30 px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
            aria-haspopup="menu"
            :aria-expanded="menuOuvert"
            @click="menuOuvert = !menuOuvert"
          >
            {{ libelleMenu }}
            <span class="text-[9px] leading-none" aria-hidden="true">▼</span>
          </button>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="menuOuvert"
              class="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gold/20 bg-surface shadow-2xl"
              role="menu"
            >
              <button type="button" role="menuitem" class="entree-menu" :disabled="etatSauvegarde === 'en_cours'" @click="action(sauvegarder)">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Sauvegarder
              </button>
              <button type="button" role="menuitem" class="entree-menu" :disabled="etatPartage === 'en_cours'" title="Enregistre la liste si besoin, puis copie son lien de partage" @click="action(partager)">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                Partager le lien
              </button>
              <button type="button" role="menuitem" class="entree-menu" @click="action(() => (listesOuvert = true))">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                Mes listes
              </button>
              <button type="button" role="menuitem" class="entree-menu border-t border-white/10" @click="action(() => (documentOuvert = true))">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                Voir le PDF
              </button>
              <button type="button" role="menuitem" class="entree-menu" @click="action(() => (reglesOuvert = true))">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                Règles de l'armée
              </button>
              <button type="button" role="menuitem" class="entree-menu border-t border-white/10" @click="action(() => (signalementOuvert = true))">
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 014 4v3a4 4 0 01-8 0v-3a4 4 0 014-4zm0 0V6a2.5 2.5 0 015 0M8 12H4m16 0h-4M6.5 7.5L9 9.5m8.5-2L15 9.5M6.5 17.5L9 15.5m8.5 2L15 15.5" /></svg>
                Signaler un bug
              </button>
              <!-- « Vider » garde sa confirmation ici même : le menu reste ouvert le temps du second clic -->
              <button
                type="button"
                role="menuitem"
                class="entree-menu border-t border-white/10 text-red-300 hover:bg-red-500/10"
                :class="confirmationVider && 'bg-red-500/20 text-red-200'"
                @click="confirmationVider ? action(vider) : vider()"
              >
                <svg class="icone-menu" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                {{ confirmationVider ? 'Confirmer ? Vider la liste' : 'Vider la liste' }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <p v-if="messagePartage" class="mt-4 rounded border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold-light impression-cacher">{{ messagePartage }}</p>
    <p v-if="erreurSauvegarde" class="mt-4 rounded border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 impression-cacher">Sauvegarde impossible : {{ erreurSauvegarde }}</p>
    <!-- Presse-papiers refusé : le lien reste sous les yeux, à copier à la main -->
    <p v-if="lienPartage && etatPartage !== 'copie'" class="mt-4 break-all rounded border border-gold/30 bg-gold/10 px-4 py-2 font-mono text-xs text-gold-light impression-cacher">{{ lienPartage }}</p>
    <p v-if="vidage" class="mt-4 flex flex-wrap items-center gap-3 rounded border border-white/15 bg-surface-light px-4 py-2 text-sm text-stone-300 impression-cacher">
      Liste vidée.
      <button type="button" class="rounded border border-gold/40 px-2 py-1 text-xs text-gold hover:bg-gold/10" @click="annulerVidage">Annuler</button>
    </p>

    <CodexMesListes
      v-model="listesOuvert"
      :slug="slug"
      :courante="liste"
      :total="resultat.total"
      :valide="resultat.valide"
      :id-serveur="idServeur"
      @charger="chargerListe"
      @enregistree="listeEnregistree"
    />

    <CodexVisionneuseListe v-model="documentOuvert" :slug="slug" :nom="liste.nom" :partage="codePartage" />

    <CodexReglesArmee v-model="reglesOuvert" :meta="c.codex" />

    <SignalerBug
      v-model="signalementOuvert"
      page="builder"
      :codex-slug="slug"
      :codex-nom="c.codex.nom"
      :codex-version="c.codex.version"
      :faction="c.codex.faction"
      :liste="liste"
      :total="resultat.total"
      :limite="liste.limite"
      :valide="resultat.valide"
      :erreurs="erreursSignalement"
      :id-serveur="idServeur"
    />

    <div class="mt-6 grid gap-6 lg:grid-cols-[280px_1fr_260px]">
      <!-- Catalogue -->
      <aside class="min-w-0 space-y-2 impression-cacher">
        <div v-for="s in catalogue" :key="s.id" class="rounded border border-white/10 bg-surface-light">
          <button type="button" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" @click="basculer(s.id)">
            <span class="font-heading text-xs uppercase tracking-wider text-gold">{{ s.titre }}</span>
            <span class="flex shrink-0 items-center gap-2 text-xs text-stone-500">
              <span v-if="nbDansListe(s.id)" class="rounded-full bg-gold/15 px-1.5 py-0.5 text-gold">{{ nbDansListe(s.id) }}</span>
              <span>{{ s.total }}</span>
              <span class="text-stone-400">{{ ouvertes.includes(s.id) ? '▴' : '▾' }}</span>
            </span>
          </button>
          <ul v-show="ouvertes.includes(s.id)" class="divide-y divide-white/5 border-t border-white/10">
            <li v-for="ligne in s.lignes" :key="ligne.fid" class="text-sm">
              <div class="flex items-center justify-between gap-2 px-3 py-2">
                <button type="button" class="min-w-0 flex-1 text-left" :title="detail === ligne.fid ? 'Replier' : 'Voir la composition'" @click="detail = detail === ligne.fid ? null : ligne.fid">
                  <p class="flex items-center gap-1 text-stone-100"><span class="truncate">{{ ligne.nom }}</span><span class="shrink-0 text-[10px] text-stone-500">{{ detail === ligne.fid ? '▴' : '▾' }}</span></p>
                  <p class="text-xs text-stone-500">{{ ligne.couts }} pts</p>
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded font-bold"
                  :class="plafondAtteint(ligne.fid) ? 'cursor-not-allowed bg-white/5 text-stone-600' : 'bg-gold/90 text-surface hover:bg-gold-light'"
                  :disabled="plafondAtteint(ligne.fid)"
                  :title="plafondAtteint(ligne.fid) ? `Limite atteinte : au plus ${plafondDe(ligne.fid)} dans l'armée` : 'Ajouter à la liste'"
                  @click="ajouter(ligne.fid)"
                >+</button>
              </div>
              <div v-if="detail === ligne.fid" class="space-y-1 border-t border-white/5 bg-black/10 px-3 py-2">
                <p v-for="(l, li) in lignesFormation(idx, ligne.def)" :key="li" class="text-xs text-stone-300"><span v-if="l.nom" class="text-gold">{{ l.nom }} : </span>{{ l.composition }} <span class="text-stone-500">· {{ l.cout }}</span></p>
                <p class="text-[11px] text-stone-500">Les profils s'affichent sur la carte, une fois la formation ajoutée.</p>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Liste -->
      <main class="min-w-0 space-y-3">
        <div class="impression-seulement mb-4">
          <h1 class="font-heading text-2xl font-bold">{{ liste.nom }}</h1>
          <p>{{ c.codex.nom }} v{{ c.codex.version }} · {{ resultat.total }} / {{ liste.limite }} pts</p>
        </div>
        <div v-if="listeDistante" class="space-y-3" aria-label="Chargement de la liste" aria-busy="true">
          <div v-for="n in 3" :key="n" class="animate-pulse rounded border border-white/10 bg-surface-light p-4">
            <div class="flex items-center gap-3">
              <div class="h-5 w-48 rounded bg-white/10" />
              <div class="ml-auto h-4 w-16 rounded bg-white/5" />
            </div>
            <div class="mt-4 space-y-2">
              <div class="h-3 w-full rounded bg-white/5" />
              <div class="h-3 w-4/5 rounded bg-white/5" />
            </div>
          </div>
        </div>
        <p v-else-if="!liste.formations.length" class="rounded border border-dashed border-white/15 p-8 text-center text-stone-400">
          Ajoutez des formations depuis le catalogue à gauche.
        </p>
        <ClientOnly>
          <section v-for="g in groupes" :key="g.id" class="space-y-3">
            <h2 class="flex items-center gap-2 border-b border-white/10 pb-1 font-heading text-xs uppercase tracking-widest text-gold">
              {{ g.titre }}
              <span class="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px]">{{ g.formations.length }}</span>
            </h2>
            <div
              v-for="(f, i) in g.formations"
              :key="f.id"
              :id="`carte-${f.id}`"
              class="relative rounded-lg transition"
              :class="[glissee === f.id ? 'opacity-40' : '', carteSignalee === f.id ? 'ring-2 ring-red-400/80' : '']"
              :draggable="glissable === f.id"
              @dragstart="debutGlisse(f.id, $event)"
              @dragover="survol(f, $event)"
              @drop="deposer(f.id, $event)"
              @dragend="finGlisse"
            >
              <span
                v-if="cible?.id === f.id"
                class="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-gold"
                :class="cible.avant ? '-top-1.5' : '-bottom-1.5'"
              />
              <CodexFormationCarte
                :idx="idx"
                :instance="f"
                :resolue="resolueDe(f.id)"
                :compte-armee="compteArmee"
                pliable
                :ouvert="cartesOuvertes.includes(f.id)"
                @basculer="basculerCarte(f.id)"
                @supprimer="supprimer(f.id)"
                @dupliquer="dupliquer(f.id)"
              >
                <template #poignee>
                  <span class="impression-cacher flex shrink-0 items-center text-stone-500">
                    <span
                      class="hidden min-h-[32px] min-w-[26px] cursor-grab select-none items-center justify-center leading-none hover:text-gold active:cursor-grabbing sm:inline-flex"
                      title="Glisser pour réorganiser dans la catégorie"
                      @pointerdown="glissable = f.id"
                      @pointerup="glissable = null"
                    >⠿</span>
                    <button type="button" class="fleche" :disabled="i === 0" title="Monter" @click="decaler(f.id, -1)">▲</button>
                    <button type="button" class="fleche" :disabled="i === g.formations.length - 1" title="Descendre" @click="decaler(f.id, 1)">▼</button>
                  </span>
                </template>
              </CodexFormationCarte>
            </div>
          </section>
        </ClientOnly>
      </main>

      <!-- Bilan -->
      <aside id="bilan" class="min-w-0 space-y-4 scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
        <div class="rounded-lg border border-white/15 bg-surface-light p-4">
          <p class="text-xs uppercase tracking-wider text-stone-400">Total</p>
          <p class="font-heading text-3xl font-bold" :class="resultat.total > liste.limite ? 'text-red-300' : 'text-white'">
            {{ resultat.total }} <span class="text-base font-normal text-stone-400">/ {{ liste.limite }} pts</span>
          </p>
          <p class="mt-1 text-sm" :class="resultat.valide ? 'text-emerald-300' : 'text-red-300'">
            {{ resultat.valide ? '✓ Liste valide' : `${resultat.erreurs.length} problème(s)` }}
          </p>
          <p class="mt-1 text-xs text-stone-500">{{ resultat.formations.filter((f) => f.activation).length }} activation(s)</p>
        </div>

        <div v-if="resultat.budgets.length" class="rounded-lg border border-white/15 bg-surface-light p-4">
          <p class="mb-3 text-xs uppercase tracking-wider text-stone-400">Budgets</p>
          <div v-for="b in resultat.budgets" :key="b.id" class="mb-3">
            <div class="flex justify-between text-xs text-stone-300">
              <span>{{ b.libelle }}</span>
              <span :class="b.utilise > b.capacite ? 'text-red-300' : ''">{{ b.utilise }} / {{ b.capacite }} {{ b.unite === 'points' ? 'pts' : '' }}</span>
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
              <div class="h-full" :class="b.utilise > b.capacite ? 'bg-red-400' : 'bg-gold'" :style="{ width: pourcentage(b) + '%' }" />
            </div>
          </div>
        </div>

        <div v-if="erreursBilan.length" class="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          <p class="mb-2 text-xs uppercase tracking-wider">À corriger</p>
          <ul class="space-y-1">
            <li v-for="(e, i) in erreursBilan" :key="i">
              <button
                v-if="e.carte"
                type="button"
                class="text-left hover:underline"
                title="Aller à la formation concernée"
                @click="allerVersCarte(e.carte)"
              >⚠ {{ e.message }}</button>
              <template v-else>⚠ {{ e.message }}</template>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <!--
      Récapitulatif collé en bas sur téléphone : la colonne « Bilan » y passe
      sous toute la liste, donc le total et les erreurs sortent de l'écran dès
      la troisième formation. Le clic ramène au bilan complet.
    -->
    <a
      href="#bilan"
      class="impression-cacher fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-white/10 bg-surface/95 px-4 py-3 backdrop-blur lg:hidden"
    >
      <span class="font-heading text-lg font-bold" :class="resultat.total > liste.limite ? 'text-red-300' : 'text-white'">
        {{ resultat.total }} <span class="text-sm font-normal text-stone-400">/ {{ liste.limite }} pts</span>
      </span>
      <span class="text-sm" :class="resultat.valide ? 'text-emerald-300' : 'text-red-300'">
        {{ resultat.valide ? '✓ Liste valide' : `${resultat.erreurs.length} problème(s)` }}
      </span>
    </a>
  </div>
</template>

<style scoped>
.champ { @apply rounded border border-white/15 bg-surface px-2 py-1 text-sm text-stone-100 focus:border-gold focus:outline-none; }
.entree-menu { @apply flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-stone-200 hover:bg-white/5 disabled:opacity-50; }
.icone-menu { @apply h-4 w-4 shrink-0 text-stone-400; }
.fleche { @apply inline-flex min-h-[32px] min-w-[26px] items-center justify-center text-[9px] leading-none hover:text-gold disabled:cursor-not-allowed disabled:text-stone-700 disabled:hover:text-stone-700; }
.impression-seulement { display: none; }
@media print {
  .impression-cacher, aside { display: none !important; }
  .impression-seulement { display: block; }
  :global(html), :global(body) { background: #fff !important; color: #111 !important; }
  main { color: #111; }
}
</style>
