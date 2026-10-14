"use client";

import { translateUi } from "@/lib/i18n/translations";
import type { SecondaryLanguageCode } from "@/lib/i18n/secondary-languages";

/**
 * Renders English text with the clinic's chosen secondary-language
 * translation alongside it ("bilingual side-by-side"), when one exists and
 * a secondary language was actually passed in. Falls back to English-only
 * when there's no translation on file for this exact string/language pair.
 */
export function Bilingual({
  text,
  lang,
  className = "text-xs text-muted-foreground",
}: {
  text: string;
  lang?: SecondaryLanguageCode | null;
  className?: string;
}) {
  const translated = translateUi(text, lang);
  if (!translated) return <>{text}</>;
  return (
    <>
      {text}
      <span className={className}> / {translated}</span>
    </>
  );
}
