<script setup lang="ts">
/**
 * Document imprimable d'une liste d'armée : couverture, récapitulatif, profils.
 *
 * Page à part et non `@media print` sur le builder : la colonne d'édition est
 * faite de menus, de compteurs et d'accordéons, dont aucun n'a de sens sur le
 * papier. On recompose ici un document à la manière des codex, avec la même
 * mise en page A4 que `/codex/{slug}/imprimer`.
 *
 * La liste vient du navigateur (le brouillon du builder) ou d'un lien de
 * partage. Elle n'est jamais lue côté serveur : un Chromium sans écran n'a ni
 * le `localStorage` du joueur ni sa session.
 */
import type { Codex, Unite } from '~~/shared/codex/schema'
import { indexerCodex, calculerListe, type ResultatListe, type FormationResolue } from '~~/shared/codex/engine'
import type { Liste } from '~~/shared/codex/liste'
import { pluriel } from '~~/shared/codex/phrases'
import { trierParType, lignesComplementaires } from '~~/shared/codex/pdf'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const brouillon = route.query.brouillon ? '?brouillon=1' : ''
const { data: codex, error } = await useFetch<Codex>(`/api/codex/${slug}${brouillon}`)
if (error.value || !codex.value) throw createError({ statusCode: 404, statusMessage: 'Codex introuvable' })

const c = codex.value
const idx = indexerCodex(c)
const couleur = c.codex.couleur ?? '#8a6d3b'

/** la page est-elle affichée dans le tiroir du builder plutôt que seule dans un onglet ? */
const enCadre = computed(() => route.query.cadre === '1')
/**
 * Sens de la page, lu dans l'URL comme pour les codex : c'est le tiroir qui le
 * pilote, et un onglet ouvert à part garde le réglage puisqu'il voyage avec le lien.
 */
const paysage = route.query.orientation === 'paysage'
const echelle = useEchellePapier(paysage)

const liste = ref<Liste | null>(null)
const pret = ref(false)
const auteur = ref<string | null>(null)
const { pseudo, init } = useAuth()
const listesApi = useListes()

onMounted(async () => {
  // un lien de partage porte son propre auteur : c'est sa liste, pas celle du lecteur
  const code = route.query.liste
  if (typeof code === 'string' && code) {
    try {
      const partagee = await listesApi.lirePartage(code)
      liste.value = partagee.data
      auteur.value = partagee.pseudo
      pret.value = true
      return
    } catch { /* lien périmé : on retombe sur le brouillon local */ }
  }
  try {
    const brut = localStorage.getItem(`builder:${slug}`)
    if (brut) liste.value = JSON.parse(brut)
  } catch { /* stockage indisponible */ }
  await init()
  // le compte donne le pseudo, mais on construit surtout sans compte : un nom
  // saisi ici l'emporte, et il est retenu d'un document à l'autre
  let retenu: string | null = null
  try { retenu = localStorage.getItem(CLE_JOUEUR) } catch { /* stockage indisponible */ }
  auteur.value = retenu || pseudo.value
  pret.value = true
})

const CLE_JOUEUR = 'builder:joueur'
watch(auteur, (v) => {
  if (!pret.value) return
  try { localStorage.setItem(CLE_JOUEUR, v ?? '') } catch { /* ignore */ }
})

useHead({
  title: `Liste ${c.codex.nom}`,
  htmlAttrs: { class: 'print' },
  style: [{ innerHTML: `@page { size: A4 ${paysage ? 'landscape' : 'portrait'}; margin: 12mm 12mm 14mm 12mm; }
@page couverture { size: A4 ${paysage ? 'landscape' : 'portrait'}; margin: 0; }` }],
})

const resultat = computed<ResultatListe | null>(() => (liste.value ? calculerListe(idx, liste.value) : null))
const total = computed(() => resultat.value?.total ?? 0)
const activations = computed(() => resultat.value?.formations.filter((f) => f.activation).length ?? 0)

/** Formations groupées par section, dans l'ordre du codex : le papier suit le plan du livre. */
const groupes = computed(() => {
  const resolues = resultat.value?.formations ?? []
  return c.sections.flatMap((s) => {
    const formations = resolues.filter((f) => f.section.id === s.id)
    return formations.length ? [{ id: s.id, titre: s.titre, formations }] : []
  })
})

