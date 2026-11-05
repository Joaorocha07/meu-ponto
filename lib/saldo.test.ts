import { describe, expect, it } from "vitest";
import {
  calcularResumo,
  classeSaldo,
  extrairJornada,
  formatarSaldo,
  jornadaConfiavel,
  parseSaldo,
  type DiaApi,
  type Jornada,
} from "./saldo";

const util = { entrada1: "08:00", saida1: "11:00", entrada2: "12:00", saida2: "17:00" };
const itens = [
  { diaSemana: 0 },
  { diaSemana: 1, ...util },
  { diaSemana: 2, ...util },
  { diaSemana: 3, ...util },
  { diaSemana: 4, ...util },
  { diaSemana: 5, ...util },
  { diaSemana: 6 },
];
const jornada = extrairJornada(itens) as Jornada;
const HOJE = "2026-11-05";

function dia(data: string, valores: string[], extra: Partial<DiaApi> = {}): DiaApi {
  return {
    data: `${data}T00:00:00`,
    batidas: valores.map((valor, i) => ({ nome: `Coluna ${i}`, valor })),
    saldo: "+00:00",
    situacao: 0,
    feriado: false,
    ...extra,
  };
}

// Exemplo real resumido na seção 4.3 do PDF.
const exemploPdf = [
  dia("2026-10-22", ["08:24", "11:44", "12:44", "17:47"], { saldo: "+00:23" }),
  dia("2026-10-24", ["FOLGA", "FOLGA", "FOLGA", "FOLGA"]),
  dia("2026-10-28", ["08:34", "11:55", "12:57", "18:30"], { saldo: "+00:54" }),
  dia("2026-10-30", ["08:19", "12:09", "", ""], { situacao: 1 }),
  dia("2026-11-02", ["Feriado", "Feriado", "Feriado", "Feriado"], { feriado: true }),
  dia("2026-11-04", ["08:47", "12:27", "13:27", "16:53"], { situacao: 1 }),
];

const statusDe = (data: string, resumo = calcularResumo(exemploPdf, jornada, HOJE)) =>
  resumo.dias.find((d) => d.data === data);

describe("extrairJornada", () => {
  it("calcula minutos e marcações por dia a partir dos horários", () => {
    expect(jornada[3]).toEqual({ minutos: 480, marcacoes: 4 });
    expect(jornada[0]).toEqual({ minutos: 0, marcacoes: 0 });
  });

  it("recusa dados sem diaSemana", () => {
    expect(extrairJornada([{ ...util }])).toBeNull();
    expect(extrairJornada(undefined)).toBeNull();
  });
});

describe("exemplo do PDF", () => {
  it("usa o saldo do servidor em dias processados", () => {
    expect(statusDe("2026-10-22")).toMatchObject({ status: "confirmado", saldoMinutos: 23 });
    expect(statusDe("2026-10-28")).toMatchObject({ status: "confirmado", saldoMinutos: 54 });
  });

  it("calcula o déficit de 04/11 que o servidor mostra como +00:00", () => {
    expect(statusDe("2026-11-04")).toMatchObject({ status: "estimado", saldoMinutos: -54 });
  });

  it("não considera 30/10, com só 2 marcações, como dia completo", () => {
    expect(statusDe("2026-10-30")).toMatchObject({ status: "incompleto", saldoMinutos: null });
  });

  it("não cobra jornada em folga e feriado", () => {
    expect(statusDe("2026-10-24")).toMatchObject({ status: "folga", saldoMinutos: 0 });
    expect(statusDe("2026-11-02")).toMatchObject({ status: "feriado", saldoMinutos: 0 });
  });

  it("soma o período e conta as pendências", () => {
    expect(calcularResumo(exemploPdf, jornada, HOJE)).toMatchObject({
      confirmadoMinutos: 77,
      estimadoMinutos: -54,
      saldoMinutos: 23,
      pendentes: 1,
    });
  });
});

