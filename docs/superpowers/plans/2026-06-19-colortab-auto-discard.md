# ColorTab — Mise en veille auto des onglets inactifs — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre automatiquement en veille (`chrome.tabs.discard`) les onglets inactifs depuis un délai configurable (5 min par défaut), pour libérer la mémoire.

**Architecture:** Une fonction pure `shouldDiscard(tab, now, thresholdMs)` décide cas par cas ; le service worker la branche sur une alarme `chrome.alarms` périodique (1 min) qui balaie tous les onglets. Le popup expose un interrupteur et un délai, stockés dans `chrome.storage.sync`.

**Tech Stack:** Chrome Extension MV3, JavaScript (modules ES), API `chrome.alarms` / `chrome.tabs.discard` / `chrome.tabs.lastAccessed` / `chrome.storage.sync`.

> **Tests :** la décision de mise en veille est isolée dans une fonction pure testée via `node`. Le câblage (alarme, API Chrome, popup) se vérifie manuellement dans Chrome — checkpoints explicites.

---

### Task 1 : Fonction pure de décision + test (TDD)

**Files:**
- Create: `background/discard.js`
- Test: `background/discard.test.mjs`

- [ ] **Step 1 : Écrire le test qui échoue**

`background/discard.test.mjs` :

```js
import assert from "node:assert";
import { shouldDiscard } from "./discard.js";

const NOW = 10_000_000;
const SEUIL = 5 * 60 * 1000; // 5 min
const vieux = NOW - SEUIL - 1; // dépasse le seuil
const recent = NOW - 1000; // < seuil

const base = { id: 1, active: false, pinned: false, discarded: false, lastAccessed: vieux };

// Cas nominal : inactif assez longtemps → mise en veille
assert.strictEqual(shouldDiscard(base, NOW, SEUIL), true);

// Onglet actif → jamais
assert.strictEqual(shouldDiscard({ ...base, active: true }, NOW, SEUIL), false);

// Onglet épinglé → jamais
assert.strictEqual(shouldDiscard({ ...base, pinned: true }, NOW, SEUIL), false);

// Déjà en veille → non
assert.strictEqual(shouldDiscard({ ...base, discarded: true }, NOW, SEUIL), false);

// Accédé récemment → non
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: recent }, NOW, SEUIL), false);

// lastAccessed absent → non (sécurité)
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: undefined }, NOW, SEUIL), false);

// Pile au seuil → mise en veille (>=)
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: NOW - SEUIL }, NOW, SEUIL), true);

// tab nul → non
assert.strictEqual(shouldDiscard(null, NOW, SEUIL), false);

console.log("discard.test.mjs OK");
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `node background/discard.test.mjs`
Expected: FAIL — `Cannot find module './discard.js'`.

- [ ] **Step 3 : Implémenter `background/discard.js`**

```js
// Décide si un onglet doit être mis en veille.
// Pure : aucune dépendance à l'API Chrome, donc testable hors navigateur.
export function shouldDiscard(tab, now, thresholdMs) {
  if (!tab) return false;
  if (tab.active) return false; // onglet actif de sa fenêtre
  if (tab.pinned) return false; // épinglé
  if (tab.discarded) return false; // déjà en veille
  if (typeof tab.lastAccessed !== "number") return false; // info absente → on ne touche pas
  return now - tab.lastAccessed >= thresholdMs;
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `node background/discard.test.mjs`
Expected: PASS — affiche `discard.test.mjs OK`, code de sortie 0.

- [ ] **Step 5 : Commit**

```bash
git add background/discard.js background/discard.test.mjs
git commit -m "feat: pure shouldDiscard decision + test"
```

---

### Task 2 : Permission `alarms` dans le manifest

**Files:**
- Modify: `manifest.json` (tableau `permissions`)

- [ ] **Step 1 : Ajouter `"alarms"`**

Dans `manifest.json`, le tableau `permissions` doit devenir :

```json
  "permissions": [
    "activeTab",
    "storage",
    "tabs",
    "tabGroups",
    "alarms"
  ],
```

- [ ] **Step 2 : Vérifier que le JSON reste valide**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: affiche `valid`.

- [ ] **Step 3 : Commit**

```bash
git add manifest.json
git commit -m "feat: add alarms permission"
```

---

### Task 3 : Balayage périodique dans le service worker

**Files:**
- Modify: `background/background.js` (import, defaults, alarme, onAlarm, scan)

Le fichier commence actuellement par :
```js
import { nearestChromeGroupColor } from "./colors.js";

const DEFAULT_RULES = [
  { pattern: "*.service-now.com", color: "#FF8C00", label: "ServiceNow (défaut)" }
];

chrome.runtime.onInstalled.addListener(async () => {
  const { rules } = await chrome.storage.sync.get("rules");
  if (!rules) {
    await chrome.storage.sync.set({ rules: DEFAULT_RULES });
  }
});
```

- [ ] **Step 1 : Ajouter l'import de `shouldDiscard`**

Remplacer la 1ʳᵉ ligne `import { nearestChromeGroupColor } from "./colors.js";` par :

```js
import { nearestChromeGroupColor } from "./colors.js";
import { shouldDiscard } from "./discard.js";
```

- [ ] **Step 2 : Remplacer le listener `onInstalled` pour poser les défauts + l'alarme**

Remplacer le bloc `chrome.runtime.onInstalled.addListener(...)` ci-dessus par :

```js
const DISCARD_ALARM = "colortab-discard";

function ensureDiscardAlarm() {
  chrome.alarms.create(DISCARD_ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get([
    "rules",
    "autoDiscard",
    "discardMinutes",
  ]);
  const defaults = {};
  if (!stored.rules) defaults.rules = DEFAULT_RULES;
  if (stored.autoDiscard === undefined) defaults.autoDiscard = true;
  if (stored.discardMinutes === undefined) defaults.discardMinutes = 5;
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.sync.set(defaults);
  }
  ensureDiscardAlarm();
});

chrome.runtime.onStartup.addListener(ensureDiscardAlarm);
```

- [ ] **Step 3 : Ajouter le handler d'alarme + le balayage à la fin du fichier**

Ajouter à la toute fin de `background/background.js` :

```js
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== DISCARD_ALARM) return;
  await discardInactiveTabs();
});

async function discardInactiveTabs() {
  const { autoDiscard, discardMinutes } = await chrome.storage.sync.get([
    "autoDiscard",
    "discardMinutes",
  ]);
  if (autoDiscard === false) return; // undefined = activé par défaut

  const thresholdMs = (discardMinutes || 5) * 60 * 1000;
  const now = Date.now();
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!shouldDiscard(tab, now, thresholdMs)) continue;
    try {
      await chrome.tabs.discard(tab.id);
    } catch {
      // Page non « discardable » (chrome://, nouvel onglet…) ou onglet en
      // transition → ignorer.
    }
  }
}
```

- [ ] **Step 4 : Vérifier la syntaxe (module ES)**

Run: `node --input-type=module --check < background/background.js && echo OK`
Expected: affiche `OK`.

- [ ] **Step 5 : Checkpoint manuel dans Chrome**

1. `chrome://extensions` → recharger ColorTab (aucune erreur rouge ; la permission `alarms` est demandée).
2. Ouvrir la console du service worker.
3. Pour tester vite sans attendre 5 min : dans la console du service worker, exécuter `chrome.storage.sync.set({ discardMinutes: 1 })`, ouvrir 2-3 onglets, en laisser de côté > 1 min.
4. Ouvrir `chrome://discards` → les onglets inactifs doivent apparaître « Discarded » (ou leur icône grisée dans la barre). Cliquer dessus → ils se rechargent.
5. Épingler un onglet inactif → il ne doit **pas** être mis en veille.
6. Remettre `chrome.storage.sync.set({ discardMinutes: 5 })`.

- [ ] **Step 6 : Commit**

```bash
git add background/background.js
git commit -m "feat: auto-discard inactive tabs via alarm"
```

---

### Task 4 : Réglages dans le popup (interrupteur + délai)

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.js`
- Modify: `popup/popup.css`

- [ ] **Step 1 : Ajouter les contrôles dans `popup/popup.html`**

Juste après le bloc existant de l'option « Grouper les onglets par règle » :
```html
  <label class="option-row">
    <input type="checkbox" id="group-tabs">
    <span>Grouper les onglets par règle</span>
  </label>
```
insérer :
```html
  <label class="option-row">
    <input type="checkbox" id="auto-discard">
    <span>Mettre en veille les onglets inactifs</span>
  </label>
  <label class="option-row option-sub">
    <span>après</span>
    <select id="discard-minutes">
      <option value="5">5 min</option>
      <option value="10">10 min</option>
      <option value="15">15 min</option>
      <option value="30">30 min</option>
      <option value="60">60 min</option>
    </select>
  </label>
```

- [ ] **Step 2 : Lire/écrire les réglages dans `popup/popup.js`**

La fonction `init` commence par :
```js
async function init() {
  const data = await chrome.storage.sync.get(["rules", "groupTabs"]);
  rules = data.rules || [];
  renderRules();

  document.getElementById("add-rule").addEventListener("click", addRule);

  const groupToggle = document.getElementById("group-tabs");
  groupToggle.checked = !!data.groupTabs;
  groupToggle.addEventListener("change", (e) => {
    chrome.storage.sync.set({ groupTabs: e.target.checked });
  });
```

Remplacer ce début (jusqu'à et y compris le bloc `groupToggle`) par :
```js
async function init() {
  const data = await chrome.storage.sync.get([
    "rules",
    "groupTabs",
    "autoDiscard",
    "discardMinutes",
  ]);
  rules = data.rules || [];
  renderRules();

  document.getElementById("add-rule").addEventListener("click", addRule);

  const groupToggle = document.getElementById("group-tabs");
  groupToggle.checked = !!data.groupTabs;
  groupToggle.addEventListener("change", (e) => {
    chrome.storage.sync.set({ groupTabs: e.target.checked });
  });

  const autoDiscard = document.getElementById("auto-discard");
  autoDiscard.checked = data.autoDiscard !== false; // activé par défaut
  autoDiscard.addEventListener("change", (e) => {
    chrome.storage.sync.set({ autoDiscard: e.target.checked });
  });

  const discardMinutes = document.getElementById("discard-minutes");
  discardMinutes.value = String(data.discardMinutes || 5);
  discardMinutes.addEventListener("change", (e) => {
    chrome.storage.sync.set({ discardMinutes: parseInt(e.target.value, 10) });
  });
```

Laisser le reste de `init` (le filet de sécurité `visibilitychange` / `pagehide`) inchangé.

- [ ] **Step 3 : Styler le menu déroulant dans `popup/popup.css`**

Ajouter à la fin de `popup/popup.css` :
```css
.option-sub {
  margin-top: 8px;
  margin-left: 30px;
  font-size: 14px;
  color: var(--text-muted);
}

.option-sub select {
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 8px;
  font-size: 14px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  outline: none;
}

.option-sub select:focus {
  border-color: var(--accent);
}
```

- [ ] **Step 4 : Vérifier la syntaxe de `popup.js`**

Run: `node --check popup/popup.js && echo OK`
Expected: affiche `OK`.

- [ ] **Step 5 : Checkpoint manuel dans Chrome**

1. Recharger ColorTab, ouvrir le popup.
2. L'interrupteur « Mettre en veille les onglets inactifs » est **coché** par défaut ; le délai affiche **5 min**.
3. Décocher → ré-ouvrir le popup → l'état décoché est conservé, et plus aucune mise en veille ne se produit.
4. Recocher, changer le délai à 10 min → ré-ouvrir → la valeur 10 min est conservée.

- [ ] **Step 6 : Commit**

```bash
git add popup/popup.html popup/popup.js popup/popup.css
git commit -m "feat: popup controls for auto-discard"
```

---

## Auto-revue du plan

**Couverture de la spec :**
- Mise en veille via `chrome.tabs.discard` au-delà du délai → Task 1 (décision) + Task 3 (action). ✅
- Détection via `tab.lastAccessed` → `shouldDiscard` (Task 1). ✅
- Vérif périodique `chrome.alarms` (1 min) → Task 3. ✅
- Exclusions actif / épinglé / déjà en veille / lastAccessed absent → Task 1. ✅
- Portée = tous les onglets → `chrome.tabs.query({})` sans filtre (Task 3). ✅
- Réglages `autoDiscard` (défaut true) + `discardMinutes` (défaut 5) → Task 3 (defaults) + Task 4 (popup). ✅
- Permission `alarms` → Task 2. ✅
- Échecs de discard ignorés (try/catch) → Task 3. ✅

**Scan placeholders :** aucun TBD/TODO ; tout le code est complet.

**Cohérence des types :** `shouldDiscard(tab, now, thresholdMs)`, `DISCARD_ALARM`, `ensureDiscardAlarm`, `discardInactiveTabs`, clés `autoDiscard`/`discardMinutes` — nommage cohérent entre les tâches et identique côté popup et background.
