import { describe, expect, it } from "vitest";
import { calcularCompensacao, diasComSaldo, saldoParaProximoMes } from "./compensacao";
import type { DiaCalculado, Resumo, StatusDia } from "./saldo";

describe("calcularCompensacao", () => {
  it("abate as horas a mais do mês passado do negativo deste mês", () => {
    // Fez +3h em outubro e ficou −4h10 em novembro.
    expect(calcularCompensacao(180, -250)).toEqual({
      anteriorMinutos: 180,
      atualMinutos: -250,
      compensadoMinutos: 180,
      faltaMinutos: 0,
      saldoMinutos: -70,
    });
  });

  it("deixa em falta o que o mês ainda não pagou", () => {
    expect(calcularCompensacao(300, -250)).toMatchObject({ compensadoMinutos: 250, faltaMinutos: 50, saldoMinutos: 0 });
  });

  it("paga com horas a mais uma dívida do mês passado", () => {
    expect(calcularCompensacao(-60, 90)).toMatchObject({ compensadoMinutos: 60, faltaMinutos: 0, saldoMinutos: 30 });
    expect(calcularCompensacao(-90, 60)).toMatchObject({ compensadoMinutos: 60, faltaMinutos: -30, saldoMinutos: 0 });
  });

  it("não abate meses com o mesmo sinal", () => {
    expect(calcularCompensacao(120, 60)).toMatchObject({ compensadoMinutos: 0, faltaMinutos: 120, saldoMinutos: 60 });
    expect(calcularCompensacao(-120, -60)).toMatchObject({ compensadoMinutos: 0, faltaMinutos: -120, saldoMinutos: -60 });
  });

  it("zera exatamente quando os saldos são iguais", () => {
    expect(calcularCompensacao(90, -90)).toMatchObject({ compensadoMinutos: 90, faltaMinutos: 0, saldoMinutos: 0 });
  });

  it("sem saldo em um dos meses, não há o que abater", () => {
    expect(calcularCompensacao(0, -90)).toMatchObject({ compensadoMinutos: 0, faltaMinutos: 0, saldoMinutos: -90 });
    expect(calcularCompensacao(90, 0)).toMatchObject({ compensadoMinutos: 0, faltaMinutos: 90, saldoMinutos: 0 });
  });

  it("o mês seguinte herda só o que sobrou deste mês", () => {
    // Setembro +3h paga parte de outubro −4h10; novembro herda −1h10.
    const outubro = calcularCompensacao(180, -250);
    expect(calcularCompensacao(outubro.saldoMinutos, 100)).toMatchObject({ anteriorMinutos: -70, compensadoMinutos: 70, saldoMinutos: 30 });
  });
});

describe("diasComSaldo", () => {
  const dia = (data: string, saldoMinutos: number | null, status: StatusDia): DiaCalculado => ({
    data,
    marcacoes: [],
    rotulo: null,
    status,
    saldoMinutos,
    trabalhadoMinutos: null,
    motivo: null,
  });

  it("mantém só os dias que entram no saldo, do mais antigo ao mais recente", () => {
    const resumo = {
      dias: [
        dia("2026-11-05", null, "a_conferir"),
        dia("2026-11-04", -54, "estimado"),
        dia("2026-11-03", 0, "confirmado"),
        dia("2026-11-02", 0, "feriado"),
        dia("2026-10-28", 54, "confirmado"),
      ],
    } as Resumo;
    expect(diasComSaldo(resumo).map((d) => d.data)).toEqual(["2026-10-28", "2026-11-04"]);
  });
});

describe("saldoParaProximoMes", () => {
  it("sem registro, o saldo do mês anterior não muda a conta", () => {
    expect(saldoParaProximoMes(330, -469, false)).toBe(-469);
  });

  it("com registro, abate sinais contrários", () => {
    expect(saldoParaProximoMes(330, -469, true)).toBe(-139);
    expect(saldoParaProximoMes(-60, 90, true)).toBe(30);
  });

  it("com registro e mesmo sinal, não soma nem abate", () => {
    expect(saldoParaProximoMes(120, 60, true)).toBe(60);
    expect(saldoParaProximoMes(-120, -60, true)).toBe(-60);
  });

  it("a sobra do mês anterior não passa adiante", () => {
    expect(saldoParaProximoMes(330, -60, true)).toBe(0);
  });
});
