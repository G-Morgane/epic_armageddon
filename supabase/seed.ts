import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://nomrnaobradtiddfewxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbXJuYW9icmFkdGlkZGZld3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI1MjY4MiwiZXhwIjoyMDg5ODI4NjgyfQ.gbDOjoaduDTjQn0a-3xUSzhvp1HF1oZ49oUJOyLmY0A',
)

const armies = [
  // IMPERIUM
  { name: 'Adeptus Astartes', faction: 'imperium', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Adeptus-Astartes-REV-1.3.pdf' },
  { name: 'Grey Knights', faction: 'imperium', version: '1.0', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/02/Codex-Grey-Knights-REV-1.0.pdf' },
  { name: 'Dark Angels', faction: 'imperium', version: '1.0', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Dark-Angels-REV-1.0.pdf' },
  { name: 'Imperial Fists', faction: 'imperium', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Imperial-Fists-REV-1.2.pdf' },
  { name: 'Salamanders', faction: 'imperium', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/02/Codex-Salamanders-REV-1.2.pdf' },
  { name: 'White Scars', faction: 'imperium', version: '1.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-White-Scars-REV-1.1.pdf' },
  { name: 'Black Templars', faction: 'imperium', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Black-Templar-REV-1.3.pdf' },
  { name: 'Blood Angels', faction: 'imperium', version: '1.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Blood-Angels-REV-1.1.pdf' },
  { name: 'Raven Guard', faction: 'imperium', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Raven-Guard-REV-1.2.pdf' },
  { name: 'Space Wolves', faction: 'imperium', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/01/Codex-Space-Wolves-REV-1.2.pdf' },
  { name: 'Légion d\'Acier', faction: 'imperium', version: '1.2.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2023/10/Codex-Legion-dAcier-REV-1.2.1.pdf' },
  { name: 'Death Korps de Krieg', faction: 'imperium', version: '1.4', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2024/12/Codex-Death-Korps-de-Krieg.pdf' },
  { name: 'Paras Elysiens', faction: 'imperium', version: '1.04', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2023/07/Codex-Paras-Elysiens-REV1.04.pdf' },
  { name: 'Premiers-nés Vostroyens', faction: 'imperium', version: '1.4', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Premiers-Nes-Vostroyens-REV-1.4.pdf' },
  { name: 'Légions Titaniques', faction: 'imperium', version: '1.4.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Legion-Titanique-REV-1.4.1.pdf' },
  { name: 'Adeptus Mechanicus', faction: 'imperium', version: '1.5', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Adeptus-Mechanicus-REV-1.5.pdf' },
  { name: 'Chevaliers Impériaux', faction: 'imperium', version: '1.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2023/03/Codex-Chevaliers-Imperiaux-REV-1.1.pdf' },
  { name: 'Adepta Sororitas', faction: 'imperium', version: '1.0.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Adepta-Sororitas-REV-1.0.1.pdf' },
  { name: 'Adeptus Arbites', faction: 'imperium', version: '1.1.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Adeptus-Arbites-REV-1.1.1.pdf' },

  // CHAOS
  { name: 'Égarés et Damnés', faction: 'chaos', version: '1.8', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/02/Codex-Egares-et-Damnes-REV-1.8.pdf' },
  { name: 'Black Legion', faction: 'chaos', version: '1.6.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Black-Legion-REV-1.6.1.pdf' },
  { name: 'Word Bearers', faction: 'chaos', version: '1.4', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/12/Codex-Word-Bearers-REV-1.4.pdf' },
  { name: 'Iron Warriors', faction: 'chaos', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Iron-Warriors-REV-1.3.pdf' },
  { name: 'World Eaters', faction: 'chaos', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-World-Eaters-REV-1.2.pdf' },
  { name: 'Thousand Sons', faction: 'chaos', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Thousand-sons-REV-1.2.pdf' },
  { name: 'Death Guard', faction: 'chaos', version: '1.2.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Death-guard-REV-1.2.1.pdf' },
  { name: 'Emperor\'s Children', faction: 'chaos', version: '1.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Emperors-Children-REV-1.2.pdf' },

  // XENOS
  { name: 'Orks de Ghazghkull', faction: 'xenos', version: '1.6', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2024/12/Codex-Orks-de-GHAZGHKULL.pdf' },
  { name: 'Gargants d\'Orkimedes', faction: 'xenos', version: '1.0', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Gargants-dORKIMEDES.pdf' },
  { name: 'Eldars de Biel-Tan', faction: 'xenos', version: '1.4', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2023/03/Codex-Biel-Tan-1.4.pdf' },
  { name: 'Eldars de Ulthwé', faction: 'xenos', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/02/Codex-Ulthwe-REV-1.3.pdf' },
  { name: 'Eldars d\'Iyanden', faction: 'xenos', version: '1.0', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Iyanden-Compendium-REV-1.0.pdf' },
  { name: 'Eldars d\'Yme-Loc', faction: 'xenos', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2026/02/Codex-Yme-Loc-REV-1.3.pdf' },
  { name: 'Tyranides', faction: 'xenos', version: '1.2.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Tyranides-REV-1.2.2.pdf' },
  { name: 'Empire T\'au', faction: 'xenos', version: '1.3.1', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2023/10/Codex-Tau-REV-1.3.1.pdf' },
  { name: 'Nécrons', faction: 'xenos', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Necrons-REV-1.3.pdf' },
  { name: 'Eldars Noirs', faction: 'xenos', version: '1.3', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/12/Codex-Eldars-Noirs-REV-1.3.pdf' },
  { name: 'Squats', faction: 'xenos', version: '1.2.2', pdf_url: 'https://www.epicarmageddon.fr/wp-content/uploads/2025/10/Codex-Squat-REV-1.2.2.pdf' },
]

async function seed() {
  // Clean existing data
  await supabase.from('army_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('armies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('Cleaned existing data')

  for (const army of armies) {
    // Insert army
    const { data: armyData, error: armyErr } = await supabase
      .from('armies')
      .insert({ name: army.name, faction: army.faction })
      .select()
      .single()

    if (armyErr) {
      console.log(`Error inserting ${army.name}:`, armyErr.message)
      continue
    }

    // Insert version
    const { error: verErr } = await supabase.from('army_versions').insert({
      army_id: armyData.id,
      version: army.version,
      pdf_url: army.pdf_url,
      changelog: 'Version initiale',
      is_current: true,
    })

    if (verErr) {
      console.log(`Error inserting version for ${army.name}:`, verErr.message)
      continue
    }

    console.log(`✓ ${army.name} (${army.faction}) v${army.version}`)
  }

  console.log('\nDone! Total:', armies.length)
}

seed()