describe("casos que não podem gerar dívida falsa", () => {
  const umDia = (d: DiaApi, hoje = HOJE) => calcularResumo([d], jornada, hoje).dias[0];

  it("deixa lançamento desconhecido e não processado como a conferir", () => {
    const d = umDia(dia("2026-11-03", ["ATESTADO", "ATESTADO", "", ""], { situacao: 1 }));
    expect(d).toMatchObject({ status: "a_conferir", saldoMinutos: null });
  });

  it("aceita lançamento desconhecido já processado", () => {
    const d = umDia(dia("2026-11-03", ["ABONO", "ABONO", "", ""], { situacao: 0 }));
    expect(d).toMatchObject({ status: "confirmado", saldoMinutos: 0, rotulo: "ABONO" });
  });

  it("não assume falta em dia útil sem marcações", () => {
    const d = umDia(dia("2026-11-03", ["", "", "", ""], { situacao: 1 }));
    expect(d).toMatchObject({ status: "a_conferir", saldoMinutos: null });
  });

  it("aceita falta quando o servidor já processou o déficit", () => {
    const d = umDia(dia("2026-11-03", ["", "", "", ""], { saldo: "-08:00" }));
    expect(d).toMatchObject({ status: "confirmado", saldoMinutos: -480 });
  });

  it("não cobra o dia de hoje enquanto faltam marcações", () => {
    const d = umDia(dia(HOJE, ["08:00", "11:00", "", ""], { situacao: 1 }));
    expect(d).toMatchObject({ status: "em_andamento", saldoMinutos: null });
  });

  it("conta o dia de hoje quando já está completo", () => {
    const d = umDia(dia(HOJE, ["08:00", "11:00", "12:00", "17:30"], { situacao: 1 }));
    expect(d).toMatchObject({ status: "estimado", saldoMinutos: 30 });
  });

  it("ignora datas futuras", () => {
    expect(calcularResumo([dia("2026-11-06", ["", ""])], jornada, HOJE).dias).toHaveLength(0);
  });

  it("deixa virada de noite como a conferir", () => {
    const d = umDia(dia("2026-11-03", ["22:00", "06:00", "", ""], { situacao: 1 }));
    expect(d.saldoMinutos).toBeNull();
  });

  it("deixa número ímpar de marcações como incompleto, mesmo processado", () => {
    const d = umDia(dia("2026-11-03", ["08:00", "", "", ""], { saldo: "-08:00" }));
    expect(d.status).toBe("incompleto");
  });
});

describe("jornadaConfiavel", () => {
  // 0 = segunda em vez de domingo: quinta (4) cairia em "sexta" e sábado seria dia útil.
  const trocada = extrairJornada([
    { diaSemana: 0, ...util },
    { diaSemana: 1, ...util },
    { diaSemana: 2 },
    { diaSemana: 3 },
    { diaSemana: 4 },
    { diaSemana: 5 },
    { diaSemana: 6 },
  ]) as Jornada;

  it("aceita a jornada que bate com os dias processados", () => {
    expect(jornadaConfiavel(jornada, exemploPdf)).toBe(true);
  });

  it("detecta jornada que contradiz o servidor e não estima dívida", () => {
    expect(jornadaConfiavel(trocada, exemploPdf)).toBe(false);
    const d = calcularResumo(exemploPdf, trocada, HOJE).dias.find((x) => x.data === "2026-11-04");
    expect(d).toMatchObject({ status: "a_conferir", saldoMinutos: null });
  });

  it("sem jornada, não estima nada", () => {
    const resumo = calcularResumo(exemploPdf, null, HOJE);
    expect(resumo.estimadoMinutos).toBe(0);
    expect(resumo.confirmadoMinutos).toBe(77);
  });
});

describe("classeSaldo", () => {
  it("separa negativo, positivo e neutro", () => {
    expect(classeSaldo(-1)).toBe("saldo-negativo");
    expect(classeSaldo(1)).toBe("saldo-positivo");
    expect(classeSaldo(0)).toBe("saldo-neutro");
    expect(classeSaldo(null)).toBe("saldo-neutro");
  });
});

describe("formatos", () => {
  it("interpreta e formata saldos", () => {
    expect(parseSaldo("+00:23")).toBe(23);
    expect(parseSaldo("-01:05")).toBe(-65);
    expect(parseSaldo("")).toBeNull();
    expect(formatarSaldo(-54)).toBe("−00:54");
    expect(formatarSaldo(0)).toBe("+00:00");
  });
});
