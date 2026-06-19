# ColorTab — Coloration de l'onglet (favicon + groupes natifs)

**Date :** 2026-06-18
**Statut :** Design approuvé, prêt pour plan d'implémentation

## Contexte

ColorTab est une extension Chrome (Manifest V3) qui colore visuellement les
onglets selon le nom de domaine, pour identifier rapidement des instances
clients (ex. instances ServiceNow `*.service-now.com`).

L'extension dessine déjà un **liseré coloré autour de la page** + un badge
temporaire. Ce comportement reste inchangé.

L'utilisateur veut en plus colorer **l'onglet lui-même** dans la barre
d'onglets. Une extension Chrome ne peut pas peindre directement le fond d'un
onglet : on obtient l'effet par deux moyens indirects, additionnés.

## Objectif

Marquer l'onglet dans la barre d'onglets avec la couleur de la règle, via :

- **Feature A — Favicon coloré** : remplacer l'icône de l'onglet par une
  pastille de la couleur **exacte** de la règle. Toujours actif.
- **Feature C — Groupes d'onglets natifs** : placer les onglets matchés dans un
  groupe Chrome coloré (fond d'onglet natif). Optionnel, via un interrupteur
  global dans le popup.

## Périmètre

### Inclus
- Génération et pose d'un favicon-pastille (couleur exacte) côté content script.
- Ré-application du favicon sur SPA (ServiceNow réécrit favicon/titre).
- Restauration du favicon d'origine quand aucune règle ne matche.
- Groupement natif des onglets matchés, derrière un réglage `groupTabs`.
- Mapping couleur hex → couleur Chrome native la plus proche.
- Case à cocher « Grouper les onglets par règle » dans le popup.
- Permission `tabGroups` dans le manifest.

### Exclus (YAGNI)
- Teinte exacte du fond d'onglet (impossible : 8 couleurs Chrome fixes).
- Empêcher le déplacement des onglets lors du groupement (comportement natif
  inévitable).
- Groupement inter-fenêtres : le groupe vit dans la fenêtre de l'onglet.
- Toggle par règle pour le favicon (toujours actif).

## Architecture

```
┌─────────────────┐   GET_COLOR / APPLY_COLOR    ┌──────────────────────┐
│  content.js     │ ◀──────────────────────────▶ │  background.js (SW)  │
│  (par onglet)   │                              │                      │
│  - liseré       │                              │  - moteur de règles  │
│  - badge        │                              │  - APPLY_COLOR        │
│  - FAVICON (A)  │                              │  - GROUPES (C)        │
└─────────────────┘                              └──────────┬───────────┘
                                                            │
                          chrome.storage.sync               │
                          { rules[], groupTabs }            │
                                                            │
                                                  ┌─────────▼─────────┐
                                                  │  popup (réglages) │
                                                  │  - règles         │
                                                  │  - toggle groupes │
                                                  └───────────────────┘
```

## Feature A — Favicon coloré

**Fichier :** `content/content.js`

**Déclenchement :** à la réception du message `APPLY_COLOR`.

**Comportement :**
1. Au premier passage, mémoriser le favicon d'origine de la page (href du
   `<link rel="icon">` / `shortcut icon`, ou null s'il n'y en a pas).
2. Si `color` non nul : générer une pastille pleine via `<canvas>` (cercle ou
   carré arrondi rempli de `color`), encoder en data-URL PNG, et l'installer
   comme favicon — en supprimant les `<link rel*="icon">` existants et en
   injectant le nôtre (`id="colortab-favicon"`).
3. Si `color` nul (aucune règle) : retirer notre favicon et restaurer celui
   d'origine.

**SPA (ServiceNow) :** un `MutationObserver` sur `<head>` détecte si le site
réinjecte/retire son propre favicon ; on ré-applique alors notre pastille tant
qu'une couleur est active. L'observer est désactivé quand aucune couleur n'est
active.

**Couleur :** hex exact de la règle (pas de mapping).

## Feature C — Groupes d'onglets natifs

**Fichier :** `background/background.js`

