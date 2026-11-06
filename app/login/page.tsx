import { redirect } from "next/navigation";
import { LadoAuth } from "@/components/lado-auth";
import { Marca } from "@/components/marca";
import { BotaoTema } from "@/components/tema";
import { lerCredenciaisSalvas, lerSessao } from "@/lib/sessao";
import { FormLogin } from "./form-login";

export const dynamic = "force-dynamic";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  if (await lerSessao()) redirect("/");
  const { expirada } = await searchParams;
  const salvas = await lerCredenciaisSalvas();
  // Só usuário e tipo seguem para o navegador; a senha salva fica no servidor.
  const salvo = salvas ? { usuario: salvas.usuario, tipo: salvas.tipo } : null;
  return (
    <div className="auth">
      <LadoAuth />

      <main className="auth-main">
        <div className="auth-tema"><BotaoTema /></div>
        <div className="auth-card">
          <Marca className="marca-card" />
          <div>
            <h1>Entre na sua conta</h1>
            <p className="muted auth-sub">Use os mesmos dados da Central do Funcionário.</p>
          </div>
          {expirada !== undefined && (
            <p className="form-error" role="alert">Sua senha mudou ou a sessão expirou. Entre novamente.</p>
          )}
          <FormLogin salvo={salvo} />
          <p className="muted auth-nota">
            Sua senha fica criptografada em um cookie neste aparelho, por até 7 dias (90 dias se você salvar), e passa
            pelo servidor deste app a cada consulta. Ela não é salva em banco de dados.
          </p>
        </div>
      </main>
    </div>
  );
}
