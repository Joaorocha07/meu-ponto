"use server";

import { redirect } from "next/navigation";
import { extrairJornada } from "@/lib/saldo";
import { login, SecullumError, type Credenciais } from "@/lib/secullum";
import {
  apagarCredenciaisSalvas,
  apagarSessao,
  exigirChaveSessao,
  lerCredenciaisSalvas,
  obterDispositivo,
  salvarCredenciais,
  salvarSessao,
} from "@/lib/sessao";

// Devolve usuário e tipo porque o React limpa o formulário após a ação. A senha nunca volta.
export type EstadoLogin = {
  erro: string | null;
  usuario: string;
  tipo: "0" | "1";
  lembrar: boolean;
  /** De quem é a senha salva neste aparelho. A senha em si nunca vem para o navegador. */
  salvoPara: { usuario: string; tipo: "0" | "1" } | null;
};

// Evita que erros de digitação (ou alguém mal-intencionado) bloqueiem a conta na Secullum.
// Fica em memória, por instância do servidor: é uma proteção básica, não um limite global.
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const falhas = new Map<string, { total: number; expira: number }>();

function bloqueado(usuario: string, agora: number): boolean {
  const registro = falhas.get(usuario);
  if (registro && registro.expira <= agora) falhas.delete(usuario);
  return (falhas.get(usuario)?.total ?? 0) >= MAX_FALHAS;
}

function registrarFalha(usuario: string, agora: number): void {
  for (const [chave, registro] of falhas) {
    if (registro.expira <= agora) falhas.delete(chave);
  }
  const total = (falhas.get(usuario)?.total ?? 0) + 1;
  falhas.set(usuario, { total, expira: agora + JANELA_MS });
}

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  exigirChaveSessao();
  // Passa pela mesma ação do login para o formulário não perder o estado ao recarregar.
  if (form.get("acao") === "esquecer") {
    await apagarCredenciaisSalvas();
    return { erro: null, usuario: "", tipo: "0", lembrar: false, salvoPara: null };
  }

  const usuario = String(form.get("usuario") ?? "").trim();
  const senhaDigitada = String(form.get("senha") ?? "");
  const tipo: Credenciais["tipo"] = form.get("tipo") === "1" ? 1 : 0;
  const lembrar = form.get("lembrar") === "on";

  // A senha salva só vale para o mesmo usuário e tipo. Uma senha digitada tem prioridade.
  const salvas = await lerCredenciaisSalvas();
  const temSalva = salvas?.usuario === usuario && salvas.tipo === tipo;
  const usaSalva = temSalva && !senhaDigitada;
  const senha = usaSalva ? salvas.senha : senhaDigitada;

  const salvoPara = salvas ? { usuario: salvas.usuario, tipo: salvas.tipo === 1 ? ("1" as const) : ("0" as const) } : null;
  const falhar = (erro: string, dono = salvoPara): EstadoLogin => ({
    erro,
    usuario: usuario.slice(0, 64),
    tipo: tipo === 1 ? "1" : "0",
    lembrar,
    salvoPara: dono,
  });

  if (!usuario || !senha || usuario.length > 64 || senha.length > 128) {
    return falhar("Preencha usuário e senha.");
  }

  const agora = Date.now();
  if (bloqueado(usuario, agora)) {
    return falhar("Muitas tentativas. Para não bloquear sua conta, aguarde 15 minutos.");
  }

  const cred: Credenciais = { usuario, senha, tipo };
  try {
    const perfil = await login(cred, await obterDispositivo());
    falhas.delete(usuario);
    await salvarSessao({
      cred,
      primeiroNome: perfil.nome.trim().split(/\s+/)[0] ?? "",
      jornada: extrairJornada(perfil.itensHorario),
      funcionarioId: perfil.id,
    });
    if (lembrar) await salvarCredenciais(cred);
    else await apagarCredenciaisSalvas();
  } catch (e) {
    if (!(e instanceof SecullumError)) throw e;
    if (e.kind === "credenciais") {
      registrarFalha(usuario, agora);
      // Apaga a senha salva que falhou: reenviá-la a cada acesso poderia bloquear a conta.
      if (usaSalva) {
        await apagarCredenciaisSalvas();
        return falhar("A senha salva não funciona mais. Digite sua senha atual.", null);
      }
    }
    return falhar(e.message);
  }
  redirect("/");
}

export async function sair(): Promise<void> {
  await apagarSessao();
  redirect("/login");
}
