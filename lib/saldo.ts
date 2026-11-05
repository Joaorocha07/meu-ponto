// Regras de cálculo do saldo. Módulo puro (sem rede nem segredos) para poder ser testado.

export type JornadaDia = { minutos: number; marcacoes: number };
/** Chave: diaSemana da Secullum. Hipótese: 0 = domingo ... 6 = sábado (ver `jornadaConfiavel`). */
export type Jornada = Record<string, JornadaDia>;

export type BatidaApi = { nome: string; valor: string | null };
export type DiaApi = {
  data: string;
  batidas: BatidaApi[];
  saldo?: string | null;
  situacao?: number;
  feriado?: boolean;
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
};

export type Resumo = {
  dias: DiaCalculado[];
  saldoMinutos: number;
  confirmadoMinutos: number;
  estimadoMinutos: number;
  trabalhadoMinutos: number;
  contabilizados: number;
  pendentes: number;
};

const HHMM = /^\d{2}:\d{2}$/;
const SALDO = /^([+-])(\d{1,3}):(\d{2})$/;
/** Margem para aceitar tolerâncias do RH ao comparar a jornada com o saldo do servidor. */
const MARGEM_JORNADA_MIN = 15;

const paraMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

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
    jornada[item.diaSemana] = { minutos, marcacoes: marcas.length };
  }
  return jornada;
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
    evidencias++;
    const esperado = jornada[diaDaSemana(dataIso(dia))]?.minutos ?? 0;
    if (Math.abs(trabalhado - saldo - esperado) > MARGEM_JORNADA_MIN) divergencias++;
  }
  return evidencias === 0 || divergencias * 2 < evidencias;
}

function classificar(dia: DiaApi, jornada: Jornada | null, confiavel: boolean, hoje: string): DiaCalculado {
  const data = dataIso(dia);
  const marcacoes = marcacoesDe(dia);
  const rotulo = rotuloDe(dia);
  const base = { data, marcacoes, rotulo, trabalhadoMinutos: minutosTrabalhados(marcacoes) };
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
    return r("em_andamento", null, "Dia em andamento");
  }
  if (marcacoes.length % 2 !== 0) return r("incompleto", null, "Número ímpar de marcações");

  if (marcacoes.length === 0 && !rotulo) {
    if (saldoServidor) return r("confirmado", saldoServidor);
    if (dia.situacao === 0 && esperado?.minutos === 0) return r("folga", 0);
    return r("a_conferir", null, "Sem marcações: pode ser falta ou registro não lançado");
  }

  if (dia.situacao === 0 && saldoServidor !== null) {
    // Saldo zerado com marcações faltando é o mesmo sinal enganoso visto em dias não processados.
    // Um lançamento como ABONO explica a falta de marcações.
    if (saldoServidor === 0 && faltamMarcacoes && !rotulo) return r("incompleto", null, "Faltam marcações");
    return r("confirmado", saldoServidor);
  }

  if (rotulo) return r("a_conferir", null, `Lançamento "${rotulo}" ainda não processado`);
  if (!confiavel || !esperado) return r("a_conferir", null, "Jornada do dia não pôde ser confirmada");
  if (faltamMarcacoes) return r("incompleto", null, "Faltam marcações");
  if (trabalhado === null) return r("a_conferir", null, "Marcações fora de ordem");
  return r("estimado", trabalhado - esperado.minutos, "Aguardando processamento do RH");
}

export function calcularResumo(lista: DiaApi[], jornada: Jornada | null, hoje: string): Resumo {
  const passados = lista.filter((d) => dataIso(d) <= hoje);
  const confiavel = jornadaConfiavel(jornada, passados);
  const dias = passados
    .map((d) => classificar(d, jornada, confiavel, hoje))
    .sort((a, b) => b.data.localeCompare(a.data));

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
  };
}

/** Classe de cor do saldo: vermelho se negativo, verde se positivo, cinza se neutro ou sem saldo. */
export function classeSaldo(minutos: number | null): "saldo-negativo" | "saldo-positivo" | "saldo-neutro" {
  if (!minutos) return "saldo-neutro";
  return minutos < 0 ? "saldo-negativo" : "saldo-positivo";
}

/** Ex.: +00:23 e −00:54, com o sinal de menos tipográfico. */
export function formatarSaldo(minutos: number): string {
  const abs = Math.abs(minutos);
  const texto = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${minutos < 0 ? "−" : "+"}${texto}`;
}

/** Ex.: 54 min, 8h ou 1h 23min. */
export function formatarDuracao(minutos: number): string {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
