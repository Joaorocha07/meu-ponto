import { CalendarCheck } from "lucide-react";
import { SeletorMes } from "@/components/seletor-mes";
import { carregarMes, CLASSE_STATUS, ROTULO_STATUS } from "@/lib/dados";
import { partesData } from "@/lib/periodo";
import { classeSaldo, formatarSaldo, type DiaCalculado } from "@/lib/saldo";

export const dynamic = "force-dynamic";

function textoSaldo(dia: DiaCalculado): string {
  if (dia.saldoMinutos === null) return "—";
  if (dia.status === "folga" || dia.status === "feriado") return "—";
  return formatarSaldo(dia.saldoMinutos);
}

export default async function Cartao({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const { mes } = await searchParams;
  const { periodo, resumo, erro } = await carregarMes(mes);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cartão ponto</h1>
          {resumo && <p>Saldo do período: <strong className={`saldo-periodo ${classeSaldo(resumo.saldoMinutos)}`}>{formatarSaldo(resumo.saldoMinutos)}</strong></p>}
        </div>
      </div>

      <SeletorMes periodo={periodo} caminho="/cartao" />

      {erro && <p className="card card-pad" role="alert">{erro} Tente novamente em instantes.</p>}

      {resumo && (
        <section className="card tabela-caixa">
          {resumo.dias.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><CalendarCheck size={22} aria-hidden="true" /></div>
              <h3>Nenhum registro</h3>
              <p>Não há marcações neste período.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Marcações</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="numero">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {resumo.dias.map((dia) => {
                  const { semana, data } = partesData(dia.data);
                  // O selo de situação já diz que é folga ou feriado.
                  const semJornada = dia.status === "folga" || dia.status === "feriado";
                  return (
                    <tr key={dia.data}>
                      <td className="celula-data">{semana}, {data}</td>
                      <td className="celula-marcas">
                        {semJornada ? null : dia.marcacoes.join(" · ") || dia.rotulo || "Sem marcações"}
                        {dia.motivo && <small>{dia.motivo}</small>}
                      </td>
                      <td className="celula-status">
                        <span className={`badge ${CLASSE_STATUS[dia.status]}`}>{ROTULO_STATUS[dia.status]}</span>
                      </td>
                      <td className={`numero celula-saldo ${semJornada ? "saldo-neutro" : classeSaldo(dia.saldoMinutos)}`}>{textoSaldo(dia)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <p className="rodape">App não oficial. O saldo considera o período do dia 21 ao dia 20, e o cartão ponto da empresa é o que vale.</p>
    </>
  );
}
