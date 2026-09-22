/**
 * Le **scocche** delle rotte dinamiche.
 *
 * L'app deve aprirsi senza rete. Le rotte con un segmento dinamico non si possono
 * prerenderizzare per ogni id possibile (gli id li crea l'utente), quindi ognuna
 * prerenderizza una sola pagina con il segnaposto `_`: e' la scocca che il service
 * worker serve, offline, per qualunque id di quella famiglia. Il componente legge poi
 * l'id vero da `location.pathname` (`useRouteId`).
 *
 * Questo modulo non e' `"use client"` di proposito: `generateStaticParams` gira sul
 * server, al build.
 */

export const DYNAMIC_SHELL_PARAM = "_";

export function shellParams<K extends string>(key: K) {
  return [{ [key]: DYNAMIC_SHELL_PARAM }] as Record<K, string>[];
}
