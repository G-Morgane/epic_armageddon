/** Abréviations utilisées dans tous les codex, groupées par thème (page optionnelle du PDF). */
export const ABREVIATIONS: Array<{ theme: string; entrees: Array<[string, string]> }> = [
  { theme: 'Type d\'unités', entrees: [['Perso', 'Personnage'], ['Inf', 'Infanterie'], ['VL', 'Véhicule Léger'], ['VB', 'Véhicule Blindé'], ['EG', 'Engin de Guerre'], ['A', 'Aéronef'], ['VS', 'Vaisseau Spatial']] },
  { theme: 'Caractéristiques d\'unités', entrees: [['CC', 'Valeur de Corps à Corps'], ['FF', 'Valeur de Fusillade'], ['CD', 'Capacité de Dommage de l\'Engin de Guerre'], ['BI', 'Boucliers Impériaux']] },
  { theme: 'Catégorie d\'aéronef', entrees: [['C', 'Aéronef de type Chasseur'], ['CB', 'Aéronef de type Chasseur-Bombardier'], ['B', 'Aéronef de type Bombardier']] },
  { theme: 'Puissance de feu', entrees: [['AP', 'Anti-Personnel'], ['AC', 'Anti-Char'], ['MA', 'Macro-Arme'], ['PB', 'Point de Barrage'], ['AA', 'Armes Antiaériennes']] },
  { theme: 'Règles spéciales', entrees: [['+1A', 'Attaque Supplémentaire'], ['FeP', 'Frappe en Premier'], ['IC', 'Ignore les Couverts'], ['Snp', 'Sniper'], ['Rpt', 'Rupture'], ['Rchg', 'Rechargement'], ['Ind', 'Tir Indirect'], ['Uniq', 'Tir Unique'], ['TT', 'Tueur de Titan']] },
  { theme: 'Arc de tir', entrees: [['Frt', 'Arc de Tir Frontal'], ['FrtF', 'Arc de Tir Frontal Fixe'], ['Arr', 'Arc de Tir Arrière'], ['Drt', 'Arc de Tir Droit'], ['Gch', 'Arc de Tir Gauche']] },
]
