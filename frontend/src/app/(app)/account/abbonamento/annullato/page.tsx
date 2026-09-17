import Link from "next/link";

/** Ritorno da Checkout annullato (§3.1). */
export default function AnnullatoPage() {
  return (
    <div className="empty">
      <h1 className="t-titolo">Pagamento non completato.</h1>
      <p className="t-voce">Sei ancora Base, non è cambiato niente.</p>
      <Link href="/oggi" className="btn btn-secondary">
        Torna a Oggi
      </Link>
    </div>
  );
}