const unitesDe = (f: FormationResolue) => f.unites.filter((u) => !u.implicite)
const phraseUnites = (f: FormationResolue) =>
  unitesDe(f).map((u) => `${u.nombre} ${u.nombre > 1 ? pluriel(u.nom) : u.nom}`).join(', ')
/** le nom de la variante n'apprend rien quand il n'y en a qu'une */
const nomComplet = (f: FormationResolue) =>
  f.def.variantes.length > 1 && f.variante.nom ? `${f.def.nom} (${f.variante.nom})` : f.def.nom

/**
 * Feuille de références : les unités réellement présentes dans l'armée, y
 * compris celles venues des améliorations et des sous-formations. Reprendre
 * tout le codex donnerait des pages de profils qu'on ne posera jamais sur
 * la table.
 */
const unitesPresentes = computed<Unite[]>(() => {
  const vues = new Set<string>()
  const out: Unite[] = []
  const parcourir = (f: FormationResolue) => {
    for (const u of f.unites) {
      const def = idx.unites.get(u.unite)
      if (def && !vues.has(u.unite)) { vues.add(u.unite); out.push(def) }
    }
    f.sous_formations.forEach(parcourir)
  }
  ;(resultat.value?.formations ?? []).forEach(parcourir)
  return trierParType(out)
})

const lignesArmes = (u: Unite) => (u.armes.length ? u.armes : [{ nom: '', portee: '', puissance: '' }])
const complements = (u: Unite, compact = false) => lignesComplementaires(u, compact)
const nbColonnesStats = 9

const dateDuJour = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })
const pied = computed(() => `${liste.value?.nom ?? ''} · ${c.codex.nom.toUpperCase()} · ${total.value} PTS`)

function imprimer() { window.print() }
</script>

