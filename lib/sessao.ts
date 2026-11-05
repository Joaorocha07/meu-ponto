import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import type { Jornada } from "./saldo";
import type { Credenciais } from "./secullum";

// A API não tem token, então a senha precisa ser reenviada a cada consulta. Ela fica apenas neste
// cookie criptografado (httpOnly): não há banco de dados e o navegador não consegue lê-la.

export type Sessao = {
  cred: Credenciais;
  primeiroNome: string;
  jornada: Jornada | null;
  funcionarioId?: number; // Ausente em sessões criadas antes da tela de perfil.
};

const COOKIE_SESSAO = "ponto_sessao";
const COOKIE_DISPOSITIVO = "ponto_dispositivo";
const COOKIE_LEMBRAR = "ponto_lembrar";
const SESSAO_SEGUNDOS = 7 * 24 * 60 * 60; // Novo login a cada 7 dias também atualiza a jornada.
const DISPOSITIVO_SEGUNDOS = 400 * 24 * 60 * 60;
const LEMBRAR_SEGUNDOS = 90 * 24 * 60 * 60; // Renovado a cada login com a opção marcada.

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres");
  }
  return createHash("sha256").update(segredo).digest();
}

/** Falha antes do login: sem a chave, a credencial seria enviada à Secullum à toa. */
export function exigirChaveSessao(): void {
  chave();
}

const opcoesCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function salvarSessao(sessao: Sessao): Promise<void> {
  const token = await new EncryptJWT({ s: sessao })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSAO_SEGUNDOS}s`)
    .encrypt(chave());
  (await cookies()).set(COOKIE_SESSAO, token, opcoesCookie(SESSAO_SEGUNDOS));
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, chave());
    return payload.s as Sessao;
  } catch {
    return null;
  }
}

export async function apagarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}

/**
 * "Salvar usuário e senha": cookie próprio, criptografado e httpOnly, que sobrevive ao logout.
 * A senha nunca volta para o navegador em texto: a página recebe só usuário e tipo.
 */
export async function salvarCredenciais(cred: Credenciais): Promise<void> {
  const token = await new EncryptJWT({ c: cred })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${LEMBRAR_SEGUNDOS}s`)
    .encrypt(chave());
  (await cookies()).set(COOKIE_LEMBRAR, token, opcoesCookie(LEMBRAR_SEGUNDOS));
}

export async function lerCredenciaisSalvas(): Promise<Credenciais | null> {
  const token = (await cookies()).get(COOKIE_LEMBRAR)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, chave());
    return payload.c as Credenciais;
  } catch {
    return null;
  }
}

export async function apagarCredenciaisSalvas(): Promise<void> {
  (await cookies()).delete(COOKIE_LEMBRAR);
}

/**
 * Reaproveita o mesmo ID por navegador, como faz o site oficial. Ele sobrevive ao logout para o
 * mesmo aparelho não aparecer como dispositivo novo. 16 bytes em base64url dão os 22 caracteres.
 */
export async function obterDispositivo(): Promise<string> {
  const loja = await cookies();
  const atual = loja.get(COOKIE_DISPOSITIVO)?.value;
  if (atual && /^[\w-]{22}$/.test(atual)) return atual;
  const novo = randomBytes(16).toString("base64url");
  loja.set(COOKIE_DISPOSITIVO, novo, opcoesCookie(DISPOSITIVO_SEGUNDOS));
  return novo;
}
