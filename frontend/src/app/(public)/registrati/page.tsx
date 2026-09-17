import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Fai la tua scheda", robots: { index: false } };

export default function Page() {
  return (
    <div className="auth">
      <div>
        <h1 className="t-titolo">Fai la tua scheda.</h1>
        <p className="t-voce measure-voice">Email, password, una casella. Nome, età e peso non servono al motore: non li chiediamo.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
