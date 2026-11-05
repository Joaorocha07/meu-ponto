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
  inicio: string;
  fim: string;
  anterior: string;
  proximo: string | null;
};

const doisDigitos = (n: number) => String(n).padStart(2, "0");

function deslocar(ano: number, mes: number, delta: number): string {
  const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`;
}

/** Interpreta ?mes=AAAA-MM. Valor inválido ou futuro cai no mês atual; o fim nunca passa de hoje. */
export function resolverPeriodo(parametro: string | undefined, hoje: string): Periodo {
  const mesAtual = hoje.slice(0, 7);
  const valido = !!parametro && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametro) && parametro <= mesAtual;
  const mes = valido ? parametro : mesAtual;
  const [ano, numero] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const fimDoMes = `${mes}-${doisDigitos(ultimoDia)}`;
  return {
    mes,
    rotulo: `${NOMES[numero - 1]} de ${ano}`,
    inicio: `${mes}-01`,
    fim: fimDoMes < hoje ? fimDoMes : hoje,
    anterior: deslocar(ano, numero, -1),
    proximo: mes < mesAtual ? deslocar(ano, numero, 1) : null,
  };
}
