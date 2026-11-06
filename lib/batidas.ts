// Detalhes de cada marcação: ajuste do RH, origem e local. Módulo puro, para poder ser testado.
// valorOriginal, ehRepP e geolocalizacao vêm do PDF da API e ainda não foram conferidos com dados
// reais, então os textos descrevem o dado sem afirmar quem fez a alteração.

export type GeoApi = { latitude?: unknown; longitude?: unknown; precisao?: unknown; endereco?: unknown; dataHora?: unknown };
export type BatidaBruta = { nome: string; valor: string | null; valorOriginal?: string | null; ehRepP?: boolean; geolocalizacao?: GeoApi | null };

export type BatidaDetalhe = {
  nome: string;
  valor: string;
  /** Horário com segundos, quando a API informa. Ex.: 08:24:35. */
  horarioExato: string | null;
  /** Valor anterior, se a marcação foi alterada. */
  original: string | null;
  /** Há marcação no cartão, mas nenhuma marcação original. */
  incluida: boolean;
  /** A API informou que não veio de um registro REP-P. */
  semRepP: boolean;
  endereco: string | null;
  coordenadas: { latitude: number; longitude: number } | null;
  precisao: number | null;
  foraDoHabitual: boolean;
};

const HHMM = /^\d{2}:\d{2}$/;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function detalharBatidas(batidas: BatidaBruta[]): BatidaDetalhe[] {
  return batidas.flatMap((b) => {
    const valor = texto(b.valor);
    const original = texto(b.valorOriginal);
    if (!valor && !original) return [];
    const geo = b.geolocalizacao;
    const latitude = geo?.latitude;
    const longitude = geo?.longitude;
    // 0, 0 é o que a API manda quando não há localização.
    const temPosicao = typeof latitude === "number" && typeof longitude === "number" && (latitude !== 0 || longitude !== 0);
    return [
      {
        nome: b.nome,
        valor,
        horarioExato: /T(\d{2}:\d{2}:\d{2})/.exec(texto(geo?.dataHora))?.[1] ?? null,
        original: original && original !== valor ? original : null,
        incluida: !original && HHMM.test(valor) && b.valorOriginal !== undefined,
        semRepP: HHMM.test(valor) && b.ehRepP === false,
        endereco: texto(geo?.endereco) || null,
        coordenadas: temPosicao ? { latitude, longitude } : null,
        precisao: typeof geo?.precisao === "number" ? geo.precisao : null,
        foraDoHabitual: false,
      },
    ];
  });
}

function distanciaMetros(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const RAIO_HABITUAL_M = 300;
const LONGE_M = 500;
const MIN_MARCACOES = 6;
const PRECISAO_RUIM_M = 200;

/**
 * Marca as batidas longe do local onde a maioria foi registrada no período. Não há local cadastrado
 * na API: com poucas marcações ou sem maioria clara, nada é marcado, para não acusar sem base.
 */
export function marcarForaDoHabitual(batidas: BatidaDetalhe[]): void {
  const comPosicao = batidas.filter((b) => b.coordenadas);
  if (comPosicao.length < MIN_MARCACOES) return;
  const vizinhos = (b: BatidaDetalhe) => comPosicao.filter((o) => distanciaMetros(b.coordenadas!, o.coordenadas!) <= RAIO_HABITUAL_M).length;
  const contagens = comPosicao.map(vizinhos);
  const maior = Math.max(...contagens);
  if (maior * 2 <= comPosicao.length) return;
  const centro = comPosicao[contagens.indexOf(maior)].coordenadas!;
  for (const b of comPosicao) {
    const precisaoRuim = b.precisao !== null && b.precisao > PRECISAO_RUIM_M;
    b.foraDoHabitual = !precisaoRuim && distanciaMetros(b.coordenadas!, centro) > LONGE_M;
  }
}
