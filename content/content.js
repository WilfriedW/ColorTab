let borders = {};
let badge = null;
let fadeTimeout = null;
let activeColor = null;
let originalFavicon = undefined; // undefined = pas encore capturé
let faviconObserver = null;
let currentFaviconColor = null; // couleur de la pastille actuellement posée

function captureOriginalFavicon() {
  if (originalFavicon !== undefined) return;
  const link = document.querySelector("link[rel~='icon']");
  originalFavicon = link ? link.href : null;
}

function makeFaviconDataUrl(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  // Carré arrondi quasi plein-cadre : un maximum de surface colorée, donc
  // bien plus visible dans la barre d'onglets qu'un petit rond.
  const x = 2, y = 2, w = 60, h = 60, r = 12;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  ctx.fill();
  return canvas.toDataURL("image/png");
}

function setColorFavicon(color) {
  captureOriginalFavicon();
  const existing = document.getElementById("colortab-favicon");
  const foreign = document.querySelectorAll(
    "link[rel~='icon']:not(#colortab-favicon)"
  );
  // Idempotent : si notre pastille de la bonne couleur est déjà posée et qu'aucune
  // icône du site ne traîne, on ne régénère rien (évite le flicker quand le
  // background ré-applique la même couleur à tous les onglets).
  if (existing && foreign.length === 0 && currentFaviconColor === color) {
    return;
  }
  // On déconnecte l'observer pendant nos propres écritures pour ne pas réagir à
  // nos modifications (évite tout ping-pong avec le site).
  if (faviconObserver) faviconObserver.disconnect();
  foreign.forEach((el) => el.remove());
  // Chrome ne rafraîchit pas le favicon de façon fiable si on modifie href en
  // place : on retire l'ancien <link> et on en insère un neuf pour forcer le
  // rechargement (sinon la pastille garde l'ancienne couleur jusqu'au reload).
  if (existing) existing.remove();
  const link = document.createElement("link");
  link.id = "colortab-favicon";
  link.rel = "icon";
  link.href = makeFaviconDataUrl(color);
  (document.head || document.documentElement).appendChild(link);
  currentFaviconColor = color;
  if (faviconObserver && activeColor) {
    const target = document.head || document.documentElement;
    faviconObserver.observe(target, { childList: true, subtree: true });
  }
}

function restoreFavicon() {
  currentFaviconColor = null;
  const our = document.getElementById("colortab-favicon");
  if (our) our.remove();
  if (originalFavicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      (document.head || document.documentElement).appendChild(link);
    }
    link.href = originalFavicon;
  }
}

function startFaviconObserver() {
  if (faviconObserver) return;
  faviconObserver = new MutationObserver(() => {
    if (!activeColor) return;
    const our = document.getElementById("colortab-favicon");
    const others = document.querySelectorAll(
      "link[rel~='icon']:not(#colortab-favicon)"
    );
    // Le site a réinjecté son icône ou supprimé la nôtre → on ré-applique.
    if (!our || others.length > 0) {
      setColorFavicon(activeColor);
    }
  });
  const target = document.head || document.documentElement;
  faviconObserver.observe(target, { childList: true, subtree: true });
}

const SIDES = ["top", "bottom", "left", "right"];

function createBorder(side) {
  const el = document.createElement("div");
  el.id = `colortab-border-${side}`;
  el.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    transition: background-color 0.3s ease !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  `;

  if (side === "top") {
    el.style.cssText += "top:0!important;left:0!important;right:0!important;height:6px!important;width:100%!important;";
  } else if (side === "bottom") {
    el.style.cssText += "bottom:0!important;left:0!important;right:0!important;height:6px!important;width:100%!important;";
  } else if (side === "left") {
    el.style.cssText += "top:0!important;bottom:0!important;left:0!important;width:6px!important;height:100%!important;";
  } else {
    el.style.cssText += "top:0!important;bottom:0!important;right:0!important;width:6px!important;height:100%!important;";
  }

  return el;
}

function ensureElements() {
  const root = document.body || document.documentElement;

  for (const side of SIDES) {
    const id = `colortab-border-${side}`;
    if (!document.getElementById(id)) {
      borders[side] = createBorder(side);
      root.appendChild(borders[side]);
    }
  }

  if (!document.getElementById("colortab-badge")) {
    badge = document.createElement("div");
    badge.id = "colortab-badge";
    badge.style.cssText = `
      position: fixed !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 2147483647 !important;
      padding: 6px 14px !important;
      border-radius: 6px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #fff !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
    `;
    root.appendChild(badge);
  }
}

function applyColor(color, label) {
  ensureElements();

  if (!color) {
    activeColor = null;
    restoreFavicon();
    for (const side of SIDES) {
      if (borders[side]) borders[side].style.backgroundColor = "transparent";
    }
    if (badge) {
      badge.style.opacity = "0";
      badge.textContent = "";
    }
    return;
  }

  activeColor = color;
  setColorFavicon(color);
  startFaviconObserver();

  for (const side of SIDES) {
    if (borders[side]) borders[side].style.setProperty("background-color", color, "important");
  }

  if (label && badge) {
    badge.style.setProperty("background-color", color, "important");
    badge.textContent = label;
    badge.style.setProperty("opacity", "1", "important");
    // Le badge reste affiché en permanence (plus de disparition après 3s).
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "APPLY_COLOR") {
    applyColor(message.color, message.label);
  }
});

function requestColor() {
  try {
    chrome.runtime.sendMessage({ type: "GET_COLOR", url: location.href }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  } catch {
    // Extension context invalidated
  }
}

function initColorTab() {
  ensureElements();
  requestColor();
}

// Run as soon as body is available
if (document.body) {
  initColorTab();
} else {
  const observer = new MutationObserver(() => {
    if (document.body) {
      observer.disconnect();
      initColorTab();
    }
  });
  observer.observe(document.documentElement, { childList: true });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestColor();
  }
});
