/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { mapearPerfil, type DadosPerfil } from "@/lib/perfil";
import { buscarDadosAdicionais, buscarFuncionario, SecullumError } from "@/lib/secullum";
import { lerSessao } from "@/lib/sessao";

export const dynamic = "force-dynamic";

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{children ?? <span className="muted">Não informado</span>}</dd>
    </div>
  );
}

export default async function Perfil() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  // Sessões criadas antes desta tela não têm o id: um novo login resolve.
  if (!sessao.funcionarioId) redirect("/sessao-expirada");

  let dados: DadosPerfil | null = null;
  let erro: string | null = null;
  try {
    // Uma chamada de cada vez: com senha errada, a segunda nem é enviada.
    const funcionario = await buscarFuncionario(sessao.cred, sessao.funcionarioId);
    // Os dados adicionais são um complemento: se falharem, o resto do perfil continua na tela.
    const adicionais = await buscarDadosAdicionais(sessao.cred, sessao.funcionarioId).catch((e: unknown) => {
      if (e instanceof SecullumError && e.kind !== "credenciais") return null;
      throw e;
    });
    dados = mapearPerfil(funcionario, adicionais);
  } catch (e) {
    if (!(e instanceof SecullumError)) throw e;
    if (e.kind === "credenciais") redirect("/sessao-expirada");
    erro = e.message;
  }

  const nome = dados?.nome ?? (sessao.primeiroNome || "Funcionário");
  const usaFolha = sessao.cred.tipo === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Meu perfil</h1>
          <p>Seus dados cadastrados na Central do Funcionário.</p>
        </div>
      </div>

      {erro && <p className="card card-pad aviso-perfil" role="alert">{erro} Tente novamente em instantes.</p>}

      <section className="card perfil-topo">
        {dados?.possuiFoto ? (
          <img className="avatar lg foto" src="/perfil/foto" alt="" width={64} height={64} />
        ) : (
          <span className="avatar lg inverse" aria-hidden="true">{nome.charAt(0).toUpperCase()}</span>
        )}
        <div className="perfil-nome">
          <h2>{nome}</h2>
          {dados?.funcao && <p>{dados.funcao}</p>}
        </div>
        {dados?.empresa && <span className="badge soft plain perfil-empresa">{dados.empresa}</span>}
      </section>

      {dados && (
        <div className="perfil-grid">
          <section className="card">
            <div className="card-head"><div><h2>Dados pessoais</h2><p>Conforme o cadastro da empresa.</p></div></div>
            <dl className="dados">
              <Linha rotulo={usaFolha ? "Nº Folha" : "Identificador"}>{usaFolha ? sessao.cred.usuario : dados.identificador ?? sessao.cred.usuario}</Linha>
              {usaFolha && dados.identificador && <Linha rotulo="Identificador">{dados.identificador}</Linha>}
              <Linha rotulo="CPF">{dados.cpfMascarado}</Linha>
              <Linha rotulo="Nascimento">{dados.nascimento}</Linha>
              <Linha rotulo="E-mail">{dados.email}</Linha>
              {dados.celular && <Linha rotulo="Celular">{dados.celular}</Linha>}
              {dados.telefone && <Linha rotulo="Telefone">{dados.telefone}</Linha>}
              {dados.endereco && <Linha rotulo="Endereço">{dados.endereco}</Linha>}
              <Linha rotulo="Cidade">{dados.cidade}</Linha>
            </dl>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Minha jornada</h2><p>Horário cadastrado pela empresa.</p></div></div>
            <dl className="dados">
              {dados.horarios.map((h) => <Linha key={h.periodo} rotulo={h.periodo}>{h.horario}</Linha>)}
              {dados.horarios.length === 0 && <Linha rotulo="Horário">{null}</Linha>}
              <Linha rotulo="Banco de horas">
                {dados.bancoHoras === null ? null : dados.bancoHoras ? "Habilitado" : "Não habilitado"}
              </Linha>
            </dl>
          </section>
        </div>
      )}

      <p className="rodape">Encontrou algo errado? Fale com o RH da sua empresa. Este app só mostra os dados e não altera nada.</p>
    </>
  );
}
