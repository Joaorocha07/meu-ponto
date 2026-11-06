import { ArrowRight, CalendarCheck, CheckCheck, CircleAlert, History, Scale } from "lucide-react";
import type { ComponentType } from "react";
import { BotaoCompensar, BotaoDesfazer } from "@/components/compensar-mes";
import { SeletorMes } from "@/components/seletor-mes";
import { diasComSaldo, saldoParaProximoMes } from "@/lib/compensacao";
import { carregarCompensacao, CLASSE_STATUS, ROTULO_STATUS } from "@/lib/dados";
import { partesData } from "@/lib/periodo";
import type { RegistroCompensacao } from "@/lib/registros";
import { classeSaldo, formatarDuracao, formatarSaldo } from "@/lib/saldo";

export const dynamic = "force-dynamic";

function dataCurta(iso: string): string {
  const { semana, data } = partesData(iso);
  return `${semana}, ${data}`;
}

function fraseSituacao(saldo: number, registro: RegistroCompensacao | null, intervalo: string, limite: string, emAberto: boolean): string {
  if (registro) return `Saldo de ${intervalo} compensado em ${dataCurta(registro.data)}`;
  if (saldo === 0) return `Não há saldo de ${intervalo} para compensar`;
  if (!emAberto) return `O saldo de ${intervalo} ficou sem registro de compensação`;
  return `Falta compensar ${formatarSaldo(saldo)} de ${intervalo} até ${limite}`;
}

