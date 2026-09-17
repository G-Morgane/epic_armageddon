<script setup lang="ts">
import type { Codex, Section, Unite } from '~~/shared/codex/schema'
import { indexerCodex } from '~~/shared/codex/engine'
import { lignesFormation, prefixeFormation, phraseSousFormations, phraseOption, coutOption, marqueNote, sousTitreSection, optionsDeSection } from '~~/shared/codex/phrases'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const { data: codex, error } = await useFetch<Codex>(`/api/codex/${slug}`)
if (error.value || !codex.value) throw createError({ statusCode: 404, statusMessage: 'Codex introuvable' })

const c = codex.value
const idx = indexerCodex(c)
const couleur = c.codex.couleur ?? '#8a6d3b'
useHead({ title: `Codex ${c.codex.nom}`, htmlAttrs: { class: 'print' } })

const paragraphes = (md?: string) => (md ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

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
  return out
})

const lignesArmes = (u: Unite) => (u.armes.length ? u.armes : [{ nom: '', portee: '', puissance: '' }])
const notesUnite = (u: Unite) => {
  const parts = [...u.notes]
  if (u.degats) parts.push(`CD${u.degats.cd}${u.degats.bi !== undefined ? ` / BI${u.degats.bi}` : ''}${u.degats.critique ? ` : Critique : ${u.degats.critique}` : ''}`)
  return parts.join('. ')
}
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
  <div class="doc" data-pret :style="{ '--accent': couleur }">
    <!-- Page 1 : présentation -->
    <section class="page">
      <h1 class="titre">{{ c.codex.nom }}</h1>
      <div class="deux-colonnes">
        <div>
          <blockquote v-if="c.codex.citation" class="citation">
            « {{ c.codex.citation.texte }} »
            <footer v-if="c.codex.citation.auteur">{{ c.codex.citation.auteur }}</footer>
          </blockquote>
          <h2>Utiliser la liste d'armée</h2>
          <p v-for="(p, i) in paragraphes(c.codex.intro_md)" :key="i">{{ p }}</p>
        </div>
        <div>
          <div v-for="r in c.codex.regles_md" :key="r.titre" class="regle">
            <h2>{{ r.titre }}</h2>
            <p v-for="(p, i) in paragraphes(r.texte)" :key="i">{{ p }}</p>
          </div>
        </div>
      </div>
      <p v-if="c.codex.credits" class="credits">{{ c.codex.credits }}</p>
      <div class="pied">1 - {{ pied }}</div>
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
            <p v-for="(n, k) in s.notes" :key="k" class="note">* {{ n }}</p>
          </div>
        </div>
      </div>
      <div class="pied">2 - {{ pied }}</div>
    </section>

    <!-- Feuilles de références -->
    <section class="page">
      <h1 class="titre-liste">Feuille de références {{ c.codex.nom }}</h1>
      <table class="stats">
        <thead>
          <tr><th>Nom</th><th>Type</th><th>Vitesse</th><th>Blindage</th><th>CC</th><th>FF</th><th>Arme</th><th>Portée</th><th>Puissance de feu</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <template v-for="u in unitesOrdonnees" :key="u.id">
            <tr v-for="(a, ai) in lignesArmes(u)" :key="ai" :class="{ premiere: ai === 0, derniere: ai === lignesArmes(u).length - 1 }">
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
              <td v-if="ai === 0" class="notes" :rowspan="lignesArmes(u).length">{{ notesUnite(u) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
      <div class="pied">3 - {{ pied }}</div>
    </section>
  </div>
</template>

<style>
@page { size: A4; margin: 12mm 12mm 14mm 12mm; }
html.print, html.print body { background: #fff; color: #111; }
</style>

<style scoped>
.doc { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; line-height: 1.35; color: #111; background: #fff; max-width: 186mm; margin: 0 auto; }
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
table.stats th { text-align: left; font-size: 6.8pt; border-bottom: 1px solid #999; padding: 2pt 3pt; }
table.stats td { padding: 1.5pt 3pt; vertical-align: top; }
table.stats tr.derniere td { border-bottom: 1px solid #ddd; }
table.stats td.nom { font-weight: 600; }
table.stats td.notes { max-width: 45mm; font-size: 6.5pt; }
tr { break-inside: avoid; }
</style>
