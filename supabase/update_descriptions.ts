import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://nomrnaobradtiddfewxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbXJuYW9icmFkdGlkZGZld3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI1MjY4MiwiZXhwIjoyMDg5ODI4NjgyfQ.gbDOjoaduDTjQn0a-3xUSzhvp1HF1oZ49oUJOyLmY0A',
)

const descriptions: Record<string, string> = {
  // IMPERIUM
  'Adeptus Astartes': "Les Space Marines sont les guerriers d'élite génétiquement modifiés de l'Empereur. Polyvalents et redoutables, ils forment le fer de lance des armées impériales avec leur infanterie lourde, leurs blindés et leur soutien aérien.",
  'Grey Knights': "Le chapitre le plus secret de l'Imperium, spécialisé dans la lutte contre les démons. Chaque Grey Knight est un psyker, et leur arsenal est spécifiquement conçu pour affronter les forces du Warp.",
  'Dark Angels': "Premier chapitre Space Marine fondé, les Dark Angels sont des tacticiens rigoureux qui excellent dans la guerre combinée. Leur Deathwing (Terminators) et Ravenwing (unités rapides) en font une force redoutable.",
  'Imperial Fists': "Maîtres incontestés du siège et de la fortification, les Imperial Fists excellent dans la guerre défensive et les assauts de positions retranchées. Leur discipline et leur ténacité sont légendaires.",
  'Salamanders': "Chapitre réputé pour sa maîtrise du feu et de la forge. Les Salamanders utilisent massivement les lance-flammes et armes à fusion. Proches de leur peuple, ils sont parmi les plus humains des Space Marines.",
  'White Scars': "Héritiers de Jaghatai Khan, les White Scars sont des maîtres de la guerre rapide et du harcèlement. Leurs formations de motos et de véhicules légers frappent avec une vitesse dévastatrice.",
  'Black Templars': "Croisés fanatiques, les Black Templars sont engagés dans une croisade éternelle à travers la galaxie. Ils privilégient le combat au corps à corps et mènent des charges féroces.",
  'Blood Angels': "Les fils de Sanguinius sont des guerriers nobles mais hantés par la Soif Rouge. Ils excellent dans l'assaut aéroporté et le combat au corps à corps, soutenus par leurs Dreadnoughts furieux.",
  'Raven Guard': "Spécialistes de l'infiltration et des opérations furtives, les Raven Guard frappent depuis les ombres. Leurs tactiques reposent sur la surprise, la vitesse et la précision chirurgicale.",
  'Space Wolves': "Les loups de Fenris sont des guerriers féroces qui combattent avec une sauvagerie contrôlée. Leur style de guerre agressif et leurs unités uniques comme les Thunderwolf Cavalry en font une force imprévisible.",
  "Légion d'Acier": "La Légion d'Acier d'Armageddon est une force de la Garde Impériale spécialisée dans la guerre mécanisée. Chimères, Leman Russ et Baneblades forment le cœur de leurs régiments blindés.",
  'Death Korps de Krieg': "Régiment de la Garde Impériale issu du monde dévasté de Krieg. Connus pour leur stoïcisme face à la mort, ils excellent dans la guerre de tranchées et les assauts de siège avec une détermination fanatique.",
  'Paras Elysiens': "Régiment aéroporté d'élite de la Garde Impériale, les Paras Elysiens se spécialisent dans les largages en zone chaude et les opérations de frappe rapide depuis les airs.",
  'Premiers-nés Vostroyens': "Régiment de la Garde Impériale originaire du monde industriel de Vostroya. Connus pour leur équipement de qualité et leurs traditions martiales anciennes, ils combinent infanterie disciplinée et puissance de feu.",
  'Légions Titaniques': "Les Titans sont les machines de guerre les plus dévastatrices de l'Imperium. Du scout Warhound au titanesque Imperator, ces colosses dominent les champs de bataille par leur puissance de feu apocalyptique.",
  'Adeptus Mechanicus': "Le culte de la Machine fournit les armées technologiques de Mars. Skitarii, Chevaliers et engins de guerre ésotériques se combinent pour former une force où la technologie est vénérée comme divine.",
  'Chevaliers Impériaux': "Pilotés par des nobles de mondes chevaliers, ces marcheurs de combat géants sont des machines de guerre polyvalentes. Chaque Chevalier est une puissance individuelle sur le champ de bataille.",
  'Adepta Sororitas': "Les Sœurs de Bataille sont les guerrières de l'Ecclesiarchie, animées par une foi inébranlable. Leur infanterie fanatique, leurs Exorcistes et leurs saintes vivantes apportent la fureur de l'Empereur.",
  'Adeptus Arbites': "La police impériale de l'Adeptus Arbites maintient l'ordre sur les mondes de l'Imperium. Équipés pour la répression et le contrôle de foule, ils peuvent aussi s'avérer redoutables en situation de guerre ouverte.",

  // CHAOS
  'Égarés et Damnés': "Les masses corrompues du Chaos, composées de cultistes, de mutants et de renégats. Leur force réside dans le nombre et la diversité de leurs unités, soutenues par des démons invoqués du Warp.",
  'Black Legion': "La légion d'Abaddon le Fléau, héritière des Sons of Horus. La Black Legion est la plus puissante force du Chaos Undivided, combinant Space Marines renégats, démons et machines infernales.",
  'Word Bearers': "Premiers Space Marines à embrasser le Chaos, les Word Bearers sont des fanatiques religieux du Chaos Undivided. Ils excellent dans l'invocation démoniaque et la guerre psychologique.",
  'Iron Warriors': "Maîtres du siège et de la guerre d'attrition, les Iron Warriors sont les rivaux jurés des Imperial Fists. Leur arsenal massif d'artillerie et de machines de siège brise toute fortification.",
  'World Eaters': "Dévoués à Khorne, le Dieu du Sang, les World Eaters sont des berserkers assoiffés de carnage. Leur seule tactique : la charge frontale au corps à corps avec une brutalité sans égale.",
  'Thousand Sons': "La légion de Magnus le Rouge, dévouée à Tzeentch. Les Thousand Sons sont des sorciers redoutables dont les pouvoirs psychiques dévastateurs compensent leur nombre réduit de guerriers.",
  'Death Guard': "Les fils putrides de Mortarion, bénis par Nurgle. Incroyablement résistants et implacables, les Death Guard avancent inexorablement en répandant peste et désolation.",
  "Emperor's Children": "Dévoués à Slaanesh, les Emperor's Children recherchent la perfection dans l'excès. Rapides et mortels, ils combinent vitesse, puissance sonique et une cruauté raffinée.",

  // XENOS
  'Orks de Ghazghkull': "La plus grande Waaagh! de la galaxie, menée par le brutal Ghazghkull Mag Uruk Thraka. Des hordes de Boyz, des véhicules bringuebalants et des Gargants constituent cette marée verte dévastatrice.",
  "Gargants d'Orkimedes": "Une force Ork centrée sur les machines de guerre colossales. Les Gargants d'Orkimedes sont des monstruosités mécaniques bristling d'armes improbables mais terriblement efficaces.",
  'Eldars de Biel-Tan': "Le plus belliqueux des vaisseaux-mondes Eldars, Biel-Tan privilégie la guerre offensive avec ses Aspects Guerriers d'élite et ses formations rapides et meurtrières.",
  'Eldars de Ulthwé': "Le vaisseau-monde le plus proche de l'Œil de la Terreur, Ulthwé est renommé pour ses puissants psykers et ses Gardiens Noirs aguerris par des siècles de guerre contre le Chaos.",
  "Eldars d'Iyanden": "Un vaisseau-monde dévasté par les Tyranides, Iyanden compte massivement sur ses Chevaliers Fantômes et Seigneurs Fantômes — les esprits de ses morts combattant dans des constructs de wraithbone.",
  "Eldars d'Yme-Loc": "Vaisseau-monde réputé pour ses artisans et ses machines de guerre. Yme-Loc déploie un grand nombre d'engins lourds et de Titans Eldars sur le champ de bataille.",
  'Tyranides': "L'essaim dévoreur venu de l'extérieur de la galaxie. Les Tyranides submergent leurs ennemis sous des vagues de bio-créatures adaptatives, du minuscule Termagant au titanesque Bio-Titan.",
  "Empire T'au": "Une civilisation jeune et technologiquement avancée, les T'au combattent à distance avec des battlesuits, des drones et une puissance de feu redoutable. Leur philosophie du Bien Suprême unit diverses espèces.",
  'Nécrons': "Les anciens maîtres de la galaxie, réveillés de leur sommeil millénaire. Les Nécrons sont quasiment indestructibles, dotés de technologies incompréhensibles et d'une capacité de régénération terrifiante.",
  'Eldars Noirs': "Les cousins sadiques des Eldars, les Drukhari lancent des raids éclairs depuis leur cité de Commorragh. Rapides et fragiles, ils frappent sans prévenir et disparaissent avec leurs captifs.",
  'Squats': "Les Squats sont une race d'abhumains trapus et résistants, héritiers d'une technologie robuste. Leurs guildes de guerriers et leurs machines lourdes en font des adversaires tenaces et bien armés.",
}

async function update() {
  for (const [name, description] of Object.entries(descriptions)) {
    const { error } = await supabase
      .from('armies')
      .update({ description })
      .eq('name', name)

    if (error) {
      console.log(`✗ ${name}:`, error.message)
    } else {
      console.log(`✓ ${name}`)
    }
  }
  console.log('\nDone!')
}

update()
