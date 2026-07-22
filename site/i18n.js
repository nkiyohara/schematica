const supportedLocales = ["en", "ja", "es", "zh-CN", "ko", "fr", "de"];
const openGraphLocales = {
  en: "en_US",
  ja: "ja_JP",
  es: "es_ES",
  "zh-CN": "zh_CN",
  ko: "ko_KR",
  fr: "fr_FR",
  de: "de_DE",
};
const localeStorageKey = "schematica-site-locale";
const languageSelect = document.querySelector("#language-select");
const releaseManifestUrl = new URL("release-manifest.json", document.baseURI);
let localeRequestId = 0;
/** @type {Record<string, string>} */
let currentMessages = {};
/** @type {ReleaseInfo | null | undefined} */
let currentRelease;
let releaseLookupFailed = false;

/** @typedef {"mac" | "linux" | "windows"} Platform */
/** @typedef {{ name: string, url: string, size?: number, digest?: string }} ReleaseAsset */
/** @typedef {{ version: string, prerelease: boolean, publishedAt: string, htmlUrl: string, assets: ReleaseAsset[] }} ReleaseInfo */

/** @returns {Platform | undefined} */
function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const navigatorWithUserAgentData =
    /** @type {Navigator & { userAgentData?: { platform?: string } }} */ (navigator);
  const platform = (
    navigatorWithUserAgentData.userAgentData?.platform ??
    navigator.platform ??
    ""
  ).toLowerCase();

  if (/android|iphone|ipad|ipod/.test(userAgent)) return undefined;
  if (platform.includes("mac") || userAgent.includes("mac os")) return "mac";
  if (platform.includes("win") || userAgent.includes("windows")) return "windows";
  if (platform.includes("linux") || userAgent.includes("linux")) return "linux";
  return undefined;
}

const detectedPlatform = detectPlatform();
/** @type {Platform} */
let selectedPlatform = detectedPlatform ?? "mac";

/**
 * @param {string} value
 * @returns {string | undefined}
 */
function normalizeLocale(value) {
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-")
  ) {
    return "zh-CN";
  }

  return supportedLocales.find((locale) => {
    const candidate = locale.toLowerCase();
    return normalized === candidate || normalized.startsWith(`${candidate}-`);
  });
}

/** @returns {string} */
function storedLocale() {
  try {
    return window.localStorage.getItem(localeStorageKey) ?? "";
  } catch {
    return "";
  }
}

/** @returns {string} */
function preferredLocale() {
  const requested = new URL(window.location.href).searchParams.get("lang") ?? "";
  const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language];
  const candidates = [requested, storedLocale(), ...browserLocales];
  return candidates.map(normalizeLocale).find(Boolean) ?? "en";
}

/**
 * @param {string} locale
 * @returns {Promise<Record<string, string>>}
 */
async function loadMessages(locale) {
  const response = await fetch(new URL(`locales/${locale}.json`, document.baseURI));
  if (!response.ok) throw new Error(`Could not load ${locale} translations.`);
  const messages = /** @type {Record<string, string>} */ (await response.json());
  return messages;
}

/**
 * @param {string} locale
 * @param {Record<string, string>} messages
 */
function applyMessages(locale, messages) {
  currentMessages = messages;
  document.documentElement.lang = locale;
  document.title = messages["meta.title"];
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", messages["meta.description"]);
  document
    .querySelector('meta[property="og:title"]')
    ?.setAttribute("content", messages["meta.ogTitle"]);
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute("content", messages["meta.ogDescription"]);
  document
    .querySelector('meta[property="og:image:alt"]')
    ?.setAttribute("content", messages["hero.imageAlt"]);
  document
    .querySelector('meta[property="og:locale"]')
    ?.setAttribute("content", openGraphLocales[locale]);
  document
    .querySelector('meta[name="twitter:title"]')
    ?.setAttribute("content", messages["meta.ogTitle"]);
  document
    .querySelector('meta[name="twitter:description"]')
    ?.setAttribute("content", messages["meta.ogDescription"]);
  document
    .querySelector('meta[name="twitter:image:alt"]')
    ?.setAttribute("content", messages["hero.imageAlt"]);

  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.getAttribute("data-i18n");
    if (key && messages[key]) element.textContent = messages[key];
  }

  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    const key = element.getAttribute("data-i18n-aria-label");
    if (key && messages[key]) element.setAttribute("aria-label", messages[key]);
  }

  for (const element of document.querySelectorAll("[data-i18n-alt]")) {
    const key = element.getAttribute("data-i18n-alt");
    if (key && messages[key]) element.setAttribute("alt", messages[key]);
  }

  renderInstaller();
}

