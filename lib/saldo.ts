// Regras de cálculo do saldo. Módulo puro (sem rede nem segredos) para poder ser testado.
import { detalharBatidas, marcarForaDoHabitual, type BatidaBruta, type BatidaDetalhe } from "./batidas";

export type JornadaDia = { minutos: number; marcacoes: number; toleranciaExtra?: number; toleranciaFalta?: number };
/** Chave: diaSemana da Secullum. Hipótese: 0 = domingo ... 6 = sábado (ver `jornadaConfiavel`). */
export type Jornada = Record<string, JornadaDia>;

export type BatidaApi = BatidaBruta;
export type DiaApi = {
  data: string;
  batidas: BatidaApi[];
  saldo?: string | null;
  situacao?: number;
  feriado?: boolean;
  registroPendente?: boolean;
  /** Nome completo do código do dia, como ABONO, vindo da lista de justificativas da API. */
  justificativa?: string | null;
};

export type StatusDia =
  | "confirmado" // saldo processado pelo servidor
  | "estimado" // calculado aqui: marcações menos jornada
  | "folga"
  | "feriado"
  | "em_andamento"
  | "incompleto"
  | "a_conferir";

export type DiaCalculado = {
  data: string;
  marcacoes: string[];
  rotulo: string | null;
  status: StatusDia;
  saldoMinutos: number | null;
  trabalhadoMinutos: number | null;
  motivo: string | null;
  /** Alertas que não mudam a conta, como menos marcações do que a jornada prevê. */
  avisos: string[];
  justificativa: string | null;
  /** Hoje: a que horas sair para fechar a jornada. Ex.: 17:04. */
  previsaoSaida: string | null;
  batidas: BatidaDetalhe[];
};

export type Resumo = {
  dias: DiaCalculado[];
  saldoMinutos: number;
  confirmadoMinutos: number;
  estimadoMinutos: number;
  trabalhadoMinutos: number;
  contabilizados: number;
  pendentes: number;
  /** A jornada lida combina com os dias já processados. */
  jornadaOk: boolean;
};

const HHMM = /^\d{2}:\d{2}$/;
const SALDO = /^([+-])(\d{1,3}):(\d{2})$/;
/** Margem para aceitar tolerâncias do RH ao comparar a jornada com o saldo do servidor. */
const MARGEM_JORNADA_MIN = 15;

const paraMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const paraHorario = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** Hipótese do PDF: tolerância em minutos. Fora desta faixa, o valor é ignorado por parecer outra coisa. */
const toleranciaValida = (valor: unknown) => (typeof valor === "number" && Number.isInteger(valor) && valor > 0 && valor <= 60 ? valor : null);

export function parseSaldo(valor: string | null | undefined): number | null {
  const m = SALDO.exec((valor ?? "").trim());
  if (!m) return null;
  const total = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -total : total;
}

/** Soma os pares entrada/saída. Retorna null se houver número ímpar ou par invertido (ex.: virada de noite). */
export function minutosTrabalhados(marcacoes: string[]): number | null {
  if (marcacoes.length % 2 !== 0) return null;
  let total = 0;
  for (let i = 0; i < marcacoes.length; i += 2) {
    const duracao = paraMinutos(marcacoes[i + 1]) - paraMinutos(marcacoes[i]);
    if (duracao < 0) return null;
    total += duracao;
  }
  return total;
}

type ItemHorario = Record<string, unknown> & { diaSemana?: unknown };

/** Monta a jornada a partir de entradaN/saidaN, sem depender de `carga`, cujo significado não é confirmado. */
export function extrairJornada(itens: unknown): Jornada | null {
  if (!Array.isArray(itens) || itens.length === 0) return null;
  const jornada: Jornada = {};
  for (const item of itens as ItemHorario[]) {
    if (typeof item?.diaSemana !== "number") return null;
    const marcas: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const entrada = item[`entrada${n}`];
      const saida = item[`saida${n}`];
      if (typeof entrada === "string" && typeof saida === "string" && HHMM.test(entrada) && HHMM.test(saida)) {
        marcas.push(entrada, saida);
      }
    }
    const minutos = minutosTrabalhados(marcas);
    if (minutos === null) return null;
    const toleranciaExtra = toleranciaValida(item.toleranciaExtra);
    const toleranciaFalta = toleranciaValida(item.toleranciaFalta);
    jornada[item.diaSemana] = {
      minutos,
      marcacoes: marcas.length,
      ...(toleranciaExtra && { toleranciaExtra }),
      ...(toleranciaFalta && { toleranciaFalta }),
    };
  }
  return jornada;
}

/**
 * A numeração de diaSemana não é documentada. Devolve a jornada com 0 = domingo: se o item 0 tem horas
 * e o item 6 não, a lista começa na segunda, porque o contrário seria trabalhar domingo e folgar sábado.
 * Pode ser reaplicada, e vale também para sessões criadas antes desta regra.
 */
export function alinharJornada(jornada: Jornada | null): Jornada | null {
  if (!jornada?.[0]?.minutos || !jornada[6] || jornada[6].minutos > 0) return jornada;
  return Object.fromEntries(Object.entries(jornada).map(([dia, valor]) => [(Number(dia) + 1) % 7, valor]));
}

