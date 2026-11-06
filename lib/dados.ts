import "server-only";
import { redirect } from "next/navigation";
import { calcularCompensacao } from "./compensacao";
import { hojeIso, mesDoPeriodo, resolverPeriodo, type Periodo } from "./periodo";
import { lerRegistros, type RegistroCompensacao } from "./registros";
import { calcularResumo, type Resumo, type StatusDia } from "./saldo";
import { buscarBatidas, SecullumError } from "./secullum";
import { lerSessao, type Sessao } from "./sessao";

export const ROTULO_STATUS: Record<StatusDia, string> = {
  confirmado: "Processado",
  estimado: "Estimado",
  folga: "Folga",
  feriado: "Feriado",
  em_andamento: "Em andamento",
  incompleto: "Incompleto",
  a_conferir: "A conferir",
};

/** Classes de selo do design: sólido chama atenção, tracejado indica algo provisório. */
export const CLASSE_STATUS: Record<StatusDia, string> = {
  confirmado: "",
  estimado: "dashed",
  folga: "plain selo-folga",
  feriado: "plain selo-feriado",
  em_andamento: "dashed",
  incompleto: "solid",
  a_conferir: "solid",
};

/** Sessão, período e saldo de uma tela. Redireciona se não houver sessão ou se a senha mudou. */
export async function carregarMes(mes: string | string[] | undefined) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  const hoje = hojeIso();
  const periodo = resolverPeriodo(typeof mes === "string" ? mes : undefined, hoje);

  let resumo: Resumo | null = null;
  let erro: string | null = null;
  try {
    const lista = await buscarBatidas(sessao.cred, periodo.inicio, periodo.fim);
    resumo = calcularResumo(lista, sessao.jornada, hoje);
  } catch (e) {
    if (!(e instanceof SecullumError)) throw e;
    // Senha trocada: não reenvia a credencial antiga, para não arriscar bloquear a conta.
    if (e.kind === "credenciais") redirect("/sessao-expirada");
    erro = e.message;
  }
  return { sessao, periodo, resumo, erro, mesAtual: periodo.mes === mesDoPeriodo(hoje) };
}

/**
 * Saldo que o período anterior deixou para compensar. Se o mês antes dele foi compensado, só a sobra
 * chega aqui. A conta para aí, para não buscar o histórico inteiro a cada abertura da tela.
 */
export async function saldoDoPeriodoAnterior(sessao: Sessao, periodo: Periodo, compensouMesAntes: boolean, hoje: string) {
  const periodoAnterior = resolverPeriodo(periodo.anterior, hoje);
  const resumoDe = async (p: Periodo) =>
    calcularResumo(await buscarBatidas(sessao.cred, p.inicio, p.fim), sessao.jornada, hoje);

  // Uma chamada de cada vez: com senha errada, a seguinte nem é enviada.
  const anterior = await resumoDe(periodoAnterior);
  if (!compensouMesAntes) return { anterior, saldoMinutos: anterior.saldoMinutos };
  const antes = await resumoDe(resolverPeriodo(periodoAnterior.anterior, hoje));
  return { anterior, saldoMinutos: calcularCompensacao(antes.saldoMinutos, anterior.saldoMinutos).saldoMinutos };
}

/** Período escolhido, o saldo do anterior e os registros de compensação da pessoa. */
export async function carregarCompensacao(mes: string | string[] | undefined) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  const hoje = hojeIso();
  const periodo = resolverPeriodo(typeof mes === "string" ? mes : undefined, hoje);
  const periodoAnterior = resolverPeriodo(periodo.anterior, hoje);

  // O banco fora do ar não pode derrubar a tela: as horas continuam vindo da Secullum.
  let registros: RegistroCompensacao[] = [];
  let podeRegistrar = sessao.funcionarioId !== undefined;
  if (sessao.funcionarioId !== undefined) {
    try {
      registros = await lerRegistros(sessao.funcionarioId, [periodoAnterior.anterior, periodo.anterior, periodo.mes]);
    } catch {
      podeRegistrar = false;
    }
  }
  const registroDe = (m: string) => registros.find((r) => r.mesOrigem === m) ?? null;
  const registroAnterior = registroDe(periodo.anterior);
  const registroAtual = registroDe(periodo.mes);

  let anterior: Resumo | null = null;
  let atual: Resumo | null = null;
  let saldoAnteriorMinutos = 0;
  let erro: string | null = null;
  try {
    ({ anterior, saldoMinutos: saldoAnteriorMinutos } = await saldoDoPeriodoAnterior(sessao, periodo, !!registroDe(periodoAnterior.anterior), hoje));
    atual = calcularResumo(await buscarBatidas(sessao.cred, periodo.inicio, periodo.fim), sessao.jornada, hoje);
  } catch (e) {
    if (!(e instanceof SecullumError)) throw e;
    if (e.kind === "credenciais") redirect("/sessao-expirada");
    erro = e.message;
  }
  return {
    periodo,
    periodoAnterior,
    anterior,
    atual,
    saldoAnteriorMinutos,
    registroAnterior,
    registroAtual,
    podeRegistrar,
    erro,
    mesAtual: periodo.mes === mesDoPeriodo(hoje),
  };
}
