import { CalendarCheck, Eye, Scale } from "lucide-react";
import { IconeFundoPreto, Marca } from "./marca";

const DESTAQUES = [
  { Icone: Scale, texto: "Saldo do mês sempre à mão" },
  { Icone: CalendarCheck, texto: "Dias incompletos sinalizados" },
  { Icone: Eye, texto: "Só leitura: nunca registra ponto" },
];

/** Painel lateral das telas sem login. */
export function LadoAuth() {
  return (
    <aside className="auth-side">
      <IconeFundoPreto className="art" />
      <Marca className="marca-grande" />
      <div className="auth-side-texto">
        <h2>Seu saldo de horas, sem surpresa no fim do mês.</h2>
        <p>Veja em segundos se você está devendo ou com horas a mais, a partir do seu cartão ponto.</p>
        <ul>
          {DESTAQUES.map(({ Icone, texto }) => (
            <li key={texto}><span><Icone size={15} aria-hidden="true" /></span>{texto}</li>
          ))}
        </ul>
      </div>
      <small className="auth-legal">App não oficial, sem ligação com a Secullum.</small>
    </aside>
  );
}
