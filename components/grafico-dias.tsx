import { partesData } from "@/lib/periodo";
import { formatarSaldo, type DiaCalculado } from "@/lib/saldo";

/**
 * Barras divergentes: a posição e o sinal indicam a polaridade, sem depender de cor.
 * Dias sem saldo aparecem com "—", sem barra, para não parecerem saldo zero.
 */
export function GraficoDias({ dias }: { dias: DiaCalculado[] }) {
  const maior = Math.max(1, ...dias.map((d) => Math.abs(d.saldoMinutos ?? 0)));
  return (
    <div className="bars">
      {dias.map((dia) => {
        const { semana, data } = partesData(dia.data);
        const saldo = dia.saldoMinutos;
        const texto = saldo === null ? "—" : formatarSaldo(saldo);
        const altura = saldo ? `max(6px, ${(Math.abs(saldo) / maior) * 100}%)` : "0";
        return (
          <div className="bar" key={dia.data} title={`${semana}, ${data}: ${saldo === null ? "sem saldo" : texto}`}>
            <b>{texto}</b>
            <div className="bar-area" aria-hidden="true">
              <div className="bar-metade cima">{saldo !== null && saldo > 0 && <i style={{ height: altura }} />}</div>
              <div className="bar-metade baixo">{saldo !== null && saldo < 0 && <i style={{ height: altura }} />}</div>
            </div>
            <span>{semana}<br />{data.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}
