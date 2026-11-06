import type { DiaCalculado, Resumo } from "./saldo";

export type Compensacao = {
  /** O que o mês anterior deixou para pagar. */
  anteriorMinutos: number;
  /** Saldo do mês antes de compensar. */
  atualMinutos: number;
  /** Quanto o positivo de um mês abateu do negativo do outro. Nunca é negativo. */
  compensadoMinutos: number;
  /** O que sobrou do mês anterior, com o sinal dele. Zero é o objetivo. */
  faltaMinutos: number;
  /** O que sobrou deste mês, com o sinal dele. É o que o mês seguinte herda. */
  saldoMinutos: number;
};

/**
 * O mês paga o anterior: positivo abate negativo, sem nada para marcar. Sinais iguais não se
 * abatem. A sobra do mês anterior não passa adiante: o mês seguinte herda só `saldoMinutos`.
 */
export function calcularCompensacao(anteriorMinutos: number, atualMinutos: number): Compensacao {
  const compensadoMinutos = anteriorMinutos * atualMinutos < 0 ? Math.min(Math.abs(anteriorMinutos), Math.abs(atualMinutos)) : 0;
  return {
    anteriorMinutos,
    atualMinutos,
    compensadoMinutos,
    faltaMinutos: anteriorMinutos - Math.sign(anteriorMinutos) * compensadoMinutos,
    saldoMinutos: atualMinutos - Math.sign(atualMinutos) * compensadoMinutos,
  };
}

type DiaComSaldo = DiaCalculado & { saldoMinutos: number };

/** Dias que formam o saldo do mês, do mais antigo ao mais recente. */
export function diasComSaldo(resumo: Resumo): DiaComSaldo[] {
  return [...resumo.dias]
    .reverse()
    .filter((d): d is DiaComSaldo => (d.status === "confirmado" || d.status === "estimado") && !!d.saldoMinutos);
}

/** O que passa para o mês seguinte: só um saldo com registro de compensação abate o mês. */
export function saldoParaProximoMes(anteriorMinutos: number, atualMinutos: number, compensado: boolean): number {
  return compensado ? calcularCompensacao(anteriorMinutos, atualMinutos).saldoMinutos : atualMinutos;
}
