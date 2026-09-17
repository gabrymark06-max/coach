import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account cancellato", robots: { index: false } };

export default function Page() {
  return (
    <div className="auth">
      <h1 className="t-titolo">Account cancellato.</h1>
      <p className="t-voce">I dati sono stati eliminati.</p>
      <Link href="/" className="btn btn-secondary">
        Torna alla home
      </Link>
    </div>
  );
}