**Réglage :** `groupTabs` (booléen) dans `chrome.storage.sync`, défaut `false`.

**Quand `groupTabs` est vrai et qu'un onglet matche une règle :**
1. Déterminer la couleur Chrome native la plus proche de `rule.color` (distance
   euclidienne RGB sur les 8 couleurs : grey, blue, red, yellow, green, pink,
   purple, cyan, orange).
2. Chercher dans la fenêtre de l'onglet un groupe existant dont le titre ===
   `rule.label`. S'il existe, y ajouter l'onglet ; sinon créer un groupe avec
   l'onglet, puis lui poser titre = `rule.label` et couleur = couleur mappée.
3. Robustesse : la résolution du groupe se fait toujours par requête de l'état
   Chrome réel (`chrome.tabGroups.query`), jamais via un état en mémoire du
   service worker (qui peut être tué à tout moment).

**Quand un onglet matché quitte le domaine (plus de règle) :** le retirer de son
groupe (`chrome.tabs.ungroup`).

**Quand l'utilisateur décoche `groupTabs` :** dégrouper les onglets des groupes
« nous appartenant », c.-à-d. ceux dont le titre correspond à un `label` de
règle existant, dans toutes les fenêtres.

**Mapping des couleurs Chrome (valeurs RGB de référence) :**
grey `#5f6368`, blue `#1a73e8`, red `#d93025`, yellow `#f9ab00`,
green `#188038`, pink `#d01884`, purple `#a142f4`, cyan `#007b83`,
orange `#fa903e`.

## Popup

**Fichiers :** `popup/popup.html`, `popup/popup.js`, `popup/popup.css`

- Ajouter une case à cocher **« Grouper les onglets par règle »** liée à
  `storage.sync.groupTabs`.
- Lecture au chargement, écriture à chaque changement.
- Le changement de `groupTabs` est capté par `storage.onChanged` dans le
  background, qui applique/retire le groupement sur les onglets ouverts.

## Manifest

`manifest.json` : ajouter `"tabGroups"` à `permissions`. (`tabs` déjà présent.)

## Schéma de stockage

```jsonc
{
  "rules": [ { "pattern": "*.service-now.com", "color": "#FF8C00", "label": "..." } ],
  "groupTabs": false   // nouveau, défaut false
}
```

## Flux de données

1. Onglet chargé/activé → `background` calcule la règle qui matche.
2. `background` envoie `APPLY_COLOR { color, label }` au content script
   → liseré + badge + **favicon coloré (A)**.
3. Si `groupTabs` actif → `background` groupe l'onglet **(C)**.
4. Changement de règle ou de `groupTabs` dans le popup → `storage.onChanged`
   → ré-application sur tous les onglets ouverts.

## Gestion des erreurs / cas limites

- Pages restreintes (`chrome://`, Web Store, PDF, page vide) : pas de content
  script → pas de favicon ; le groupement peut quand même s'appliquer si l'URL
  matche (rare). Échecs `sendMessage` ignorés (déjà le cas).
- `tabGroups.query`/`group` peuvent échouer si l'onglet est en cours de
  fermeture/déplacement : envelopper dans try/catch, ignorer silencieusement.
- Favicon d'origine absent : à la restauration, retirer simplement notre favicon
  (le navigateur retombe sur l'icône par défaut).
- Onglet déplacé vers une autre fenêtre : le groupement se ré-évalue au prochain
  `onUpdated`/`onActivated`.

## Tests / vérification manuelle

1. Recharger l'extension + recharger un onglet `*.service-now.com` → favicon
   devient une pastille orange dans la barre d'onglets.
2. Naviguer vers un domaine sans règle → l'icône d'origine revient.
3. Activer « Grouper les onglets » → les onglets ServiceNow se regroupent avec
   un fond d'onglet coloré ; le décocher → ils se dégroupent.
4. Vérifier la persistance après mise en veille du service worker (attendre,
   puis ouvrir un nouvel onglet matché → toujours groupé/coloré).
5. Vérifier sur une SPA ServiceNow que la pastille reste après navigation
   interne (changement de formulaire/enregistrement).
