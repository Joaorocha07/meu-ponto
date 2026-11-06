import { describe, expect, it } from "vitest";
import { detalharBatidas, marcarForaDoHabitual, type BatidaBruta } from "./batidas";

const LOCAL = { latitude: -18.9186, longitude: -48.2772, precisao: 10, endereco: "Rua 02", dataHora: "2026-10-22T08:24:35" };
const batida = (extra: Partial<BatidaBruta> = {}): BatidaBruta => ({
  nome: "Entrada 1",
  valor: "08:24",
  valorOriginal: "08:24",
  ehRepP: true,
  geolocalizacao: LOCAL,
  ...extra,
});

describe("detalharBatidas", () => {
  it("lê horário com segundos e endereço de uma marcação normal", () => {
    expect(detalharBatidas([batida()])[0]).toMatchObject({
      horarioExato: "08:24:35",
      endereco: "Rua 02",
      original: null,
      incluida: false,
      semRepP: false,
    });
  });

  it("mostra o valor original quando a marcação foi alterada", () => {
    expect(detalharBatidas([batida({ valor: "08:00" })])[0]).toMatchObject({ valor: "08:00", original: "08:24" });
  });

  it("reconhece marcação sem original e sem registro REP-P", () => {
    expect(detalharBatidas([batida({ valorOriginal: null, ehRepP: false })])[0]).toMatchObject({ incluida: true, semRepP: true });
  });

  it("não chama de incluída quando a API não manda o campo", () => {
    expect(detalharBatidas([{ nome: "Entrada 1", valor: "08:24" }])[0]).toMatchObject({ incluida: false, semRepP: false, original: null });
  });

  it("não mostra alerta em lançamentos como FOLGA nem em colunas vazias", () => {
    expect(detalharBatidas([batida({ valor: "", valorOriginal: null, ehRepP: false })])).toEqual([]);
    expect(detalharBatidas([batida({ valor: "FOLGA", valorOriginal: "FOLGA", ehRepP: false })])[0]).toMatchObject({ incluida: false, semRepP: false });
  });

  it("trata 0, 0 como sem localização", () => {
    expect(detalharBatidas([batida({ geolocalizacao: { latitude: 0, longitude: 0 } })])[0].coordenadas).toBeNull();
  });

  it("ignora localização em formato inesperado", () => {
    expect(detalharBatidas([batida({ geolocalizacao: { latitude: "x", longitude: null, endereco: 5, dataHora: 1 } })])[0]).toMatchObject({
      coordenadas: null,
      endereco: null,
      horarioExato: null,
    });
  });
});

describe("marcarForaDoHabitual", () => {
  const LONGE = { ...LOCAL, latitude: -18.8, longitude: -48.1 };
  const marcadas = (locais: BatidaBruta["geolocalizacao"][]) => {
    const lista = detalharBatidas(locais.map((geolocalizacao) => batida({ geolocalizacao })));
    marcarForaDoHabitual(lista);
    return lista.map((b) => b.foraDoHabitual);
  };

  it("marca só a batida longe do local da maioria", () => {
    expect(marcadas([LOCAL, LOCAL, LOCAL, LOCAL, LOCAL, LONGE])).toEqual([false, false, false, false, false, true]);
  });

  it("não marca nada com poucas marcações", () => {
    expect(marcadas([LOCAL, LOCAL, LONGE])).toEqual([false, false, false]);
  });

  it("não marca nada sem uma maioria clara", () => {
    expect(marcadas([LOCAL, LOCAL, LOCAL, LONGE, LONGE, LONGE])).toEqual([false, false, false, false, false, false]);
  });

  it("não acusa uma batida com precisão ruim", () => {
    expect(marcadas([LOCAL, LOCAL, LOCAL, LOCAL, LOCAL, { ...LONGE, precisao: 900 }]).at(-1)).toBe(false);
  });
});
