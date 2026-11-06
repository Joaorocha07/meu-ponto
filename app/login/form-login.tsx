"use client";

import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { entrar, type EstadoLogin } from "../acoes";

/** `salvo` traz só usuário e tipo: a senha salva nunca chega ao navegador. */
export function FormLogin({ salvo }: { salvo: { usuario: string; tipo: 0 | 1 } | null }) {
  const tipoSalvo = salvo?.tipo === 1 ? "1" : "0";
  const inicial: EstadoLogin = {
    erro: null,
    usuario: salvo?.usuario ?? "",
    tipo: tipoSalvo,
    lembrar: salvo !== null,
    salvoPara: salvo ? { usuario: salvo.usuario, tipo: tipoSalvo } : null,
  };
  const [estado, acao, enviando] = useActionState(entrar, inicial);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  // O que está digitado agora: a senha salva só vale para o mesmo usuário e tipo.
  const [digitado, setDigitado] = useState<{ usuario: string; tipo: string } | null>(null);
  const atual = digitado ?? estado;
  const temSalva = estado.salvoPara?.usuario === atual.usuario.trim() && estado.salvoPara?.tipo === atual.tipo;

  // Depois de cada resposta do servidor, o formulário volta aos valores de `estado`.
  const [estadoAnterior, setEstadoAnterior] = useState(estado);
  if (estado !== estadoAnterior) {
    setEstadoAnterior(estado);
    setDigitado(null);
  }

  function aoAlterar(e: FormEvent<HTMLFormElement>) {
    const dados = new FormData(e.currentTarget);
    setDigitado({ usuario: String(dados.get("usuario") ?? ""), tipo: String(dados.get("tipo") ?? "0") });
  }

  return (
    <form action={acao} className="form-login" onChange={aoAlterar}>
      {estado.erro && <p className="form-error" role="alert">{estado.erro}</p>}

      <fieldset className="field campo-tipo" key={estado.tipo}>
        <legend>Entrar com</legend>
        <div className="segmented full">
          <label>
            <input type="radio" name="tipo" value="0" defaultChecked={estado.tipo === "0"} />
            <span>Nº Folha</span>
          </label>
          <label>
            <input type="radio" name="tipo" value="1" defaultChecked={estado.tipo === "1"} />
            <span>Identificador</span>
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>Usuário</span>
        <div className="input-icon">
          <User size={17} aria-hidden="true" />
          <input className="input" name="usuario" defaultValue={estado.usuario} placeholder="Seu usuário" required autoComplete="username" autoCapitalize="none" autoCorrect="off" maxLength={64} />
        </div>
      </label>

      <label className="field">
        <span>Senha</span>
        <div className="input-icon password-field">
          <Lock size={17} aria-hidden="true" />
          <input
            className="input"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            placeholder={temSalva ? "Senha salva neste aparelho" : "Sua senha"}
            required={!temSalva}
            autoComplete="current-password"
            maxLength={128}
          />
          <button type="button" className="password-toggle" onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={mostrarSenha}>
            {mostrarSenha ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>
      </label>

      <label className="lembrar" key={`lembrar-${estado.lembrar}`}>
        <input type="checkbox" name="lembrar" defaultChecked={estado.lembrar} />
        <span>
          Salvar usuário e senha neste aparelho
          <small>Não marque em aparelho compartilhado. Quem usar este aparelho poderá entrar na sua conta.</small>
        </span>
      </label>

      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>
        {enviando ? <span className="spinner" aria-label="Entrando" /> : <>Entrar <ArrowRight size={17} aria-hidden="true" /></>}
      </button>

      <Link className="link-esquecer" href="/esqueci-senha">Esqueci minha senha</Link>

      {estado.salvoPara && (
        <button type="submit" className="link-esquecer" name="acao" value="esquecer" formNoValidate>
          Esquecer dados salvos
        </button>
      )}
    </form>
  );
}