<template>
  <div class="doc" :class="{ paysage }" :data-pret="pret ? '' : undefined" :style="{ '--accent': couleur, zoom: echelle }">
    <!-- Barre d'écran : elle ne part jamais sur le papier -->
    <div class="barre">
      <!-- dans le tiroir du builder, la croix sert déjà de retour -->
      <NuxtLink v-if="!enCadre" :to="`/builder/${slug}`" class="barre-lien">← Retour au builder</NuxtLink>
      <label class="barre-champ">
        Joueur
        <input :value="auteur ?? ''" placeholder="Ton pseudo" @input="auteur = ($event.target as HTMLInputElement).value || null">
      </label>
      <button type="button" class="barre-bouton" @click="imprimer">Imprimer / Enregistrer en PDF</button>
    </div>

    <p v-if="pret && !liste?.formations.length" class="vide">
      Aucune formation dans cette liste. Reviens au builder pour la composer.
    </p>

    <template v-if="liste && liste.formations.length">
      <!-- 1. Couverture -->
      <section class="page couverture" :class="{ illustree: !!c.codex.illustration }">
        <div v-if="c.codex.illustration" class="couverture-fond" :style="{ backgroundImage: `url(${c.codex.illustration})` }" />
        <div class="couverture-bloc">
          <img v-if="c.codex.logo" class="couverture-logo" :src="c.codex.logo" alt="">
          <div class="couverture-bande" />
          <p class="couverture-sur">Epic Armageddon</p>
          <h1 class="couverture-titre">{{ liste.nom }}</h1>
          <p class="couverture-sous">{{ c.codex.nom }}</p>
          <p v-if="auteur" class="couverture-auteur">Liste de {{ auteur }}</p>
          <p class="couverture-points">{{ total }} / {{ liste.limite }} pts · {{ activations }} activation(s)</p>
          <div class="couverture-bande bas" />
          <p class="couverture-version">Codex version {{ c.codex.version }} · {{ dateDuJour }}</p>
        </div>
      </section>

      <!-- 2. Récapitulatif : ce qu'on a sous la main pendant la partie, sans les caractéristiques -->
      <section class="page">
        <h1 class="titre-liste">Récapitulatif</h1>
        <p class="chapeau">{{ c.codex.nom }} · {{ total }} / {{ liste.limite }} pts · {{ activations }} activation(s)</p>

        <div v-for="g in groupes" :key="g.id" class="bloc">
          <div class="entete">{{ g.titre }}</div>
          <table class="liste">
            <thead>
              <tr><th>Formation</th><th>Unités</th><th class="cout">Coût</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in g.formations" :key="f.instance.id">
                <td class="nom">{{ nomComplet(f) }}</td>
                <td>
                  <div class="ligne">{{ phraseUnites(f) }}</div>
                  <div v-for="o in f.options" :key="o.instance.id" class="ligne italique">+ {{ o.libelle }}</div>
                  <div v-for="s in f.sous_formations" :key="s.instance.id" class="ligne italique">+ {{ nomComplet(s) }} : {{ phraseUnites(s) }}</div>
                </td>
                <td class="cout">
                  <div class="ligne">{{ f.cout_base }}</div>
                  <div v-for="o in f.options" :key="o.instance.id" class="ligne italique">{{ o.cout ? `+${o.cout}` : 'gratuit' }}</div>
                  <div v-for="s in f.sous_formations" :key="s.instance.id" class="ligne italique">+{{ s.cout }}</div>
                  <div v-if="f.cout !== f.cout_base" class="ligne fort">{{ f.cout }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table class="totaux">
          <tbody>
            <tr><td>Total de l'armée</td><td class="cout fort">{{ total }} / {{ liste.limite }} pts</td></tr>
            <tr v-for="b in resultat?.budgets ?? []" :key="b.id">
              <td>{{ b.libelle }}</td>
              <td class="cout">{{ b.utilise }} / {{ b.capacite }}{{ b.unite === 'points' ? ' pts' : '' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="resultat && !resultat.valide" class="avertissement">
          Liste non conforme au codex : {{ resultat.erreurs.length }} problème(s) relevé(s) dans le builder.
        </p>
        <div class="pied">{{ pied }}</div>
      </section>

      <!-- 3. Feuille de références : les profils des unités de cette armée, et d'elles seules -->
      <section class="page">
        <h1 class="titre-liste">Feuille de références</h1>
        <table class="stats">
          <thead>
            <tr><th>Nom</th><th>Type</th><th>Vit</th><th>Bli</th><th>CC</th><th>FF</th><th>Arme</th><th>Portée</th><th>Puissance de feu</th></tr>
          </thead>
          <tbody>
            <template v-for="u in unitesPresentes" :key="u.id">
              <tr v-for="(a, ai) in lignesArmes(u)" :key="ai" :class="{ premiere: ai === 0 }">
                <template v-if="ai === 0">
                  <td class="nom" :rowspan="lignesArmes(u).length">{{ u.nom }}</td>
                  <td :rowspan="lignesArmes(u).length">{{ u.type }}</td>
                  <td :rowspan="lignesArmes(u).length">{{ u.vitesse ?? '-' }}</td>
                  <td :rowspan="lignesArmes(u).length">{{ u.blindage ?? '-' }}</td>
                  <td :rowspan="lignesArmes(u).length">{{ u.cc ?? '-' }}</td>
                  <td :rowspan="lignesArmes(u).length">{{ u.ff ?? '-' }}</td>
                </template>
                <td>{{ a.nom }}</td>
                <td>{{ a.portee }}</td>
                <td>{{ a.puissance }}</td>
              </tr>
              <tr v-for="(l, li) in complements(u, true)" :key="`${u.id}-c${li}`" class="sous-ligne" :class="{ derniere: li === complements(u, true).length - 1 }">
                <td :colspan="nbColonnesStats"><span v-if="l.label" class="etiquette">{{ l.label }} : </span>{{ l.texte }}</td>
              </tr>
              <tr v-if="!complements(u, true).length" class="derniere vide"><td :colspan="nbColonnesStats" /></tr>
            </template>
          </tbody>
        </table>
        <div class="pied">{{ pied }}</div>
      </section>
    </template>
  </div>
</template>

<style>
/*
  Le document est sur papier blanc, quel que soit le thème du site.
  `color-scheme` et pas seulement `background` : le script de thème pose la
  classe `dark` sur <html> avant le rendu, donc `color-scheme: dark`, et
  Chromium peint alors la surface de page hors du bloc racine avec son gris
  sombre. À l'impression, cela encadrait les feuilles de noir.
*/
html.print { color-scheme: light; }
html.print, html.print body { background: #fff; color: #111; }
@media screen {
  html.print, html.print body { background: #4a4540; }
}
</style>

<style scoped>
.doc { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; line-height: 1.35; color: #111; background: #fff; max-width: 186mm; margin: 0 auto; }
.doc.paysage { max-width: 273mm; }
.page { position: relative; break-after: page; padding-bottom: 8mm; }
.page:last-child { break-after: auto; }
.titre-liste { font-size: 13pt; text-transform: uppercase; text-align: center; margin: 0 0 4pt; letter-spacing: .5pt; }
.chapeau { text-align: center; font-size: 8pt; margin: 0 0 8pt; }
.pied { position: absolute; bottom: 0; left: 0; font-size: 7pt; color: #444; }
.vide { max-width: 186mm; margin: 20mm auto; text-align: center; color: #ddd; }

.bloc { margin-bottom: 6pt; break-inside: avoid; }
.entete { background: color-mix(in srgb, var(--accent) 70%, #c9a56a); color: #fff; text-align: center; font-weight: 700; font-size: 8.5pt; padding: 2.5pt 4pt; margin: 6pt 0 0; text-transform: uppercase; letter-spacing: .3pt; }
table.liste { width: 100%; border-collapse: collapse; font-size: 7.6pt; }
table.liste th { text-align: left; font-size: 7pt; border-bottom: 1px solid #999; padding: 2pt 4pt; }
table.liste td { padding: 2pt 4pt; border-bottom: 1px dotted #ccc; vertical-align: top; }
table.liste td.nom { font-weight: 600; width: 28%; }
table.liste .cout { text-align: right; white-space: nowrap; width: 14%; }
table.liste th.cout { text-align: right; }
.ligne + .ligne { margin-top: 1pt; }
.italique { font-style: italic; }
.fort { font-weight: 700; border-top: 1px solid #bbb; padding-top: 1pt; }
tr { break-inside: avoid; }

table.totaux { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 8pt; }
table.totaux td { padding: 2pt 4pt; border-bottom: 1px dotted #ccc; }
table.totaux .cout { text-align: right; white-space: nowrap; }
.avertissement { font-size: 7.2pt; font-style: italic; color: #8a2b2b; margin-top: 4pt; }

table.stats { width: 100%; border-collapse: collapse; font-size: 7pt; }
table.stats th { text-align: left; font-size: 6.8pt; color: #fff; background: var(--accent); padding: 2pt 3pt; }
table.stats td { padding: 1.5pt 3pt; vertical-align: top; }
table.stats tr.premiere td { border-top: 1px solid #bbb; }
table.stats tr.derniere td { border-bottom: 1px solid #bbb; padding-bottom: 2.5pt; }
table.stats td.nom { font-weight: 600; }
table.stats tr.sous-ligne td { font-size: 6.6pt; font-style: italic; color: #333; padding-left: 24pt; }
table.stats tr.sous-ligne .etiquette { font-style: normal; font-weight: 600; }
table.stats tr.vide td { padding: 0; }

/* Couverture : même composition que celle des codex, au nom de l'armée du joueur */
.couverture { position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 271mm; }
.doc.paysage .couverture { min-height: 184mm; }
.couverture-fond { position: absolute; inset: 0; background-position: center; background-size: cover; background-repeat: no-repeat; }
/* l'illustration est portrait à l'origine : en paysage on garde le haut, là où est le sujet */
.doc.paysage .couverture-fond { background-position: center top; }
.couverture-bloc { position: relative; display: flex; flex-direction: column; align-items: center; }
.couverture-bande { width: 90mm; height: 3pt; background: var(--accent); }
.couverture-logo { width: 30mm; height: 30mm; object-fit: contain; filter: brightness(0); margin-bottom: 8pt; }
.couverture-bande.bas { margin-top: 18pt; }
.couverture-sur { font-size: 10pt; letter-spacing: 3pt; text-transform: uppercase; color: #555; margin: 14pt 0 0; }
.couverture-titre { font-size: 36pt; line-height: 1.1; text-transform: uppercase; letter-spacing: 2pt; margin: 6pt 0; color: #222; }
.couverture-sous { font-size: 12pt; text-transform: uppercase; letter-spacing: 1.5pt; color: var(--accent); margin: 0 0 10pt; }
.couverture-auteur { font-size: 11pt; font-style: italic; margin: 0 0 4pt; }
.couverture-points { font-size: 9pt; color: #555; margin: 0 0 6pt; }
.couverture-version { font-size: 8pt; color: #555; margin: 8pt 0 0; }

.couverture.illustree {
  page: couverture;
  justify-content: flex-end;
  background: #111;
  width: 210mm;
  min-height: 297mm;
  margin-left: -12mm;
  padding: 0;
}
.doc.paysage .couverture.illustree { width: 297mm; min-height: 210mm; }
.couverture.illustree::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 58%;
  background: linear-gradient(to top, #000 0%, rgba(0, 0, 0, .96) 18%, rgba(0, 0, 0, .86) 34%, rgba(0, 0, 0, .62) 52%, rgba(0, 0, 0, .32) 72%, rgba(0, 0, 0, .1) 88%, rgba(0, 0, 0, 0) 100%);
}
.couverture.illustree .couverture-bloc { z-index: 1; padding: 0 14mm 16mm; color: #fff; }
.couverture.illustree .couverture-bande { width: 110mm; background: color-mix(in srgb, var(--accent) 35%, #fff); }
.couverture.illustree .couverture-logo { filter: brightness(0) invert(1); }
.couverture.illustree .couverture-sur { color: #e2e2e2; }
.couverture.illustree .couverture-titre { color: #fff; text-shadow: 0 1mm 3mm rgba(0, 0, 0, .8); }
.couverture.illustree .couverture-sous { color: color-mix(in srgb, var(--accent) 30%, #fff); }
.couverture.illustree .couverture-auteur { color: #fff; }
.couverture.illustree .couverture-points,
.couverture.illustree .couverture-version { color: #ccc; }

/* Barre d'écran : pilotage de l'impression, jamais imprimée */
.barre { display: flex; align-items: center; justify-content: space-between; gap: 8pt; max-width: 210mm; margin: 0 auto; padding: 4mm 0 0; font-family: Arial, Helvetica, sans-serif; }
.barre-lien { color: #d8c08a; font-size: 9pt; text-decoration: none; }
.barre-lien:hover { text-decoration: underline; }
.barre-champ { display: flex; align-items: center; gap: 6px; margin-left: auto; margin-right: 8px; color: #bdb4a4; font-size: 9pt; }
.barre-champ input { border: 1px solid rgba(216, 192, 138, .35); border-radius: 3px; background: rgba(0, 0, 0, .25); color: #f0e8d8; font-size: 9pt; padding: 3px 6px; width: 16ch; }
.barre-champ input:focus { border-color: #d8c08a; outline: none; }
.barre-bouton { border: 1px solid #d8c08a; border-radius: 3px; background: transparent; color: #d8c08a; font-size: 9pt; padding: 4px 10px; cursor: pointer; }
.barre-bouton:hover { background: rgba(216, 192, 138, .12); }
@media print {
  .barre { display: none; }
}

/* Aperçu écran : des feuilles A4 posées sur un fond neutre, comme pour les codex */
@media screen {
  .doc, .doc.paysage { max-width: none; background: transparent; display: flex; flex-direction: column; align-items: safe center; gap: 6mm; padding: 0 4mm 6mm; }
  .doc .page { width: 210mm; min-height: 297mm; background: #fff; padding: 12mm 12mm 14mm; box-shadow: 0 1mm 4mm rgba(0, 0, 0, .45); }
  .doc.paysage .page { width: 297mm; min-height: 210mm; }
  .doc .couverture.illustree { width: 210mm; min-height: 297mm; margin-left: 0; padding: 0; overflow: hidden; }
  .doc.paysage .couverture.illustree { width: 297mm; min-height: 210mm; }
}

/* L'échelle d'écran ne vaut que pour l'aperçu : sur le papier la feuille reprend sa taille. */
@media print {
  .doc { zoom: 1 !important; }
}
</style>
