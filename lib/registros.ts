import "server-only";
import { neon } from "@neondatabase/serverless";

// Registros de compensação feitos pelo funcionário. A Secullum não guarda isso, então fica no nosso
// banco, sempre filtrado pelo funcionário da sessão. Erros do banco nunca vão para a tela nem para
// o log, porque podem conter a conexão.

export type RegistroCompensacao = {
  /** Mês em que fecha o período do saldo compensado. Ex.: "2026-10" é 21/09 a 20/10. */
  mesOrigem: string;
  /** Dia em que a pessoa compensou (AAAA-MM-DD). */
  data: string;
  /** Saldo do mês quando o registro foi feito. */
  minutos: number;
};

function conexao() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  return neon(url);
}

const banco = () => process.env.SECULLUM_BANCO ?? "";

export async function lerRegistros(funcionarioId: number, meses: string[]): Promise<RegistroCompensacao[]> {
  const linhas = await conexao()`
    select mes_origem, data_compensacao::text as data, minutos
    from compensacoes
    where banco = ${banco()} and funcionario_id = ${funcionarioId} and mes_origem = any(${meses})
  `;
  return linhas.map((l) => ({ mesOrigem: String(l.mes_origem), data: String(l.data), minutos: Number(l.minutos) }));
}

export async function salvarRegistro(funcionarioId: number, registro: RegistroCompensacao): Promise<void> {
  await conexao()`
    insert into compensacoes (banco, funcionario_id, mes_origem, data_compensacao, minutos)
    values (${banco()}, ${funcionarioId}, ${registro.mesOrigem}, ${registro.data}, ${registro.minutos})
    on conflict (banco, funcionario_id, mes_origem)
    do update set data_compensacao = excluded.data_compensacao, minutos = excluded.minutos, criado_em = now()
  `;
}

export async function apagarRegistro(funcionarioId: number, mesOrigem: string): Promise<void> {
  await conexao()`
    delete from compensacoes
    where banco = ${banco()} and funcionario_id = ${funcionarioId} and mes_origem = ${mesOrigem}
  `;
}