const dataIso = (dia: DiaApi) => dia.data.slice(0, 10);

function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

const marcacoesDe = (dia: DiaApi) =>
  dia.batidas.map((b) => (b.valor ?? "").trim()).filter((v) => HHMM.test(v));
const rotuloDe = (dia: DiaApi) =>
  dia.batidas.map((b) => (b.valor ?? "").trim()).find((v) => v && !HHMM.test(v)) ?? null;

/**
 * O mapeamento de diaSemana não foi confirmado. Compara a jornada com o que o próprio servidor
 * implica nos dias processados (trabalhado - saldo). Se a maioria divergir, a jornada lida está
 * errada e os dias não processados viram "a conferir", em vez de gerar dívida falsa.
 */
export function jornadaConfiavel(jornada: Jornada | null, dias: DiaApi[]): boolean {
  if (!jornada) return false;
  let evidencias = 0;
  let divergencias = 0;
  for (const dia of dias) {
    if (dia.situacao !== 0) continue;
    const trabalhado = minutosTrabalhados(marcacoesDe(dia));
    const saldo = parseSaldo(dia.saldo);
    if (!trabalhado || saldo === null) continue;
    const esperado = jornada[diaDaSemana(dataIso(dia))];
    // Saldo zerado com marcações faltando é um sinal enganoso, não evidência sobre a jornada.
    if (saldo === 0 && esperado && marcacoesDe(dia).length < esperado.marcacoes) continue;
    evidencias++;
    if (Math.abs(trabalhado - saldo - (esperado?.minutos ?? 0)) > MARGEM_JORNADA_MIN) divergencias++;
  }
  return evidencias === 0 || divergencias * 2 < evidencias;
}

/** Diferença dentro da tolerância da jornada não conta como saldo. */
function aplicarTolerancia(saldo: number, jornada: JornadaDia): number {
  if (saldo > 0 && saldo <= (jornada.toleranciaExtra ?? 0)) return 0;
  if (saldo < 0 && -saldo <= (jornada.toleranciaFalta ?? 0)) return 0;
  return saldo;
}

/** Só com a última saída pendente: antes dela, ainda falta um intervalo que não dá para prever. */
function preverSaida(marcacoes: string[], esperado: JornadaDia | null): string | null {
  if (!esperado?.minutos || marcacoes.length % 2 === 0 || marcacoes.length !== esperado.marcacoes - 1) return null;
  const fechados = minutosTrabalhados(marcacoes.slice(0, -1));
  if (fechados === null || fechados >= esperado.minutos) return null;
  const saida = paraMinutos(marcacoes[marcacoes.length - 1]) + esperado.minutos - fechados;
  return saida < 24 * 60 ? paraHorario(saida) : null;
}

function classificar(dia: DiaApi, jornada: Jornada | null, confiavel: boolean, hoje: string): DiaCalculado {
  const data = dataIso(dia);
  const marcacoes = marcacoesDe(dia);
  const rotulo = rotuloDe(dia);
  const previsto = jornada?.[diaDaSemana(data)] ?? null;
  const avisos: string[] = [];
  if (dia.registroPendente) avisos.push("Registro pendente na Secullum");
  if (data !== hoje && previsto && marcacoes.length > 0 && marcacoes.length % 2 === 0 && marcacoes.length < previsto.marcacoes) {
    avisos.push(`${marcacoes.length} de ${previsto.marcacoes} marcações previstas`);
  }
  const base = {
    data,
    marcacoes,
    rotulo,
    trabalhadoMinutos: minutosTrabalhados(marcacoes),
    avisos,
    justificativa: dia.justificativa ?? null,
    previsaoSaida: null,
    batidas: detalharBatidas(dia.batidas),
  };
  const r = (status: StatusDia, saldoMinutos: number | null, motivo: string | null = null): DiaCalculado => ({
    ...base,
    status,
    saldoMinutos,
    motivo,
  });

  const rotuloNorm = rotulo?.toLowerCase();
  if (marcacoes.length === 0 && (dia.feriado || rotuloNorm === "feriado")) return r("feriado", 0);
  if (marcacoes.length === 0 && rotuloNorm === "folga") return r("folga", 0);

  const esperado = jornada?.[diaDaSemana(data)] ?? null;
  const faltamMarcacoes = !!esperado && marcacoes.length < esperado.marcacoes;
  const saldoServidor = parseSaldo(dia.saldo);
  const trabalhado = minutosTrabalhados(marcacoes);

  if (data === hoje && (faltamMarcacoes || !esperado || marcacoes.length % 2 !== 0)) {
    const previsaoSaida = confiavel ? preverSaida(marcacoes, esperado) : null;
    const motivo = previsaoSaida && esperado ? `Para fechar ${formatarDuracao(esperado.minutos)}, saia às ${previsaoSaida}` : "Dia em andamento";
    return { ...r("em_andamento", null, motivo), previsaoSaida };
  }
  if (marcacoes.length % 2 !== 0) return r("incompleto", null, "Número ímpar de marcações");

  if (marcacoes.length === 0 && !rotulo) {
    if (saldoServidor) return r("confirmado", saldoServidor);
    if (dia.situacao === 0 && esperado?.minutos === 0) return r("folga", 0);
    return r("a_conferir", null, "Sem marcações: pode ser falta ou registro não lançado");
  }

  if (dia.situacao === 0 && saldoServidor !== null) {
    // Saldo zerado com marcações faltando é o mesmo sinal enganoso visto em dias não processados, e
    // segue para a estimativa. Um lançamento como ABONO explica a falta de marcações.
    if (saldoServidor !== 0 || !faltamMarcacoes || rotulo) return r("confirmado", saldoServidor);
  }

  if (rotulo) return r("a_conferir", null, `Lançamento "${rotulo}" ainda não processado`);
  // Trabalho em dia sem jornada espera o RH: não dá para distinguir hora extra de jornada lida errada.
  if (!confiavel || !esperado || esperado.minutos === 0) {
    return r("a_conferir", null, "Jornada do dia não pôde ser confirmada");
  }
  if (trabalhado === null) return r("a_conferir", null, "Marcações fora de ordem");
  return r("estimado", aplicarTolerancia(trabalhado - esperado.minutos, esperado), "Aguardando processamento do RH");
}

