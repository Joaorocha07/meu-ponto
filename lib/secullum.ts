import "server-only";
import type { DiaApi } from "./saldo";

// Cliente da API interna (não oficial). Só leitura: nunca registra nem altera ponto.
// Nada aqui pode registrar credenciais ou respostas em log.

export type Credenciais = { usuario: string; senha: string; tipo: 0 | 1 };

export type ErroKind = "credenciais" | "indisponivel" | "formato" | "api";

export class SecullumError extends Error {
  constructor(
    readonly kind: ErroKind,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "SecullumError";
  }
}

function baseUrl(): string {
  const base = (process.env.SECULLUM_BASE_URL ?? "https://pontowebapp.secullum.com.br").replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && !base.startsWith("https://") && !base.startsWith("http://localhost")) {
    throw new Error("SECULLUM_BASE_URL precisa usar https em produção");
  }
  const banco = process.env.SECULLUM_BANCO;
  if (!banco) throw new Error("SECULLUM_BANCO não configurado");
  return `${base}/${encodeURIComponent(banco)}`;
}

async function chamar(caminho: string, cred: Credenciais, init: RequestInit = {}): Promise<Response> {
  const auth = Buffer.from(`${cred.usuario}:${cred.senha}:${cred.tipo}`, "utf8").toString("base64");
  // Fora do try: erro de configuração não pode parecer falha de rede.
  const url = `${baseUrl()}${caminho}`;
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Basic ${auth}`,
        "x-sec-centralfuncionarioversao": process.env.SECULLUM_VERSAO ?? "1.45.0",
        "Accept-Language": "pt",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...init.headers,
      },
    });
  } catch {
    throw new SecullumError("indisponivel", "Não foi possível falar com a Secullum.");
  }
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    throw new SecullumError("formato", "A Secullum devolveu uma resposta inesperada.");
  }
}

function checarStatus(resposta: Response, ehLogin = false): void {
  if (resposta.ok) return;
  if (resposta.status >= 500 || resposta.status === 429) {
    throw new SecullumError("indisponivel", "A Secullum está indisponível no momento.");
  }
  // Fora do login, só 401 e 403 indicam senha errada: um 404 não pode encerrar a sessão.
  if (ehLogin || resposta.status === 401 || resposta.status === 403) {
    throw new SecullumError("credenciais", "Usuário ou senha inválidos.");
  }
  throw new SecullumError("api", "A Secullum não aceitou esta consulta.");
}

export type Perfil = { id: number; nome: string; itensHorario: unknown };

/** Chamar só na tela de login, uma vez: tentativas repetidas podem bloquear a conta. */
export async function login(cred: Credenciais, dispositivo: string): Promise<Perfil> {
  const resposta = await chamar("/Login", cred, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: cred.usuario,
      senha: cred.senha,
      plataformaLogin: 1,
      identificacaoDispositivo: dispositivo,
      UsuarioAutenticacao: cred.tipo,
    }),
  });
  checarStatus(resposta, true);
  const corpo = (await lerJson(resposta)) as {
    id?: unknown;
    nome?: unknown;
    dadosHorario?: { itens?: unknown };
  } | null;
  if (typeof corpo?.id !== "number") {
    throw new SecullumError("formato", "A Secullum devolveu um perfil inesperado.");
  }
  return {
    id: corpo.id,
    nome: typeof corpo.nome === "string" ? corpo.nome : "",
    itensHorario: corpo.dadosHorario?.itens,
  };
}

async function buscarJson(caminho: string, cred: Credenciais): Promise<unknown> {
  const resposta = await chamar(caminho, cred);
  checarStatus(resposta);
  return lerJson(resposta);
}

/** Mesmos dados do login, sem registrar um novo login. Quem chama decide o que pode ser exibido. */
export function buscarFuncionario(cred: Credenciais, id: number): Promise<unknown> {
  return buscarJson(`/Funcionarios/${id}`, cred);
}

/** Dados cadastrais extras, incluindo a foto em base64 e campos sensíveis. Nunca repassar direto. */
export function buscarDadosAdicionais(cred: Credenciais, id: number): Promise<unknown> {
  return buscarJson(`/Funcionarios/DadosAdicionais/${id}`, cred);
}

function validarLista(lista: unknown): DiaApi[] {
  const valido =
    Array.isArray(lista) &&
    lista.every(
      (d) =>
        typeof d?.data === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(d.data) &&
        Array.isArray(d.batidas) &&
        d.batidas.every((b: { nome?: unknown; valor?: unknown }) => typeof b?.nome === "string" && "valor" in b),
    );
  if (!valido) throw new SecullumError("formato", "O formato do cartão ponto mudou.");
  // Mantém só o necessário: geolocalização e nome do funcionário não seguem adiante.
  return (lista as DiaApi[]).map((d) => ({
    data: d.data,
    batidas: d.batidas.map((b) => ({ nome: b.nome, valor: b.valor })),
    saldo: d.saldo,
    situacao: d.situacao,
    feriado: d.feriado,
  }));
}

export async function buscarBatidas(cred: Credenciais, inicio: string, fim: string): Promise<DiaApi[]> {
  const resposta = await chamar(`/Batidas/${inicio}/${fim}`, cred);
  checarStatus(resposta);
  const corpo = (await lerJson(resposta)) as { erros?: unknown; lista?: unknown } | null;
  if (Array.isArray(corpo?.erros) && corpo.erros.length > 0) {
    throw new SecullumError("api", "A Secullum informou erro neste período. Confira no site oficial.");
  }
  return validarLista(corpo?.lista);
}
