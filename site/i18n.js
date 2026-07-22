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
let localeRequestId = 0;

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

void selectLocale(preferredLocale());