export function calcularResumo(lista: DiaApi[], jornadaApi: Jornada | null, hoje: string): Resumo {
  const jornada = alinharJornada(jornadaApi);
  const passados = lista.filter((d) => dataIso(d) <= hoje);
  const confiavel = jornadaConfiavel(jornada, passados);
  const dias = passados
    .map((d) => classificar(d, jornada, confiavel, hoje))
    .sort((a, b) => b.data.localeCompare(a.data));
  marcarForaDoHabitual(dias.flatMap((d) => d.batidas));

  const somar = (status: StatusDia) =>
    dias.filter((d) => d.status === status).reduce((soma, d) => soma + (d.saldoMinutos ?? 0), 0);
  const confirmadoMinutos = somar("confirmado");
  const estimadoMinutos = somar("estimado");
  const contabilizadosDias = dias.filter((d) => d.status === "confirmado" || d.status === "estimado");

  return {
    dias,
    confirmadoMinutos,
    estimadoMinutos,
    saldoMinutos: confirmadoMinutos + estimadoMinutos,
    trabalhadoMinutos: contabilizadosDias.reduce((soma, d) => soma + (d.trabalhadoMinutos ?? 0), 0),
    contabilizados: contabilizadosDias.length,
    pendentes: dias.filter((d) => d.status === "incompleto" || d.status === "a_conferir").length,
    jornadaOk: confiavel,
  };
}

export type MetaZerar = { dias: number; minutosPorDia: number };

/**
 * Quanto trabalhar a mais por dia para zerar um saldo negativo até o fechamento. Conta os dias com
 * jornada, incluindo hoje se ele ainda não entrou no saldo. A API não informa feriados futuros.
 */
export function metaParaZerar(resumo: Resumo, jornadaApi: Jornada | null, hoje: string, fechamento: string): MetaZerar | null {
  const jornada = alinharJornada(jornadaApi);
  if (resumo.saldoMinutos >= 0 || !resumo.jornadaOk || !jornada) return null;
  const registroHoje = resumo.dias.find((d) => d.data === hoje);
  const contaHoje = !registroHoje || registroHoje.status === "em_andamento";
  let dias = 0;
  const [a, m, d] = hoje.split("-").map(Number);
  for (let i = contaHoje ? 0 : 1; ; i++) {
    const iso = new Date(Date.UTC(a, m - 1, d + i)).toISOString().slice(0, 10);
    if (iso > fechamento) break;
    if (jornada[diaDaSemana(iso)]?.minutos) dias++;
  }
  return dias === 0 ? null : { dias, minutosPorDia: Math.ceil(-resumo.saldoMinutos / dias) };
}

/** Classe de cor do saldo: vermelho se negativo, verde se positivo, cinza se neutro ou sem saldo. */
export function classeSaldo(minutos: number | null): "saldo-negativo" | "saldo-positivo" | "saldo-neutro" {
  if (!minutos) return "saldo-neutro";
  return minutos < 0 ? "saldo-negativo" : "saldo-positivo";
}

/** Sem sinal no zero. O menos é o tipográfico. */
const sinal = (minutos: number) => (minutos < 0 ? "−" : minutos > 0 ? "+" : "");

/** Ex.: 54 min, 8h ou 1h 23min. */
export function formatarDuracao(minutos: number): string {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Sempre com a unidade, para não confundir horas e minutos. Ex.: +23 min, −1h 23min ou 0 min. */
export function formatarSaldo(minutos: number): string {
  return `${sinal(minutos)}${formatarDuracao(minutos)}`;
}

/** Para espaços estreitos, como as colunas do gráfico. Ex.: +54min, −1h23 ou +8h. */
export function formatarSaldoCurto(minutos: number): string {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sinal(minutos)}${m}min`;
  return `${sinal(minutos)}${h}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}
