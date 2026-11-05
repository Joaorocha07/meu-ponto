import "server-only";
import { redirect } from "next/navigation";
import { hojeIso, resolverPeriodo } from "./periodo";
import { calcularResumo, type Resumo, type StatusDia } from "./saldo";
import { buscarBatidas, SecullumError } from "./secullum";
import { lerSessao } from "./sessao";

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
  folga: "soft plain",
  feriado: "soft plain",
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
  return { sessao, periodo, resumo, erro, mesAtual: periodo.mes === hoje.slice(0, 7) };
}
