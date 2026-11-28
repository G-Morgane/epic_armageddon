/** Listes publiques (partagées), lecture sans session : les plus récentes (12 par défaut, `?nombre=` jusqu'à 12). */
export default defineEventHandler((event) => {
  const n = Number(getQuery(event).nombre)
  return listerListesPubliques(Number.isInteger(n) && n >= 1 && n <= 12 ? n : 12)
})
