"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saldoDoPeriodoAnterior } from "@/lib/dados";
import { hojeIso, resolverPeriodo } from "@/lib/periodo";
import { apagarRegistro, lerRegistros, salvarRegistro } from "@/lib/registros";
import { extrairJornada } from "@/lib/saldo";
import {
  confirmarCodigo,
  enviarCodigo,
  login,
  obterEmailOculto,
  SecullumError,
  trocarSenha,
  type Credenciais,
} from "@/lib/secullum";
import {
  apagarCredenciaisSalvas,
  apagarSessao,
  exigirChaveSessao,
  lerCredenciaisSalvas,
  lerSessao,
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

// Na recuperação de senha: não encher de e-mails a caixa de alguém nem deixar adivinhar e-mail ou código.
const MAX_ENVIOS = 3;
const MAX_DADOS_ERRADOS = 5;
const envios: typeof falhas = new Map();
const dadosErrados: typeof falhas = new Map();

function bloqueado(usuario: string, agora: number, mapa = falhas, maximo = MAX_FALHAS): boolean {
  const registro = mapa.get(usuario);
  if (registro && registro.expira <= agora) mapa.delete(usuario);
  return (mapa.get(usuario)?.total ?? 0) >= maximo;
}

function registrarFalha(usuario: string, agora: number, mapa = falhas): void {
  for (const [chave, registro] of mapa) {
    if (registro.expira <= agora) mapa.delete(chave);
  }
  const total = (mapa.get(usuario)?.total ?? 0) + 1;
  mapa.set(usuario, { total, expira: agora + JANELA_MS });
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

export type EstadoRecuperacao = {
  etapa: "usuario" | "email" | "codigo" | "senha" | "pronto";
  usuario: string;
  tipo: "0" | "1";
  /** Mascarado, como veio da Secullum. Só serve de dica para a pessoa. */
  email: string;
  /** O que a pessoa digitou, para o campo não ficar vazio depois de um erro. */
  emailInformado: string;
  /** Fica no navegador entre os passos 3 e 4, porque a troca de senha pede o mesmo código. */
  codigo: string;
  erro: string | null;
};

const ESPERE = "Muitas tentativas. Aguarde 15 minutos para tentar de novo.";

/** Fluxo "Esqueci minha senha". Um envio por passo; a senha nova nunca volta para o navegador. */
export async function recuperarSenha(anterior: EstadoRecuperacao, form: FormData): Promise<EstadoRecuperacao> {
  const estado = { ...anterior, erro: null };
  const agora = Date.now();
  const conta = { usuario: estado.usuario, tipo: estado.tipo === "1" ? (1 as const) : (0 as const) };
  try {
    if (estado.etapa === "usuario") {
      const usuario = String(form.get("usuario") ?? "").trim();
      const tipo = form.get("tipo") === "1" ? "1" : "0";
      if (!usuario || usuario.length > 64) return { ...estado, tipo, usuario: usuario.slice(0, 64), erro: "Preencha o usuário." };
      const email = await obterEmailOculto({ usuario, tipo: tipo === "1" ? 1 : 0 });
      if (!email) return { ...estado, tipo, usuario, erro: "E-mail não encontrado. Procure o RH da sua empresa." };
      return { ...estado, tipo, usuario, email, etapa: "email" };
    }

    if (estado.etapa === "email") {
      const emailInformado = String(form.get("email") ?? "").trim();
      const comEmail = { ...estado, emailInformado: emailInformado.slice(0, 254) };
      if (!emailInformado || emailInformado.length > 254) return { ...comEmail, erro: "Digite o e-mail completo." };
      if (bloqueado(conta.usuario, agora, envios, MAX_ENVIOS) || bloqueado(conta.usuario, agora, dadosErrados, MAX_DADOS_ERRADOS)) {
        return { ...comEmail, erro: ESPERE };
      }
      try {
        // A Secullum confere se é o e-mail cadastrado. O mascarado do passo 1 é recusado.
        await enviarCodigo(conta, emailInformado);
      } catch (e) {
        if (e instanceof SecullumError && e.kind === "api") registrarFalha(conta.usuario, agora, dadosErrados);
        if (e instanceof SecullumError) return { ...comEmail, erro: e.message };
        throw e;
      }
      registrarFalha(conta.usuario, agora, envios);
      return { ...comEmail, etapa: "codigo" };
    }

    if (estado.etapa === "codigo") {
      if (form.get("acao") === "reenviar") return { ...estado, etapa: "email" };
      const codigo = String(form.get("codigo") ?? "").trim();
      if (!codigo || codigo.length > 32) return { ...estado, erro: "Digite o código recebido por e-mail." };
      if (bloqueado(conta.usuario, agora, dadosErrados, MAX_DADOS_ERRADOS)) return { ...estado, erro: ESPERE };
      try {
        await confirmarCodigo(conta, codigo);
      } catch (e) {
        if (e instanceof SecullumError && e.kind === "api") registrarFalha(conta.usuario, agora, dadosErrados);
        throw e;
      }
      dadosErrados.delete(conta.usuario);
      return { ...estado, codigo, etapa: "senha" };
    }

    if (estado.etapa === "senha") {
      const novaSenha = String(form.get("novaSenha") ?? "");
      if (!novaSenha || novaSenha.length > 128) return { ...estado, erro: "Digite a nova senha, com até 128 caracteres." };
      if (novaSenha !== form.get("confirmarSenha")) return { ...estado, erro: "As senhas não são iguais." };
      await trocarSenha(conta, estado.codigo, novaSenha);

      // A senha antiga parou de valer: mandá-la de novo poderia bloquear a conta.
      falhas.delete(conta.usuario);
      if ((await lerCredenciaisSalvas())?.usuario === conta.usuario) await apagarCredenciaisSalvas();
      if ((await lerSessao())?.cred.usuario === conta.usuario) await apagarSessao();
      return { ...estado, codigo: "", etapa: "pronto" };
    }
    return estado;
  } catch (e) {
    if (!(e instanceof SecullumError)) throw e;
    return { ...estado, erro: e.message };
  }
}

export type EstadoCompensar = { erro: string | null };

const SEM_BANCO = "Não foi possível salvar agora. Tente novamente em instantes.";

/** Registra em que dia o saldo do período anterior foi compensado. O saldo vem da Secullum, nunca do navegador. */
export async function compensarSaldo(_anterior: EstadoCompensar, form: FormData): Promise<EstadoCompensar> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  if (sessao.funcionarioId === undefined) return { erro: "Saia e entre de novo para registrar a compensação." };

  const hoje = hojeIso();
  const mes = String(form.get("mes") ?? "");
  const periodo = resolverPeriodo(mes, hoje);
  if (periodo.mes !== mes) return { erro: "Período inválido. Recarregue a página." };

  const data = String(form.get("data") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < periodo.inicio || data > periodo.fechamento) {
    return { erro: `Escolha um dia de ${periodo.intervalo}.` };
  }

  try {
    const mesAntes = resolverPeriodo(periodo.anterior, hoje).anterior;
    const jaCompensou = (await lerRegistros(sessao.funcionarioId, [mesAntes])).length > 0;
    const { saldoMinutos } = await saldoDoPeriodoAnterior(sessao, periodo, jaCompensou, hoje);
    if (saldoMinutos === 0) return { erro: "Não há saldo para compensar neste período." };
    await salvarRegistro(sessao.funcionarioId, { mesOrigem: periodo.anterior, data, minutos: saldoMinutos });
  } catch (e) {
    if (e instanceof SecullumError) {
      if (e.kind === "credenciais") redirect("/sessao-expirada");
      return { erro: e.message };
    }
    return { erro: SEM_BANCO };
  }
  revalidatePath("/compensacao");
  return { erro: null };
}

export async function desfazerCompensacao(_anterior: EstadoCompensar, form: FormData): Promise<EstadoCompensar> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  if (sessao.funcionarioId === undefined) return { erro: "Saia e entre de novo para alterar a compensação." };

  const mes = String(form.get("mes") ?? "");
  const periodo = resolverPeriodo(mes, hojeIso());
  if (periodo.mes !== mes) return { erro: "Período inválido. Recarregue a página." };

  try {
    await apagarRegistro(sessao.funcionarioId, periodo.anterior);
  } catch {
    return { erro: SEM_BANCO };
  }
  revalidatePath("/compensacao");
  return { erro: null };
}

export async function sair(): Promise<void> {
  await apagarSessao();
  redirect("/login");
}
