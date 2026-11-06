"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { recuperarSenha, type EstadoRecuperacao } from "../acoes";

const INICIAL: EstadoRecuperacao = { etapa: "usuario", usuario: "", tipo: "0", email: "", emailInformado: "", codigo: "", erro: null };

const TEXTOS: Record<EstadoRecuperacao["etapa"], { titulo: string; sub?: string; botao: string }> = {
  usuario: { titulo: "Recuperar senha", sub: "Vamos enviar um código para o e-mail cadastrado na empresa.", botao: "Continuar" },
  email: { titulo: "Confirme o e-mail", botao: "Enviar código" },
  codigo: { titulo: "Digite o código", botao: "Confirmar código" },
  senha: { titulo: "Crie a nova senha", sub: "Ela passa a valer também no site oficial da Central do Funcionário.", botao: "Trocar senha" },
  pronto: { titulo: "Senha alterada", sub: "Entre com a nova senha. Se usa outro app ou aparelho com a senha salva, atualize lá também.", botao: "" },
};

export function FormRecuperacao() {
  const [estado, acao, enviando] = useActionState(recuperarSenha, INICIAL);
  const { titulo, sub, botao } = TEXTOS[estado.etapa];

  return (
    <>
      <div>
        <h1>{titulo}</h1>
        {sub && <p className="muted auth-sub">{sub}</p>}
      </div>

      {estado.etapa === "pronto" ? (
        <Link className="btn btn-primary btn-lg btn-block" href="/login">Ir para o login <ArrowRight size={17} aria-hidden="true" /></Link>
      ) : (
        <form action={acao} className="form-login" key={estado.etapa}>
          {estado.erro && <p className="form-error" role="alert">{estado.erro}</p>}

          {estado.etapa === "usuario" && (
            <>
              <fieldset className="field campo-tipo">
                <legend>Entrar com</legend>
                <div className="segmented full">
                  <label><input type="radio" name="tipo" value="0" defaultChecked={estado.tipo === "0"} /><span>Nº Folha</span></label>
                  <label><input type="radio" name="tipo" value="1" defaultChecked={estado.tipo === "1"} /><span>Identificador</span></label>
                </div>
              </fieldset>
              <label className="field">
                <span>Usuário</span>
                <input className="input" name="usuario" defaultValue={estado.usuario} placeholder="Seu usuário" required autoComplete="username" autoCapitalize="none" autoCorrect="off" maxLength={64} />
              </label>
            </>
          )}

          {estado.etapa === "email" && (
            <>
              <p className="muted">Digite o e-mail completo cadastrado na empresa. Ele aparece mascarado como <strong className="email-oculto">{estado.email}</strong>.</p>
              <label className="field">
                <span>E-mail</span>
                <input className="input" name="email" type="email" defaultValue={estado.emailInformado} placeholder="seu@email.com" required autoComplete="email" autoCapitalize="none" autoCorrect="off" maxLength={254} />
              </label>
            </>
          )}

          {estado.etapa === "codigo" && (
            <>
              <p className="muted">Enviamos o código para <strong className="email-oculto">{estado.email}</strong>.</p>
              <label className="field">
                <span>Código</span>
                <input className="input" name="codigo" required autoComplete="one-time-code" inputMode="numeric" maxLength={32} />
              </label>
            </>
          )}

          {estado.etapa === "senha" && (
            <>
              <label className="field">
                <span>Nova senha</span>
                <input className="input" name="novaSenha" type="password" required autoComplete="new-password" maxLength={128} />
              </label>
              <label className="field">
                <span>Confirmar nova senha</span>
                <input className="input" name="confirmarSenha" type="password" required autoComplete="new-password" maxLength={128} />
              </label>
            </>
          )}

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>
            {enviando ? <span className="spinner" aria-label="Enviando" /> : <>{botao} <ArrowRight size={17} aria-hidden="true" /></>}
          </button>

          {estado.etapa === "codigo" && (
            <button type="submit" className="link-esquecer" name="acao" value="reenviar" formNoValidate>Não recebi: enviar de novo</button>
          )}
          <Link className="link-esquecer" href="/login">Voltar para o login</Link>
        </form>
      )}
    </>
  );
}
