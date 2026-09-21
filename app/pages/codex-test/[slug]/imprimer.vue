<script setup lang="ts">
import type { Codex, Section, Unite } from '~~/shared/codex/schema'
import { indexerCodex } from '~~/shared/codex/engine'
import { lignesFormation, prefixeFormation, phraseSousFormations, phraseOption, coutOption, marqueNote, sousTitreSection, optionsDeSection } from '~~/shared/codex/phrases'
import { lireOptionsPdf, trierParType, lignesComplementaires } from '~~/shared/codex/pdf'
import { paragraphesEnrichis, enrichir } from '~~/shared/codex/markdown'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const brouillon = route.query.brouillon ? '?brouillon=1' : ''
const { data: codex, error } = await useFetch<Codex>(`/api/codex/${slug}${brouillon}`)
if (error.value || !codex.value) throw createError({ statusCode: 404, statusMessage: 'Codex introuvable' })

const c = codex.value
const idx = indexerCodex(c)
const couleur = c.codex.couleur ?? '#8a6d3b'

/** Composition du document, pilotée par la query string (voir shared/codex/pdf.ts). */
const opts = lireOptionsPdf(route.query as Record<string, unknown>)
const paysage = opts.orientation === 'paysage'
useHead({
  title: `Codex ${c.codex.nom}`,
  htmlAttrs: { class: 'print' },
  style: [{ innerHTML: `@page { size: A4 ${paysage ? 'landscape' : 'portrait'}; margin: 12mm 12mm 14mm 12mm; }` }],
})

const paragraphes = (md?: string) => paragraphesEnrichis(md)

/** numérotation : seules les pages retenues comptent */
const pages = computed(() => {
  const n: string[] = []
  if (opts.couverture) n.push('couverture')
  n.push('regles', 'liste')
  if (opts.profils) n.push('profils')
  if (opts.references) n.push('references')
  return n
})
const numero = (cle: string) => pages.value.indexOf(cle) + 1

/** Regroupe les sections qui partagent un même sous_titre explicite (« SUPPORTS… ») pour les afficher côte à côte. */
const groupes = computed(() => {
  const out: Array<{ bandeau?: string; sections: Section[] }> = []
  const secs = c.sections
  secs.forEach((s, i) => {
    // bandeau seulement quand deux sections voisines partagent le même sous-titre (« SUPPORTS… » côte à côte)
    const partage = !!s.sous_titre && (secs[i - 1]?.sous_titre === s.sous_titre || secs[i + 1]?.sous_titre === s.sous_titre)
    const bandeau = partage ? s.sous_titre : undefined
    const dernier = out[out.length - 1]
    if (bandeau && dernier?.bandeau === bandeau) dernier.sections.push(s)
    else out.push({ bandeau, sections: [s] })
  })
  return out
})
const sousTitre = (s: Section, bandeau?: string) => {
  const genere = sousTitreSection(idx, s)
  const explicite = s.sous_titre && s.sous_titre !== bandeau ? s.sous_titre : undefined
  return [explicite, explicite ? undefined : genere].filter(Boolean).join('. ')
}

const initiativeTexte = computed(() => {
  const ex = c.codex.initiative.exceptions.map((e) => `${e.portee} : initiative ${e.valeur}`).join('. ')
  return `Les armées ${c.codex.nom} ont une valeur stratégique de ${c.codex.valeur_strategique}. ${ex ? ex + '. ' : ''}Les autres formations ont une initiative de ${c.codex.initiative.defaut}.`
})

/** Feuilles de références : les unités dans l'ordre d'apparition dans les formations, puis le reste. */
const unitesOrdonnees = computed<Unite[]>(() => {
  const vues = new Set<string>()
  const out: Unite[] = []
  const pousser = (id: string) => { const u = idx.unites.get(id); if (u && !vues.has(id)) { vues.add(id); out.push(u) } }
  for (const s of c.sections) for (const fid of s.formations) {
    const f = idx.formations.get(fid)
    for (const v of f?.variantes ?? []) for (const l of v.composition) {
      if ('unite' in l) pousser(l.unite)
      else if ('choix' in l) l.choix.parmi.forEach((p) => pousser(p.unite))
      else pousser(l.transports.unite)
    }
  }
  for (const u of c.unites) pousser(u.id)
  return trierParType(out)
})