export default async function PaginaCompensacao({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const { mes } = await searchParams;
  const { periodo, periodoAnterior, anterior, atual, saldoAnteriorMinutos, registroAnterior, registroAtual, podeRegistrar, erro, mesAtual } =
    await carregarCompensacao(mes);
  const origem = periodoAnterior.intervalo;
  const limite = partesData(periodo.fechamento).data;
  const pendentes = (anterior?.pendentes ?? 0) + (atual?.pendentes ?? 0);

  // A lista traz os dias com saldo e, mesmo sem saldo, o dia em que a pessoa compensou.
  const comSaldo = new Set(atual ? diasComSaldo(atual).map((d) => d.data) : []);
  const dias = [...(atual?.dias ?? [])].reverse().filter((d) => comSaldo.has(d.data) || d.data === registroAnterior?.data);

  const metricas: { rotulo: string; valor: string; dica: string; Icone: ComponentType<{ size?: number }>; classe?: string }[] = atual
    ? [
        {
          rotulo: `Saldo de ${origem}`,
          valor: formatarSaldo(saldoAnteriorMinutos),
          dica: registroAnterior ? `Compensado em ${dataCurta(registroAnterior.data)}` : "Sem registro de compensação",
          Icone: History,
          classe: classeSaldo(saldoAnteriorMinutos),
        },
        {
          rotulo: `Saldo de ${periodo.intervalo}`,
          valor: formatarSaldo(atual.saldoMinutos),
          dica: registroAtual ? `Compensado em ${dataCurta(registroAtual.data)}` : "Positivo e negativo somados",
          Icone: Scale,
          classe: classeSaldo(atual.saldoMinutos),
        },
        {
          rotulo: "Compensado",
          valor: formatarDuracao(registroAnterior ? Math.abs(saldoAnteriorMinutos) : 0),
          dica: registroAnterior ? `Em ${dataCurta(registroAnterior.data)}` : "Nada registrado neste período",
          Icone: CheckCheck,
        },
        {
          rotulo: "Vai para o próximo mês",
          valor: formatarSaldo(saldoParaProximoMes(saldoAnteriorMinutos, atual.saldoMinutos, !!registroAnterior)),
          dica: registroAnterior ? "Depois de compensar" : "Sem contar o saldo anterior",
          Icone: ArrowRight,
          classe: classeSaldo(saldoParaProximoMes(saldoAnteriorMinutos, atual.saldoMinutos, !!registroAnterior)),
        },
      ]
    : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compensação de horas</h1>
          {atual ? (
            <p><strong>{fraseSituacao(saldoAnteriorMinutos, registroAnterior, origem, limite, mesAtual)}</strong>.</p>
          ) : (
            <p>O saldo de {origem} é compensado entre {periodo.intervalo}.</p>
          )}
        </div>
      </div>

      <SeletorMes periodo={periodo} caminho="/compensacao" />

      {erro && <p className="card card-pad" role="alert">{erro} Tente novamente em instantes.</p>}

      {atual && pendentes > 0 && (
        <div className="card convite" role="status">
          <span className="metric-icon"><CircleAlert size={18} aria-hidden="true" /></span>
          <div>
            <strong>{pendentes === 1 ? "1 dia está fora da conta" : `${pendentes} dias estão fora da conta`}</strong>
            <small>Eles aguardam conferência no cartão ponto e podem mudar este resultado.</small>
          </div>
        </div>
      )}

      {atual && (
        <>
          <section className="card card-pad compensar-mes">
            <div>
              <h2>Saldo de {origem}: <span className={classeSaldo(saldoAnteriorMinutos)}>{formatarSaldo(saldoAnteriorMinutos)}</span></h2>
              {registroAnterior ? (
                <p className="muted">Compensado em {dataCurta(registroAnterior.data)}.</p>
              ) : (
                <p className="muted">Registre o dia entre {periodo.intervalo} em que este saldo foi compensado.</p>
              )}
            </div>
            {!podeRegistrar ? (
              <p className="muted">O registro está indisponível agora. Se continuar, saia e entre de novo.</p>
            ) : registroAnterior ? (
              <BotaoDesfazer mes={periodo.mes} />
            ) : saldoAnteriorMinutos !== 0 ? (
              <BotaoCompensar
                mes={periodo.mes}
                saldo={formatarSaldo(saldoAnteriorMinutos)}
                intervaloOrigem={origem}
                intervalo={periodo.intervalo}
                inicio={periodo.inicio}
                fim={periodo.fechamento}
              />
            ) : null}
          </section>

          <div className="metrics">
            {metricas.map(({ rotulo, valor, dica, Icone, classe }) => (
              <div className="card metric" key={rotulo}>
                <div className="metric-top">{rotulo}<span className="metric-icon"><Icone size={17} /></span></div>
                <strong className={classe}>{valor}</strong>
                <small>{dica}</small>
              </div>
            ))}
          </div>

          <section className="card tabela-caixa compensacao-mes">
            <div className="card-head">
              <div>
                <h2>Horários de {periodo.intervalo}</h2>
                <p>Saldo do período: <strong className={classeSaldo(atual.saldoMinutos)}>{formatarSaldo(atual.saldoMinutos)}</strong></p>
              </div>
            </div>
            {dias.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><CalendarCheck size={22} aria-hidden="true" /></div>
                <h3>Nenhum dia com saldo</h3>
                <p>Nenhum dia de {periodo.intervalo} teve horas a mais ou a menos.</p>
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
                  {dias.map((dia) => (
                    <tr key={dia.data}>
                      <td className="celula-data">{dataCurta(dia.data)}</td>
                      <td className="celula-marcas">
                        {dia.marcacoes.join(" · ") || dia.rotulo}
                        {dia.data === registroAnterior?.data && <small className="dia-compensado">Dia da compensação do saldo de {origem}</small>}
                      </td>
                      <td className="celula-status"><span className={`badge ${CLASSE_STATUS[dia.status]}`}>{ROTULO_STATUS[dia.status]}</span></td>
                      <td className={`numero celula-saldo ${dia.saldoMinutos === null ? "" : classeSaldo(dia.saldoMinutos)}`}>
                        {dia.saldoMinutos === null ? "—" : formatarSaldo(dia.saldoMinutos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <p className="rodape">App não oficial. Este registro é seu e fica só neste app: a Secullum e o RH não recebem nada. A compensação vale conforme o combinado com a empresa.</p>
    </>
  );
}
