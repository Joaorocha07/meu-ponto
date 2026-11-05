import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { nomeMes, type Periodo } from "@/lib/periodo";

/** Abas de mês: anterior, atual e próximo, quando existir. */
export function SeletorMes({ periodo, caminho }: { periodo: Periodo; caminho: string }) {
  return (
    <nav className="tabs" aria-label="Escolher mês">
      <Link className="mes-anterior" href={`${caminho}?mes=${periodo.anterior}`}>
        <ChevronLeft size={16} aria-hidden="true" />{nomeMes(periodo.anterior)}
      </Link>
      <span className="on" aria-current="date">{periodo.rotulo}</span>
      {periodo.proximo && (
        <Link className="mes-proximo" href={`${caminho}?mes=${periodo.proximo}`}>
          {nomeMes(periodo.proximo)}<ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