/**
 * @param {string} key
 * @param {Record<string, string>} [values]
 */
function message(key, values = {}) {
  return (currentMessages[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? "");
}

/** @param {Platform} platform */
function platformMessage(platform) {
  return message(`install.${platform === "mac" ? "mac" : platform}`);
}

/** @param {Platform} platform */
function platformAssets(platform) {
  const assets = currentRelease?.assets ?? [];
  if (platform === "mac") return assets.filter((asset) => /\.dmg$/i.test(asset.name));
  if (platform === "linux") {
    return assets.filter((asset) => /\.(AppImage|deb|rpm)$/i.test(asset.name));
  }
  return [];
}

/** @param {Platform} platform */
function preferredAsset(platform) {
  const assets = platformAssets(platform);
  if (platform === "linux") {
    return assets.find((asset) => /\.AppImage$/i.test(asset.name)) ?? assets[0];
  }
  return assets[0];
}

function renderInstaller() {
  if (!Object.keys(currentMessages).length) return;

  const platformKey = selectedPlatform === "mac" ? "mac" : selectedPlatform;
  const platformName = platformMessage(selectedPlatform);
  const detected = document.querySelector("#detected-platform");
  const detectedName = document.querySelector("#detected-platform-name");
  if (detected instanceof HTMLElement) detected.hidden = !detectedPlatform;
  if (detectedName)
    detectedName.textContent = detectedPlatform ? platformMessage(detectedPlatform) : "";

  for (const tab of document.querySelectorAll("[data-platform]")) {
    const active = tab.getAttribute("data-platform") === selectedPlatform;
    tab.setAttribute("aria-selected", String(active));
    if (tab instanceof HTMLButtonElement) tab.tabIndex = active ? 0 : -1;
  }

  const signatureBadge = document.querySelector("#signature-badge");
  const platformTitle = document.querySelector("#platform-title");
  const platformDetails = document.querySelector("#platform-details");
  const platformArchitecture = document.querySelector("#platform-architecture");
  const platformTrust = document.querySelector("#platform-trust");
  const platformSteps = document.querySelector("#platform-steps");
  const platformCaution = document.querySelector("#platform-caution");
  const verificationLink = document.querySelector("#linux-verification-link");
  const linuxCommands = document.querySelector("#linux-package-commands");

  if (signatureBadge) {
    signatureBadge.textContent = message(`install.${platformKey}Status`);
    signatureBadge.classList.toggle("is-trusted", selectedPlatform !== "windows");
    signatureBadge.classList.toggle("is-pending", selectedPlatform === "windows");
  }
  if (platformTitle) platformTitle.textContent = platformName;
  if (platformDetails) {
    platformDetails.setAttribute(
      "aria-labelledby",
      `install-tab-${selectedPlatform} platform-title`,
    );
  }
  if (platformArchitecture) {
    platformArchitecture.textContent = message(`install.${platformKey}Architecture`);
  }
  if (platformTrust) platformTrust.textContent = message(`install.${platformKey}Trust`);
  if (platformSteps) platformSteps.textContent = message(`install.${platformKey}Steps`);
  if (platformCaution) platformCaution.textContent = message(`install.${platformKey}Caution`);
  if (verificationLink instanceof HTMLElement) {
    verificationLink.hidden = selectedPlatform !== "linux";
  }
  if (linuxCommands instanceof HTMLElement) {
    linuxCommands.hidden = selectedPlatform !== "linux";
  }

  const releaseTitle = document.querySelector("#install-release-title");
  const releaseBody = document.querySelector("#install-release-body");
  const primaryAction = document.querySelector("#install-primary-action");
  const assetLinks = document.querySelector("#install-asset-links");
  if (!(primaryAction instanceof HTMLAnchorElement) || !(assetLinks instanceof HTMLElement)) return;

  assetLinks.replaceChildren();
  assetLinks.hidden = true;
  primaryAction.href = "https://github.com/nkiyohara/schematica/releases";
  primaryAction.textContent = message("install.openReleases");

  if (currentRelease === undefined && !releaseLookupFailed) {
    if (releaseTitle) releaseTitle.textContent = message("install.loading");
    if (releaseBody) releaseBody.textContent = message("install.loading");
    return;
  }

  if (releaseLookupFailed) {
    if (releaseTitle) releaseTitle.textContent = message("install.unavailable");
    if (releaseBody) releaseBody.textContent = message("install.unavailable");
    return;
  }

  if (currentRelease === null) {
    if (releaseTitle) releaseTitle.textContent = message("install.noReleaseTitle");
    if (releaseBody) releaseBody.textContent = message("install.noReleaseBody");
    return;
  }

  const version = currentRelease.version;
  const asset = preferredAsset(selectedPlatform);
  if (releaseTitle) releaseTitle.textContent = message("install.releaseTitle", { version });
  if (releaseBody) {
    releaseBody.textContent = asset
      ? message("install.releaseBody")
      : message("install.assetMissing", { version });
  }

  if (asset) {
    primaryAction.href = asset.url;
    primaryAction.textContent = message("install.download", { platform: platformName });
  }

  const assets = platformAssets(selectedPlatform);
  for (const releaseAsset of assets) {
    const link = document.createElement("a");
    link.href = releaseAsset.url;
    link.textContent = releaseAsset.name;
    assetLinks.append(link);
  }
  assetLinks.hidden = assets.length < 2;
}

/** @param {Platform} platform */
function selectPlatform(platform) {
  selectedPlatform = platform;
  renderInstaller();
}

async function loadReleaseManifest() {
  try {
    const response = await fetch(releaseManifestUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load release manifest (${response.status}).`);
    const manifest = await response.json();
    currentRelease = manifest.release ?? null;
  } catch (error) {
    releaseLookupFailed = true;
    console.error(error);
  }
  renderInstaller();
}

/** @param {string} locale */
function applyCanonicalUrl(locale) {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!(canonical instanceof HTMLLinkElement)) return;

  const url = new URL(canonical.href);
  url.hash = "";
  if (locale === "en") url.searchParams.delete("lang");
  else url.searchParams.set("lang", locale);
  canonical.href = url.href;
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", url.href);
}

/**
 * @param {string} locale
 * @param {boolean} [updateAddress]
 */
async function selectLocale(locale, updateAddress = false) {
  const requestId = ++localeRequestId;
  const normalized = normalizeLocale(locale) ?? "en";
  try {
    const messages = await loadMessages(normalized);
    if (requestId !== localeRequestId) return;

    applyMessages(normalized, messages);
    applyCanonicalUrl(normalized);
    if (languageSelect instanceof HTMLSelectElement) languageSelect.value = normalized;

    if (updateAddress) {
      try {
        window.localStorage.setItem(localeStorageKey, normalized);
      } catch {
        // The selected language still applies when storage is unavailable.
      }
    }

    if (updateAddress) {
      const url = new URL(window.location.href);
      if (normalized === "en") url.searchParams.delete("lang");
      else url.searchParams.set("lang", normalized);
      window.history.replaceState({}, "", url);
    }
  } catch (error) {
    if (requestId !== localeRequestId) return;
    console.error(error);
    if (normalized !== "en") await selectLocale("en", updateAddress);
  }
}

languageSelect?.addEventListener("change", (event) => {
  if (event.currentTarget instanceof HTMLSelectElement) {
    void selectLocale(event.currentTarget.value, true);
  }
});

const platformTabs = [...document.querySelectorAll("[data-platform]")];
for (const [index, tab] of platformTabs.entries()) {
  tab.addEventListener("click", () => {
    const platform = tab.getAttribute("data-platform");
    if (platform === "mac" || platform === "linux" || platform === "windows") {
      selectPlatform(platform);
    }
  });
  tab.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % platformTabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + platformTabs.length) % platformTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = platformTabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = platformTabs[nextIndex];
    const platform = next.getAttribute("data-platform");
    if (platform === "mac" || platform === "linux" || platform === "windows") {
      selectPlatform(platform);
      if (next instanceof HTMLButtonElement) next.focus();
    }
  });
}

void selectLocale(preferredLocale()).then(loadReleaseManifest);
