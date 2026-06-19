// Niveau de zoom du « mode présentation ».
export const PRESENTATION_ZOOM = 1.5;

// Bascule : si on est déjà (autour de) 150 %, on revient à 100 % ; sinon on
// passe à 150 %. Pur : aucune dépendance à l'API Chrome, donc testable.
export function nextPresentationZoom(currentZoom) {
  return currentZoom >= 1.45 ? 1.0 : PRESENTATION_ZOOM;
}
