"use client";

import Link from "next/link";
import { useChatTexts } from "@/lib/hooks/useApi";
import { NoteMark } from "@/components/note/NoteMark";

/** Logotipo fitcoach¹ (§8): testo, non immagine; l'apice è un pulsante fuori dall'<a>. */
export function Logo({ landing, href = "/" }: { landing?: boolean; href?: string }) {
  const { data: texts } = useChatTexts();
  return (
    <span className={`logo${landing ? " logo-landing" : ""}`}>
      <Link href={href}>fitcoach</Link>
      {texts ? <NoteMark note={texts.ai_badge_note} scope="logo" /> : null}
    </span>
  );
}
