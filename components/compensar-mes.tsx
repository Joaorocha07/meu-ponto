"use client";

import { useActionState, useRef } from "react";
import { compensarSaldo, desfazerCompensacao, type EstadoCompensar } from "@/app/acoes";

const INICIAL: EstadoCompensar = { erro: null };

type Props = {
  /** Mês do período escolhido: é nele que o saldo do período anterior é compensado. */
  mes: string;
  saldo: string;
  intervaloOrigem: string;
  intervalo: string;
  inicio: string;
  fim: string;
};

export function BotaoCompensar({ mes, saldo, intervaloOrigem, intervalo, inicio, fim }: Props) {
  const janela = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(compensarSaldo, INICIAL);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => janela.current?.showModal()}>Compensar saldo do mês</button>
      <dialog ref={janela} className="card janela" aria-labelledby="titulo-compensar">
        <form action={acao} className="form-login">
          <div>
            <h2 id="titulo-compensar">Compensar {saldo}</h2>
            <p className="muted">Saldo de {intervaloOrigem}. Escolha o dia entre {intervalo}.</p>
          </div>
          {estado.erro && <p className="form-error" role="alert">{estado.erro}</p>}
          <input type="hidden" name="mes" value={mes} />
          <label className="field">
            <span>Compensado no dia</span>
            <input className="input" type="date" name="data" min={inicio} max={fim} required />
          </label>
          <div className="janela-botoes">
            <button type="button" className="btn" onClick={() => janela.current?.close()}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={enviando}>{enviando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function BotaoDesfazer({ mes }: { mes: string }) {
  const [estado, acao, enviando] = useActionState(desfazerCompensacao, INICIAL);
  return (
    <form action={acao}>
      <input type="hidden" name="mes" value={mes} />
      <button type="submit" className="btn" disabled={enviando}>{enviando ? "Desfazendo..." : "Desfazer"}</button>
      {estado.erro && <p className="form-error" role="alert">{estado.erro}</p>}
    </form>
  );
}
