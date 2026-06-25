document.addEventListener("DOMContentLoaded", init);

// Source de vérité unique en mémoire : on ne relit jamais le storage entre une
// action utilisateur et son écriture. C'est ce qui éliminait les races
// (écritures perdues, règle supprimée qui ressuscite).
let rules = [];
let saveTimer = null;

async function init() {
  document.getElementById("version").textContent =
    "v" + chrome.runtime.getManifest().version;

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

  // Filet de sécurité : si le popup se ferme alors qu'une écriture est encore en
  // attente (debounce), on la force avant la destruction du contexte.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
  window.addEventListener("pagehide", flushSave);
}

// Regroupe les écritures rapprochées (frappe au clavier, glissé du sélecteur de
// couleur) en une seule, pour rester sous le quota d'écriture de storage.sync.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
}

function flushSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  chrome.storage.sync.set({ rules });
}

function renderRules() {
  const list = document.getElementById("rules-list");
  list.innerHTML = "";

  if (rules.length === 0) {
    list.innerHTML = '<div class="empty-state">Aucune règle configurée.<br>Ajoutez-en une pour commencer.</div>';
    return;
  }

  rules.forEach((rule, index) => {
    const card = document.createElement("div");
    card.className = "rule-card";

    card.innerHTML = `
      <div class="rule-color" style="background: ${escapeHtml(rule.color)}">
        <input type="color" value="${escapeHtml(rule.color)}" data-index="${index}" data-field="color">
      </div>
      <div class="rule-fields">
        <input type="text" value="${escapeHtml(rule.pattern)}" data-index="${index}" data-field="pattern" placeholder="*.service-now.com" spellcheck="false">
        <input type="text" class="label-input" value="${escapeHtml(rule.label || "")}" data-index="${index}" data-field="label" placeholder="Label (optionnel)">
      </div>
      <button class="btn-delete" data-index="${index}" title="Supprimer">&times;</button>
    `;

    list.appendChild(card);
  });

  // Tous les champs (couleur, pattern, label) écrivent en direct depuis l'état
  // en mémoire, via l'événement "input".
  list.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("input", handleFieldChange);
  });

  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", handleDelete);
  });
}

function handleFieldChange(e) {
  const index = parseInt(e.target.dataset.index, 10);
  const field = e.target.dataset.field;
  if (!rules[index]) return;

  rules[index][field] = e.target.value;

  // Met à jour l'aperçu de couleur
  if (field === "color") {
    e.target.parentElement.style.background = e.target.value;
  }

  scheduleSave();
}

function handleDelete(e) {
  const index = parseInt(e.target.dataset.index, 10);
  if (!rules[index]) return;
  rules.splice(index, 1);
  flushSave();
  renderRules();
}

function addRule() {
  rules.push({
    pattern: "",
    color: randomColor(),
    label: ""
  });
  flushSave();
  renderRules();

  // Focus le champ pattern de la nouvelle règle
  const inputs = document.querySelectorAll("input[data-field='pattern']");
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

function randomColor() {
  // Teinte aléatoire sur tout le spectre ; saturation/luminosité fixées dans une
  // plage qui reste vive et bien lisible (pastille, liseré, badge).
  const hue = Math.floor(Math.random() * 360);
  const sat = 65 + Math.floor(Math.random() * 20); // 65–85 %
  const light = 45 + Math.floor(Math.random() * 10); // 45–55 %
  return hslToHex(hue, sat, light);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;");
}
