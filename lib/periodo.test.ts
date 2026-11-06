import { describe, expect, it } from "vitest";
import { mesDoPeriodo, resolverPeriodo } from "./periodo";

describe("mesDoPeriodo", () => {
  it("mantém o mês até o dia do fechamento", () => {
    expect(mesDoPeriodo("2026-11-06")).toBe("2026-11");
    expect(mesDoPeriodo("2026-11-20")).toBe("2026-11");
  });

  it("passa para o mês seguinte depois do fechamento", () => {
    expect(mesDoPeriodo("2026-11-21")).toBe("2026-12");
    expect(mesDoPeriodo("2026-12-21")).toBe("2027-01");
  });
});

describe("resolverPeriodo", () => {
  it("vai do dia 21 do mês anterior até hoje no período em andamento", () => {
    expect(resolverPeriodo(undefined, "2026-11-06")).toEqual({
      mes: "2026-11",
      rotulo: "novembro de 2026",
      intervalo: "21/10 a 20/11",
      inicio: "2026-10-21",
      fim: "2026-11-06",
      fechamento: "2026-11-20",
      anterior: "2026-10",
      proximo: null,
    });
  });

  it("começa um novo período no dia 21", () => {
    const periodo = resolverPeriodo(undefined, "2026-11-21");
    expect(periodo.mes).toBe("2026-12");
    expect(periodo.inicio).toBe("2026-11-21");
    expect(periodo.fim).toBe("2026-11-21");
    expect(periodo.anterior).toBe("2026-11");
  });

  it("fecha no dia 20 os períodos já encerrados", () => {
    const periodo = resolverPeriodo("2026-10", "2026-11-06");
    expect(periodo.inicio).toBe("2026-09-21");
    expect(periodo.fim).toBe("2026-10-20");
    expect(periodo.proximo).toBe("2026-11");
  });

  it("no próprio dia 20 ainda é o período em andamento", () => {
    const periodo = resolverPeriodo(undefined, "2026-11-20");
    expect(periodo.fim).toBe("2026-11-20");
    expect(periodo.proximo).toBeNull();
  });

  it("atravessa a virada do ano", () => {
    const periodo = resolverPeriodo("2027-01", "2027-02-10");
    expect(periodo.inicio).toBe("2026-12-21");
    expect(periodo.fim).toBe("2027-01-20");
    expect(periodo.intervalo).toBe("21/12 a 20/01");
  });

  it("aceita o mês seguinte só quando o período dele já começou", () => {
    expect(resolverPeriodo("2026-12", "2026-11-20").mes).toBe("2026-11");
    expect(resolverPeriodo("2026-12", "2026-11-21").mes).toBe("2026-12");
  });

  it("ignora valor inválido", () => {
    expect(resolverPeriodo("2026-13", "2026-11-06").mes).toBe("2026-11");
    expect(resolverPeriodo("abc", "2026-11-06").mes).toBe("2026-11");
  });
});