const lignesArmes = (u: Unite) => (u.armes.length ? u.armes : [{ nom: '', portee: '', puissance: '' }])
/** lignes sous le profil : capacité de dommage, critique, notes (seulement si renseignées) */
const complements = (u: Unite, compact = false) => lignesComplementaires(u, compact)
const nbColonnesStats = 9
const colonneOptions = (s: Section) => !!s.colonne_options
const optionsFormation = (fid: string) => {
  const f = idx.formations.get(fid)
  if (!f) return ''
  const s = idx.sectionDe.get(fid)
  const ids = f.options ?? s?.options ?? []
  return [...ids, ...f.options_plus].filter((o) => !f.options_moins.includes(o)).map((o) => idx.options.get(o)?.nom ?? o).join(', ')
}
const pied = `CODEX ${c.codex.nom.toUpperCase()} - EAFR - REV ${c.codex.version}`
</script>

<template>
  <div class="doc" :class="{ paysage }" data-pret :style="{ '--accent': couleur }">
    <!-- Couverture (optionnelle) : même mise en page, avec l'illustration en fond si le codex en a une -->
    <section v-if="opts.couverture" class="page couverture" :class="{ illustree: !!c.codex.illustration }">
      <div v-if="c.codex.illustration" class="couverture-fond" :style="{ backgroundImage: `url(${c.codex.illustration})` }" />
      <div class="couverture-bloc">
        <div class="couverture-bande" />
        <p class="couverture-sur">Epic Armageddon</p>
        <h1 class="couverture-titre">{{ c.codex.nom }}</h1>
        <p class="couverture-sous">Liste d'armée {{ c.codex.faction }}</p>
        <blockquote v-if="c.codex.citation" class="couverture-citation">
          « {{ c.codex.citation.texte }} »
          <footer v-if="c.codex.citation.auteur">{{ c.codex.citation.auteur }}</footer>
        </blockquote>
        <p class="couverture-version">Version {{ c.codex.version }}</p>
        <div class="couverture-bande bas" />
      </div>
    </section>

    <!-- Présentation et règles spéciales -->
    <section class="page">
      <h1 class="titre">{{ c.codex.nom }}</h1>
      <div class="deux-colonnes">
        <div>
          <blockquote v-if="c.codex.citation" class="citation">
            « {{ c.codex.citation.texte }} »
            <footer v-if="c.codex.citation.auteur">{{ c.codex.citation.auteur }}</footer>
          </blockquote>
          <h2>Utiliser la liste d'armée</h2>
          <!-- eslint-disable-next-line vue/no-v-html -- texte échappé par enrichir() -->
          <p v-for="(p, i) in paragraphes(c.codex.intro_md)" :key="i" v-html="p" />
        </div>
        <div>
          <div v-for="r in c.codex.regles_md" :key="r.titre" class="regle">
            <h2>{{ r.titre }}</h2>
            <!-- eslint-disable-next-line vue/no-v-html -- texte échappé par enrichir() -->
            <p v-for="(p, i) in paragraphes(r.texte)" :key="i" v-html="p" />
          </div>
        </div>
      </div>
      <p v-if="c.codex.credits" class="credits">{{ c.codex.credits }}</p>
      <div class="pied">{{ numero('regles') }} - {{ pied }}</div>
    </section>

    <!-- Page 2 : liste d'armée -->
    <section class="page">
      <h1 class="titre-liste">Liste d'armée {{ c.codex.nom }}</h1>
      <p class="chapeau">{{ initiativeTexte }}</p>

      <div v-for="(g, gi) in groupes" :key="gi" :class="g.bandeau ? 'groupe' : ''">
        <div v-if="g.bandeau" class="bandeau">{{ g.bandeau }}</div>
        <div :class="g.sections.length > 1 ? 'cote-a-cote' : ''">
          <div v-for="s in g.sections" :key="s.id" class="bloc">
            <div class="entete">
              {{ s.titre }}
              <small v-if="sousTitre(s, g.bandeau)">({{ sousTitre(s, g.bandeau) }})</small>
            </div>
            <table class="liste">
              <thead>
                <tr>
                  <th>Formations</th>
                  <th>Unités</th>
                  <th v-if="idx.formations.get(s.formations[0]!)?.sous_formations || idx.formations.get(s.formations[0]!)?.variantes.some(v => v.sous_formations)">Puissance synaptique</th>
                  <th v-if="colonneOptions(s)">Améliorations</th>
                  <th class="cout">Coût</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="fid in s.formations" :key="fid">
                  <tr v-if="idx.formations.get(fid)">
                    <td class="nom">{{ prefixeFormation(idx, idx.formations.get(fid)!) }}{{ idx.formations.get(fid)!.nom }}</td>
                    <td>
                      <div v-for="(l, li) in lignesFormation(idx, idx.formations.get(fid)!)" :key="li" class="ligne">
                        <span v-if="li > 0" class="ou">ou</span> {{ l.nom && lignesFormation(idx, idx.formations.get(fid)!).length > 1 && !l.composition.startsWith(l.nom) ? l.nom + ' : ' : '' }}{{ l.composition }}
                      </div>
                      <div v-for="oid in idx.formations.get(fid)!.options_plus" :key="oid" class="ligne italique">{{ phraseOption(idx, idx.options.get(oid)!) }}</div>
                      <div v-if="idx.formations.get(fid)!.description" class="ligne italique">{{ idx.formations.get(fid)!.description }}</div>
                    </td>
                    <td v-if="idx.formations.get(s.formations[0]!)?.sous_formations || idx.formations.get(s.formations[0]!)?.variantes.some(v => v.sous_formations)">
                      {{ phraseSousFormations(idx.formations.get(fid)!) }}
                    </td>
                    <td v-if="colonneOptions(s)" class="petit">{{ optionsFormation(fid) }}</td>
                    <td class="cout">
                      <div v-for="(l, li) in lignesFormation(idx, idx.formations.get(fid)!)" :key="li" class="ligne">{{ l.cout }}</div>
                      <div v-for="oid in idx.formations.get(fid)!.options_plus" :key="oid" class="ligne italique">({{ coutOption(idx.options.get(oid)!) }})</div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>

            <template v-if="s.tableau_options && optionsDeSection(idx, s).length">
              <div class="entete">
                {{ s.tableau_options.titre }}
                <small v-if="s.tableau_options.sous_titre">({{ s.tableau_options.sous_titre }})</small>
              </div>
              <table class="liste">
                <thead><tr><th>Améliorations</th><th>Unités</th><th class="cout">Coût</th></tr></thead>
                <tbody>
                  <tr v-for="o in optionsDeSection(idx, s)" :key="o.id">
                    <td class="nom">{{ o.nom }}{{ marqueNote(o, s) }}</td>
                    <td>{{ phraseOption(idx, o) }}</td>
                    <td class="cout">{{ coutOption(o) }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <!-- eslint-disable-next-line vue/no-v-html -- texte échappé par enrichir() -->
            <p v-for="(n, k) in s.notes" :key="k" class="note">* <span v-html="enrichir(n)" /></p>
          </div>
        </div>
      </div>
      <div class="pied">{{ numero('liste') }} - {{ pied }}</div>
    </section>

    <!-- Fiches de profils à l'ancienne (optionnelles) : une par unité -->
    <section v-if="opts.profils" class="page">
      <h1 class="titre-liste">Profils d'unité {{ c.codex.nom }}</h1>
      <div class="fiches">
        <table v-for="u in unitesOrdonnees" :key="u.id" class="fiche">
          <thead>
            <tr><th class="fiche-titre" colspan="5">{{ u.nom }}</th></tr>
            <tr class="fiche-entete"><th>Type</th><th>Vitesse</th><th>Blindage</th><th>CC</th><th>FF</th></tr>
          </thead>
          <tbody>
            <tr class="fiche-stats"><td>{{ u.type }}</td><td>{{ u.vitesse ?? '-' }}</td><td>{{ u.blindage ?? '-' }}</td><td>{{ u.cc ?? '-' }}</td><td>{{ u.ff ?? '-' }}</td></tr>
            <tr class="fiche-entete"><th colspan="2">Arme</th><th>Portée</th><th colspan="2">Puissance de feu</th></tr>
            <tr v-for="(a, ai) in lignesArmes(u)" :key="ai" class="fiche-arme">
              <td colspan="2">{{ a.nom || '-' }}</td><td>{{ a.portee || '-' }}</td><td colspan="2">{{ a.puissance || '-' }}</td>
            </tr>
            <tr v-for="(l, li) in complements(u)" :key="`c${li}`" class="fiche-comp">
              <td colspan="5"><strong v-if="l.label">{{ l.label }} : </strong>{{ l.texte }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pied">{{ numero('profils') }} - {{ pied }}</div>
    </section>

    <!-- Feuille de références (optionnelle) : tous les profils, triés par type -->
    <section v-if="opts.references" class="page">
      <h1 class="titre-liste">Feuille de références {{ c.codex.nom }}</h1>
      <table class="stats">
        <thead>
          <tr><th>Nom</th><th>Type</th><th>Vit</th><th>Bli</th><th>CC</th><th>FF</th><th>Arme</th><th>Portée</th><th>Puissance de feu</th></tr>
        </thead>
        <tbody>
          <template v-for="u in unitesOrdonnees" :key="u.id">
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
      <div class="pied">{{ numero('references') }} - {{ pied }}</div>
    </section>
  </div>
</template>

<style>
/* la taille de page est injectée par useHead (portrait ou paysage) */
html.print, html.print body { background: #fff; color: #111; }

/* À l'écran (aperçu dans le tiroir) : chaque section devient une feuille A4 posée sur un fond neutre. */
@media screen {
  html.print, html.print body { background: #4a4540; }
}
</style>

<style scoped>
.doc { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; line-height: 1.35; color: #111; background: #fff; max-width: 186mm; margin: 0 auto; }
.doc.paysage { max-width: 273mm; }

.page { position: relative; break-after: page; padding-bottom: 8mm; }
.page:last-child { break-after: auto; }
.titre { font-size: 24pt; letter-spacing: 1pt; text-transform: uppercase; margin: 0 0 8pt; color: #222; }
.titre-liste { font-size: 13pt; text-transform: uppercase; text-align: center; margin: 0 0 4pt; letter-spacing: .5pt; }
.chapeau { text-align: center; font-size: 8pt; margin: 0 0 8pt; }
.deux-colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
.citation { font-style: italic; margin: 0 0 10pt; padding-left: 8pt; border-left: 2px solid var(--accent); font-size: 9pt; }
.citation footer { font-style: normal; font-size: 8pt; margin-top: 3pt; }
h2 { font-size: 10pt; margin: 8pt 0 3pt; }
p { margin: 0 0 5pt; text-align: justify; }
.regle { margin-bottom: 6pt; }
.credits { font-size: 6.5pt; color: #555; margin-top: 12pt; }
.pied { position: absolute; bottom: 0; left: 0; font-size: 7pt; color: #444; }
.bandeau { background: var(--accent); color: #fff; text-align: center; font-weight: 700; font-size: 9pt; padding: 3pt; margin: 8pt 0 4pt; text-transform: uppercase; letter-spacing: .5pt; }
.cote-a-cote { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; align-items: start; }
.bloc { margin-bottom: 6pt; break-inside: avoid; }
.cote-a-cote { break-inside: avoid; }
.groupe { break-inside: avoid; }
.entete { background: color-mix(in srgb, var(--accent) 70%, #c9a56a); color: #fff; text-align: center; font-weight: 700; font-size: 8.5pt; padding: 2.5pt 4pt; margin: 4pt 0 0; text-transform: uppercase; letter-spacing: .3pt; }
.entete small { display: block; font-weight: 400; text-transform: none; font-style: italic; font-size: 7pt; letter-spacing: 0; }
table.liste { width: 100%; border-collapse: collapse; font-size: 7.6pt; }
table.liste th { text-align: left; font-size: 7pt; border-bottom: 1px solid #999; padding: 2pt 4pt; }
table.liste td { padding: 2pt 4pt; border-bottom: 1px dotted #ccc; vertical-align: top; }
table.liste td.nom { font-weight: 600; width: 30%; }
table.liste .cout { text-align: right; white-space: nowrap; width: 14%; }
table.liste th.cout { text-align: right; }
.ligne + .ligne { margin-top: 1pt; }
.ou { font-style: italic; color: #555; }
.italique { font-style: italic; }
.petit { font-size: 7pt; }
.note { font-size: 6.8pt; margin: 3pt 0 0; font-style: italic; }
table.stats { width: 100%; border-collapse: collapse; font-size: 7pt; }
table.stats th { text-align: left; font-size: 6.8pt; color: #fff; background: var(--accent); padding: 2pt 3pt; }
table.stats td { padding: 1.5pt 3pt; vertical-align: top; }
table.stats tr.premiere td { border-top: 1px solid #bbb; }
table.stats tr.derniere td { border-bottom: 1px solid #bbb; padding-bottom: 2.5pt; }
table.stats td.nom { font-weight: 600; }
table.stats tr.sous-ligne td { font-size: 6.6pt; font-style: italic; color: #333; padding-left: 6pt; }
table.stats tr.sous-ligne .etiquette { font-style: normal; font-weight: 600; }
table.stats tr.vide td { padding: 0; }
tr { break-inside: avoid; }

/* Couverture : bloc typographique centré, posé sur l'illustration quand il y en a une. */
.couverture { position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 271mm; }
.doc.paysage .couverture { min-height: 184mm; }
/* l'illustration déborde des marges pour couvrir la feuille entière
   (div et non img : un élément remplacé en position absolue ignore les décalages) */
.couverture-fond { position: absolute; top: -12mm; right: -12mm; bottom: -14mm; left: -12mm; background-position: center; background-size: cover; background-repeat: no-repeat; }
.couverture-bloc { position: relative; display: flex; flex-direction: column; align-items: center; }
.couverture-bande { width: 90mm; height: 3pt; background: var(--accent); }
.couverture-bande.bas { margin-top: 18pt; }
.couverture-sur { font-size: 10pt; letter-spacing: 3pt; text-transform: uppercase; color: #555; margin: 14pt 0 0; }
.couverture-titre { font-size: 40pt; line-height: 1.1; text-transform: uppercase; letter-spacing: 2pt; margin: 6pt 0; color: #222; }
.couverture-sous { font-size: 12pt; text-transform: uppercase; letter-spacing: 1.5pt; color: var(--accent); margin: 0 0 18pt; }
.couverture-citation { font-style: italic; font-size: 10pt; max-width: 120mm; margin: 0 0 18pt; }
.couverture-citation footer { font-style: normal; font-size: 8pt; margin-top: 4pt; color: #555; }
.couverture-version { font-size: 8.5pt; color: #555; margin: 0; }

/* Avec illustration : l'image occupe tout le papier, le bandeau de titre se pose vers le bas.
   Le padding-bas de `.page` est annulé, sinon le cadre de l'image dépasse et l'image est rognée. */
.couverture.illustree { justify-content: flex-end; background: #111; padding-bottom: 0; }
/* voile dégradé : le texte reste lisible sans masquer l'illustration */
.couverture.illustree::after { content: ''; position: absolute; right: -12mm; bottom: -14mm; left: -12mm; height: 135mm; background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, .62) 30%, rgba(0, 0, 0, .9) 55%, rgba(0, 0, 0, .94) 100%); }
.couverture.illustree .couverture-bloc { z-index: 1; padding: 0 14mm 16mm; color: #fff; }
.couverture.illustree .couverture-bande { width: 110mm; }
.couverture.illustree .couverture-sur { color: #e2e2e2; }
.couverture.illustree .couverture-titre { color: #fff; text-shadow: 0 1mm 3mm rgba(0, 0, 0, .8); }
.couverture.illustree .couverture-citation { color: #eee; max-width: 130mm; }
.couverture.illustree .couverture-citation footer,
.couverture.illustree .couverture-version { color: #ccc; }
/* la couleur du codex est souvent trop sombre sur fond noir : on l'éclaircit */
.couverture.illustree .couverture-bande { background: color-mix(in srgb, var(--accent) 35%, #fff); }
.couverture.illustree .couverture-sous { color: color-mix(in srgb, var(--accent) 30%, #fff); }

/* Fiches de profils à l'ancienne */
.fiches { display: grid; grid-template-columns: 1fr; gap: 6pt; }
.doc.paysage .fiches { grid-template-columns: 1fr 1fr; }
table.fiche { width: 100%; border-collapse: collapse; border: 1pt solid #333; break-inside: avoid; font-size: 7.2pt; }
.fiche-titre { background: var(--accent); color: #fff; text-align: center; text-transform: uppercase; letter-spacing: .5pt; font-size: 8.5pt; padding: 2.5pt; }
table.fiche .fiche-entete th { background: #eee; color: #111; text-align: center; font-size: 6.8pt; border-bottom: 1px solid #bbb; border-top: 1px solid #bbb; padding: 1.5pt 3pt; }
table.fiche td { padding: 1.5pt 3pt; vertical-align: top; }
.fiche-stats td { text-align: center; font-weight: 600; }
.fiche-arme td { border-bottom: 1px dotted #ddd; }
.fiche-arme td:nth-child(2) { text-align: center; width: 22%; }
.fiche-arme td:first-child { width: 38%; }
.fiche-comp td { font-size: 6.8pt; font-style: italic; border-top: 1px solid #eee; }
.fiche-comp strong { font-style: normal; }
/* Aperçu écran : feuilles séparées, au format réel, pour juger de la mise en page. */
@media screen {
  .doc, .doc.paysage { max-width: none; background: transparent; display: flex; flex-direction: column; align-items: center; gap: 6mm; padding: 6mm 4mm; }
  .doc .page { width: 186mm; min-height: 271mm; background: #fff; padding: 12mm 12mm 14mm; box-shadow: 0 1mm 4mm rgba(0, 0, 0, .45); }
  .doc.paysage .page { width: 273mm; min-height: 184mm; }
  /* la feuille porte déjà ses marges : l'illustration ne doit plus déborder, sinon elle sort du A4 */
  .doc .couverture-fond { top: 0; right: 0; bottom: 0; left: 0; }
  .doc .couverture.illustree::after { right: 0; bottom: 0; left: 0; }
  .doc .couverture.illustree { overflow: hidden; }
}
</style>
