import { describe, expect, it } from "vitest";
import {
  alinharJornada,
  calcularResumo,
  classeSaldo,
  extrairJornada,
  formatarSaldo,
  formatarSaldoCurto,
  jornadaConfiavel,
  metaParaZerar,
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

  it("estima como negativo 30/10, que teve só 3h 50min de uma jornada de 8h", () => {
    expect(statusDe("2026-10-30")).toMatchObject({
      status: "estimado",
      saldoMinutos: -250,
      motivo: "Aguardando processamento do RH",
    });
  });

  it("não cobra jornada em folga e feriado", () => {
    expect(statusDe("2026-10-24")).toMatchObject({ status: "folga", saldoMinutos: 0 });
    expect(statusDe("2026-11-02")).toMatchObject({ status: "feriado", saldoMinutos: 0 });
  });

  it("soma o período e conta as pendências", () => {
    expect(calcularResumo(exemploPdf, jornada, HOJE)).toMatchObject({
      confirmadoMinutos: 77,
      estimadoMinutos: -304,
      saldoMinutos: -227,
      pendentes: 0,
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

  it("não transforma em hora extra um dia com marcações e jornada zero", () => {
    const resumo = calcularResumo([dia("2026-10-24", ["08:00", "12:00", "", ""], { situacao: 1 })], jornada, HOJE);
    expect(resumo.dias[0]).toMatchObject({ status: "a_conferir", saldoMinutos: null });
    expect(resumo.saldoMinutos).toBe(0);
  });

  it("estima dia com marcações faltando que o servidor devolveu zerado como processado", () => {
    const d = umDia(dia("2026-11-03", ["08:00", "12:00", "", ""], { situacao: 0 }));
    expect(d).toMatchObject({ status: "estimado", saldoMinutos: -240 });
  });

  it("estima positivo quando passa da jornada", () => {
    const d = umDia(dia("2026-11-03", ["08:00", "11:00", "12:00", "18:00"], { situacao: 1 }));
    expect(d).toMatchObject({ status: "estimado", saldoMinutos: 60 });
  });

  it("mantém o saldo processado de um dia sem jornada", () => {
    const d = umDia(dia("2026-10-24", ["08:00", "12:00"], { saldo: "+04:00" }));
    expect(d).toMatchObject({ status: "confirmado", saldoMinutos: 240 });
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

describe("alinharJornada", () => {
  const comecaNaSegunda = extrairJornada([
    { diaSemana: 0, ...util },
    { diaSemana: 1, ...util },
    { diaSemana: 2, ...util },
    { diaSemana: 3, ...util },
    { diaSemana: 4, entrada1: "08:00", saida1: "12:00" },
    { diaSemana: 5 },
    { diaSemana: 6 },
  ]) as Jornada;

  it("mantém a jornada que já começa no domingo", () => {
    expect(alinharJornada(jornada)).toEqual(jornada);
    expect(alinharJornada(null)).toBeNull();
  });

  it("corrige a lista que começa na segunda", () => {
    const alinhada = alinharJornada(comecaNaSegunda) as Jornada;
    expect(alinhada[1].minutos).toBe(480); // segunda
    expect(alinhada[5].minutos).toBe(240); // sexta
    expect(alinhada[6].minutos).toBe(0); // sábado
    expect(alinhada[0].minutos).toBe(0); // domingo
  });

  it("pode ser reaplicada sem deslocar de novo", () => {
    const alinhada = alinharJornada(comecaNaSegunda);
    expect(alinharJornada(alinhada)).toEqual(alinhada);
  });

  it("calcula a sexta com a jornada de cada usuário", () => {
    const resumo = calcularResumo([dia("2026-10-30", ["08:19", "12:09", "", ""], { situacao: 1 })], comecaNaSegunda, HOJE);
    expect(resumo.dias[0]).toMatchObject({ status: "estimado", saldoMinutos: -10 });
  });

  it("calcula 30/10 como negativo mesmo com a lista começando na segunda", () => {
    const oito = extrairJornada([0, 1, 2, 3, 4].map((d) => ({ diaSemana: d, ...util })).concat(
      [5, 6].map((d) => ({ diaSemana: d })) as never,
    )) as Jornada;
    const resumo = calcularResumo([dia("2026-10-30", ["08:19", "12:09", "", ""], { situacao: 1 })], oito, HOJE);
    expect(resumo.dias[0]).toMatchObject({ status: "estimado", saldoMinutos: -250 });
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
  });

  it("escreve a unidade do saldo", () => {
    expect(formatarSaldo(23)).toBe("+23 min");
    expect(formatarSaldo(-54)).toBe("−54 min");
    expect(formatarSaldo(83)).toBe("+1h 23min");
    expect(formatarSaldo(-83)).toBe("−1h 23min");
    expect(formatarSaldo(480)).toBe("+8h");
    expect(formatarSaldo(0)).toBe("0 min");
  });

  it("encurta o saldo para o gráfico sem perder a unidade", () => {
    expect(formatarSaldoCurto(54)).toBe("+54min");
    expect(formatarSaldoCurto(-83)).toBe("−1h23");
    expect(formatarSaldoCurto(65)).toBe("+1h05");
    expect(formatarSaldoCurto(-480)).toBe("−8h");
    expect(formatarSaldoCurto(0)).toBe("0min");
  });
});

describe("melhorias do cálculo", () => {
  const SEXTA = "2026-11-06";

  it("prevê a saída quando só falta a última marcação", () => {
    const r = calcularResumo([dia(SEXTA, ["08:00", "11:00", "12:04"], { situacao: 1 })], jornada, SEXTA);
    expect(r.dias[0]).toMatchObject({ status: "em_andamento", previsaoSaida: "17:04", motivo: "Para fechar 8h, saia às 17:04" });
  });

  it("não prevê a saída antes do intervalo, que ainda não dá para saber", () => {
    const r = calcularResumo([dia(SEXTA, ["08:00"], { situacao: 1 })], jornada, SEXTA);
    expect(r.dias[0]).toMatchObject({ status: "em_andamento", previsaoSaida: null, motivo: "Dia em andamento" });
  });

  it("zera a estimativa dentro da tolerância, e só nela", () => {
    const comTolerancia = extrairJornada(itens.map((i) => ({ ...i, toleranciaExtra: 5, toleranciaFalta: 10 }))) as Jornada;
    const saldo = (marcas: string[]) =>
      calcularResumo([dia("2026-11-04", marcas, { situacao: 1 })], comTolerancia, HOJE).dias[0].saldoMinutos;
    expect(saldo(["08:00", "11:00", "12:00", "17:05"])).toBe(0);
    expect(saldo(["08:00", "11:00", "12:00", "17:06"])).toBe(6);
    expect(saldo(["08:00", "11:00", "12:00", "16:50"])).toBe(0);
    expect(saldo(["08:00", "11:00", "12:00", "16:49"])).toBe(-11);
  });

  it("ignora tolerância que não parece estar em minutos", () => {
    const estranha = extrairJornada(itens.map((i) => ({ ...i, toleranciaExtra: 480, toleranciaFalta: -5 }))) as Jornada;
    expect(estranha[3]).toEqual({ minutos: 480, marcacoes: 4 });
  });

  it("avisa quantas marcações o dia teve, sem tirar o dia da conta", () => {
    const r = calcularResumo([dia("2026-10-30", ["08:19", "12:09", "", ""], { situacao: 1 })], jornada, HOJE);
    expect(r.dias[0]).toMatchObject({ status: "estimado", saldoMinutos: -250, avisos: ["2 de 4 marcações previstas"] });
    expect(r.pendentes).toBe(0);
  });

  it("avisa registro pendente", () => {
    const r = calcularResumo([dia("2026-11-04", ["08:00", "11:00", "12:00", "17:00"], { registroPendente: true })], jornada, HOJE);
    expect(r.dias[0].avisos).toEqual(["Registro pendente na Secullum"]);
  });

  describe("metaParaZerar", () => {
    const devendo = (hoje: string, lista: DiaApi[]) => calcularResumo(lista, jornada, hoje);

    it("divide o saldo negativo pelos dias com jornada até o fechamento, arredondando para cima", () => {
      // Seg 16/11 a sex 20/11, com hoje fora do saldo: 5 dias.
      const r = devendo("2026-11-16", [dia("2026-11-13", ["08:00", "11:00", "12:00", "16:00"], { saldo: "-01:03" })]);
      expect(metaParaZerar(r, jornada, "2026-11-16", "2026-11-20")).toEqual({ dias: 5, minutosPorDia: 13 });
    });

    it("não conta hoje se ele já entrou no saldo", () => {
      const r = devendo("2026-11-16", [dia("2026-11-16", ["08:00", "11:00", "12:00", "16:00"], { saldo: "-01:00" })]);
      expect(metaParaZerar(r, jornada, "2026-11-16", "2026-11-20")).toEqual({ dias: 4, minutosPorDia: 15 });
    });

    it("não conta sábado e domingo", () => {
      // Sex 13/11 a sex 20/11, sem o fim de semana: 6 dias.
      const r = devendo("2026-11-13", [dia("2026-11-12", ["08:00", "11:00", "12:00", "16:00"], { saldo: "-01:00" })]);
      expect(metaParaZerar(r, jornada, "2026-11-13", "2026-11-20")?.dias).toBe(6);
    });

    it("não tem meta com saldo positivo, sem dias restantes ou com jornada duvidosa", () => {
      const positivo = devendo(HOJE, [dia("2026-11-04", ["08:00", "11:00", "12:00", "18:00"], { saldo: "+01:00" })]);
      expect(metaParaZerar(positivo, jornada, HOJE, "2026-11-20")).toBeNull();
      const noFim = devendo("2026-11-20", [dia("2026-11-20", ["08:00", "11:00", "12:00", "16:00"], { saldo: "-01:00" })]);
      expect(metaParaZerar(noFim, jornada, "2026-11-20", "2026-11-20")).toBeNull();
      const negativo = devendo(HOJE, [dia("2026-11-04", ["08:00", "11:00", "12:00", "16:00"], { saldo: "-01:00" })]);
      expect(metaParaZerar({ ...negativo, jornadaOk: false }, jornada, HOJE, "2026-11-20")).toBeNull();
    });
  });
});
