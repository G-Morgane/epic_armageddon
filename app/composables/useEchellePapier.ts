/**
 * Met la feuille à l'échelle de l'écran quand la fenêtre est plus étroite qu'elle.
 *
 * L'aperçu pose des pages A4 (210 mm, 297 mm en paysage) sur un fond neutre.
 * Sur un téléphone la feuille est deux fois plus large que la fenêtre, et comme
 * le conteneur les centre, le débordement de gauche est inatteignable au doigt :
 * le document paraît coupé et rien ne le ramène. On réduit donc la feuille au
 * lieu de la laisser déborder.
 *
 * `zoom` et non `transform: scale()` : la hauteur du document suit, donc le
 * défilement vertical reste juste. L'impression n'est pas concernée, la feuille
 * de style remet l'échelle à 1 en `@media print`.
 */
export function useEchellePapier(paysage: boolean) {
  const echelle = ref(1)
  // largeur de la feuille plus les 4 mm de marge du conteneur de chaque côté, en px CSS
  const largeur = ((paysage ? 297 : 210) + 8) * 96 / 25.4

  function ajuster() {
    echelle.value = Math.min(1, document.documentElement.clientWidth / largeur)
  }
  onMounted(() => {
    ajuster()
    window.addEventListener('resize', ajuster)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', ajuster))

  return echelle
}
