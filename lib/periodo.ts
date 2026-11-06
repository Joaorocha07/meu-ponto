export function hojeIso(agora = new Date()): string {
  const timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(agora);
}

export function saudacao(agora = new Date()): string {
  const timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(agora));
  if (hora < 12) return "Bom dia";
  return hora < 18 ? "Boa tarde" : "Boa noite";
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Ex.: { semana: "qua", data: "04/11" } */
export function partesData(iso: string): { semana: string; data: string } {
  const [a, m, d] = iso.split("-").map(Number);
  return {
    semana: SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()],
    data: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
  };
}

const NOMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Ex.: "2026-10" vira "outubro". */
export function nomeMes(mes: string): string {
  return NOMES[Number(mes.slice(5, 7)) - 1];
}

export type Periodo = {
  mes: string;
  rotulo: string;
  /** O ciclo completo, mesmo em andamento. Ex.: "21/10 a 20/11". */
  intervalo: string;
  inicio: string;
  fim: string;
  /** Dia em que o período fecha, mesmo que ainda não tenha chegado. */
  fechamento: string;
  anterior: string;
  proximo: string | null;
};

/** O ponto da empresa fecha neste dia: cada período vai do dia seguinte do mês anterior até ele. */
const DIA_FECHAMENTO = 20;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

function deslocar(ano: number, mes: number, delta: number): string {
  const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`;
}

/** Mês em que o período de `hoje` fecha: depois do fechamento, os dias já contam para o mês seguinte. */
export function mesDoPeriodo(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return deslocar(ano, mes, dia > DIA_FECHAMENTO ? 1 : 0);
}

/**
 * Interpreta ?mes=AAAA-MM, o mês em que o período fecha: "2026-11" vai de 21/10 a 20/11.
 * Valor inválido ou futuro cai no período atual; o fim nunca passa de hoje.
 */
export function resolverPeriodo(parametro: string | undefined, hoje: string): Periodo {
  const mesAtual = mesDoPeriodo(hoje);
  const valido = !!parametro && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametro) && parametro <= mesAtual;
  const mes = valido ? parametro : mesAtual;
  const [ano, numero] = mes.split("-").map(Number);
  const anterior = deslocar(ano, numero, -1);
  const inicio = `${anterior}-${doisDigitos(DIA_FECHAMENTO + 1)}`;
  const fechamento = `${mes}-${doisDigitos(DIA_FECHAMENTO)}`;
  return {
    mes,
    rotulo: `${NOMES[numero - 1]} de ${ano}`,
    intervalo: `${partesData(inicio).data} a ${partesData(fechamento).data}`,
    inicio,
    fim: fechamento < hoje ? fechamento : hoje,
    fechamento,
    anterior,
    proximo: mes < mesAtual ? deslocar(ano, numero, 1) : null,
  };
}
