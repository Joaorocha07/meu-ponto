import { ArrowRight, CalendarCheck, CalendarDays, CircleAlert, ClipboardList, Clock, Scale } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { GraficoDias } from "@/components/grafico-dias";
import { IconeBoasVindas } from "@/components/marca";
import { SeletorMes } from "@/components/seletor-mes";
import { carregarMes, CLASSE_STATUS, ROTULO_STATUS } from "@/lib/dados";
import { hojeIso, partesData, saudacao } from "@/lib/periodo";
import { classeSaldo, formatarDuracao, formatarSaldo, metaParaZerar, type Resumo } from "@/lib/saldo";

export const dynamic = "force-dynamic";

function fraseSaldo(saldo: number): string {
  if (saldo < 0) return `Você está devendo ${formatarDuracao(saldo)}`;
  if (saldo > 0) return `Você tem ${formatarDuracao(saldo)} a mais`;
  return "Você está em dia";
}

function detalheSaldo(r: Resumo): string {
  if (r.estimadoMinutos === 0) return "Processado pelo RH";
  return `${formatarSaldo(r.confirmadoMinutos)} processado · ${formatarSaldo(r.estimadoMinutos)} estimado`;
}

export default async function Painel({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const { mes } = await searchParams;
  const { sessao, periodo, resumo, erro, mesAtual } = await carregarMes(mes);
  const linkCartao = `/cartao?mes=${periodo.mes}`;
  const pendentes = resumo?.dias.filter((d) => d.status === "incompleto" || d.status === "a_conferir") ?? [];
  const ultimosDias = (resumo?.dias ?? [])
    .filter((d) => d.status !== "folga" && d.status !== "feriado")
    .slice(0, 7)
    .reverse();

  // Previsão e meta só fazem sentido no período em andamento.
  const hoje = hojeIso();
  const diaDeHoje = mesAtual ? resumo?.dias.find((d) => d.data === hoje) : undefined;
  const meta = mesAtual && resumo ? metaParaZerar(resumo, sessao.jornada, hoje, periodo.fechamento) : null;

  const metricas: { rotulo: string; valor: string; dica: string; Icone: ComponentType<{ size?: number }>; classe?: string }[] = resumo
    ? [
        { rotulo: "Saldo do mês", valor: formatarSaldo(resumo.saldoMinutos), dica: detalheSaldo(resumo), Icone: Scale, classe: classeSaldo(resumo.saldoMinutos) },
        { rotulo: "Horas trabalhadas", valor: formatarDuracao(resumo.trabalhadoMinutos), dica: "Nos dias contabilizados", Icone: Clock },
        { rotulo: "Dias contabilizados", valor: String(resumo.contabilizados), dica: periodo.rotulo, Icone: CalendarDays },
        { rotulo: "Para conferir", valor: String(resumo.pendentes), dica: resumo.pendentes === 0 ? "Nenhuma pendência" : "Fora do saldo", Icone: CircleAlert },
      ]
    : [];

  return (
    <>
      <section className="welcome">
        <IconeBoasVindas className="welcome-art" />
        <div className="welcome-texto">
          <div className="eyebrow">{periodo.rotulo}</div>
          <h1>{saudacao()}{sessao.primeiroNome ? `, ${sessao.primeiroNome}` : ""}.</h1>
          <p>
            {resumo ? (
              <>
                <strong className={classeSaldo(resumo.saldoMinutos)}>{fraseSaldo(resumo.saldoMinutos)}</strong> {mesAtual ? "neste período" : `em ${periodo.rotulo}`}.
                {pendentes.length > 0 && " O saldo ainda pode mudar."}
                {meta && ` Para zerar até ${partesData(periodo.fechamento).data}, trabalhe +${formatarDuracao(meta.minutosPorDia)} por dia ${meta.dias === 1 ? "no último dia útil" : `nos ${meta.dias} dias úteis restantes`}, sem contar feriados.`}
              </>
            ) : (
              `${erro} Tente novamente em instantes.`
            )}
          </p>
          <Link className="btn" href={linkCartao}>Ver cartão ponto <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <SeletorMes periodo={periodo} caminho="/" />

      {diaDeHoje?.previsaoSaida && (
        <div className="card convite" role="status">
          <span className="metric-icon"><Clock size={18} aria-hidden="true" /></span>
          <div>
            <strong>{diaDeHoje.motivo}</strong>
            <small>Estimativa pela sua jornada de hoje. Tolerâncias e o processamento do RH podem mudar o resultado.</small>
          </div>
        </div>
      )}

      {resumo && pendentes.length > 0 && (
        <div className="card convite" role="status">
          <span className="metric-icon"><ClipboardList size={18} aria-hidden="true" /></span>
          <div>
            <strong>{pendentes.length === 1 ? "1 dia precisa de conferência" : `${pendentes.length} dias precisam de conferência`}</strong>
            <small>Eles não entram na conta. Uma falta só é somada depois que o RH processa o dia.</small>
          </div>
          <Link className="btn btn-primary btn-sm" href={linkCartao}>Conferir agora <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      )}

      {resumo && (
        <>
          <div className="metrics">
            {metricas.map(({ rotulo, valor, dica, Icone, classe }) => (
              <div className="card metric" key={rotulo}>
                <div className="metric-top">{rotulo}<span className="metric-icon"><Icone size={17} /></span></div>
                <strong className={classe}>{valor}</strong>
                <small>{dica}</small>
              </div>
            ))}
          </div>

          <div className="dash-grid">
            <section className="card">
              <div className="card-head">
                <div><h2>Dias para conferir</h2><p>{periodo.rotulo}</p></div>
                <Link className="btn btn-sm btn-outline hide-mobile" href={linkCartao}>Abrir cartão <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
              <div className="card-lista">
                {pendentes.length > 0 ? (
                  <ul className="timeline">
                    {pendentes.map((dia) => {
                      const { semana, data } = partesData(dia.data);
                      return (
                        <li className="timeline-item" key={dia.data}>
                          <span className="pessoa">
                            <strong>{semana}, {data}</strong>
                            <small>{dia.motivo}</small>
                          </span>
                          <span className={`badge ${CLASSE_STATUS[dia.status]}`}>{ROTULO_STATUS[dia.status]}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="empty">
                    <div className="empty-icon"><CalendarCheck size={22} aria-hidden="true" /></div>
                    <h3>Nada para conferir</h3>
                    <p>Todos os dias deste período entraram na conta.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><div><h2>Últimos dias</h2><p>Saldo por dia, sem folgas e feriados</p></div></div>
              <div className="card-body">
                {ultimosDias.length > 0 ? (
                  <GraficoDias dias={ultimosDias} />
                ) : (
                  <p className="muted">Nenhum dia registrado neste período.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <p className="rodape">App não oficial. O saldo considera o período do dia 21 ao dia 20, e o cartão ponto da empresa é o que vale.</p>
    </>
  );
}
