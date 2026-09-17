export const locales = ["en", "pt", "ru"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

/** Map Vercel geo country codes to our supported locales */
export function countryToLocale(country: string): Locale {
  const map: Record<string, Locale> = {
    BR: "pt",
    PT: "pt",
    AO: "pt",
    MZ: "pt",
    CV: "pt",
    GW: "pt",
    TL: "pt",
    ST: "pt",
    RU: "ru",
    BY: "ru",
    KZ: "ru",
    KG: "ru",
    TJ: "ru",
  }
  return map[country.toUpperCase()] ?? "en"
}

/** Parse Accept-Language header to find best matching locale */
export function acceptLanguageToLocale(header: string): Locale {
  const segments = header.split(",").map((s) => s.trim().split(";")[0].trim().toLowerCase())
  for (const seg of segments) {
    if (seg.startsWith("pt")) return "pt"
    if (seg.startsWith("ru")) return "ru"
    if (seg.startsWith("en")) return "en"
  }
  return defaultLocale
}

const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
  pt: () => import("@/dictionaries/pt.json").then((m) => m.default),
  ru: () => import("@/dictionaries/ru.json").then((m) => m.default),
}

export async function getDictionary(locale: string) {
  const loader = dictionaries[locale as Locale]
  if (!loader) return dictionaries.en()
  return loader()
}

/** Full BCP-47 lang tag for the <html> element */
export function localeToHtmlLang(locale: string): string {
  const map: Record<string, string> = { en: "en", pt: "pt-BR", ru: "ru" }
  return map[locale] ?? "en"
}

// Re-export the dictionary type from the English JSON (single source of truth)
import type enDict from "@/dictionaries/en.json"
export type Dictionary = typeof enDict
