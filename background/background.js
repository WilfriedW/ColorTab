import { nearestChromeGroupColor } from "./colors.js";
import { shouldDiscard } from "./discard.js";

const DEFAULT_RULES = [
  { pattern: "*.service-now.com", color: "#FF8C00", label: "ServiceNow (défaut)" }
];

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

// Filet MV3 : à chaque réveil du service worker, on ré-assure l'alarme si elle a
// disparu (au-delà de onInstalled/onStartup). create() étant idempotent, c'est
// sans risque. Garantit que le balayage ne s'arrête jamais silencieusement.
chrome.alarms.get(DISCARD_ALARM, (existing) => {
  if (!existing) ensureDiscardAlarm();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    await applyColorToTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await applyColorToTab(tab.id, tab.url);
  }
});

async function applyColorToTab(tabId, url) {
  if (!url) return;

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }

  const { rules, groupTabs } = await getSettings();
  const match = findMatchingRule(hostname, rules);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "APPLY_COLOR",
      color: match ? match.color : null,
      label: match ? match.label : null,
    });
  } catch {
    // Content script pas encore chargé, ignorer.
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    await updateTabGroup(tab, match, groupTabs, rules);
  } catch {
    // Onglet inaccessible, ignorer.
  }
}

function findMatchingRule(hostname, rules) {
  let bestMatch = null;
  let bestSpecificity = -1;

  for (const rule of rules) {
    if (matchPattern(hostname, rule.pattern)) {
      const specificity = getSpecificity(rule.pattern);
      if (specificity > bestSpecificity) {
        bestSpecificity = specificity;
        bestMatch = rule;
      }
    }
  }

  return bestMatch;
}

function matchPattern(hostname, pattern) {
  const regex = patternToRegex(pattern);
  return regex.test(hostname);
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (pattern.includes("*")) {
    // Pattern explicite : "*" = un label (sans point), ancré exactement.
    const withWildcard = escaped.replace(/\\\*/g, "[^.]*");
    return new RegExp("^" + withWildcard + "$", "i");
  }
  // Domaine simple (sans "*") : matche le domaine ET tous ses sous-domaines.
  // Ex. "google.com" matche google.com, www.google.com, mail.google.com…
  // mais pas notgoogle.com ni google.com.evil.com.
  return new RegExp("^(?:[^.]+\\.)*" + escaped + "$", "i");
}

function getSpecificity(pattern) {
  // More specific patterns (fewer wildcards, longer) rank higher
  const wildcardCount = (pattern.match(/\*/g) || []).length;
  return pattern.length * 10 - wildcardCount * 100;
}

// Content script requests its color
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "GET_COLOR" && sender.tab) {
    applyColorToTab(sender.tab.id, message.url);
  }
});

// Listen for rule changes to update all open tabs
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.groupTabs && changes.groupTabs.newValue === false) {
    const { rules } = await getSettings();
    await ungroupAllOurGroups(rules);
  }

  if (changes.rules || changes.groupTabs) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        await applyColorToTab(tab.id, tab.url);
      }
    }
  }
});

async function getSettings() {
  const { rules, groupTabs } = await chrome.storage.sync.get([
    "rules",
    "groupTabs",
  ]);
  return { rules: rules || [], groupTabs: !!groupTabs };
}

function groupTitleFor(rule) {
  return rule.label || rule.pattern;
}

async function isOurGroup(groupId, rules) {
  if (groupId === undefined || groupId === -1) return false;
  try {
    const g = await chrome.tabGroups.get(groupId);
    const titles = new Set(rules.map(groupTitleFor));
    return titles.has(g.title);
  } catch {
    return false;
  }
}

async function updateTabGroup(tab, match, groupTabs, rules) {
  try {
    if (groupTabs && match) {
      const title = groupTitleFor(match);
      const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
      const existing = groups.find((g) => g.title === title);
      if (existing) {
        if (tab.groupId !== existing.id) {
          await chrome.tabs.group({ groupId: existing.id, tabIds: tab.id });
        }
      } else {
        const groupId = await chrome.tabs.group({ tabIds: tab.id });
        await chrome.tabGroups.update(groupId, {
          title,
          color: nearestChromeGroupColor(match.color),
        });
      }
    } else if (await isOurGroup(tab.groupId, rules)) {
      // L'onglet ne matche plus (ou groupement désactivé) et il est dans un de
      // NOS groupes → on le sort. On ne touche jamais aux groupes de l'utilisateur.
      await chrome.tabs.ungroup(tab.id);
    }
  } catch {
    // Onglet en cours de fermeture/déplacement → ignorer.
  }
}

async function ungroupAllOurGroups(rules) {
  const titles = new Set(rules.map(groupTitleFor));
  try {
    const groups = await chrome.tabGroups.query({});
    for (const g of groups) {
      if (titles.has(g.title)) {
        const tabs = await chrome.tabs.query({ groupId: g.id });
        if (tabs.length) {
          await chrome.tabs.ungroup(tabs.map((t) => t.id));
        }
      }
    }
  } catch {
    // ignorer
  }
}

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
