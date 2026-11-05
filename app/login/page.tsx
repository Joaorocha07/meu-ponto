import { CalendarCheck, Eye, Scale } from "lucide-react";
import { redirect } from "next/navigation";
import { IconeFundoPreto, Marca } from "@/components/marca";
import { BotaoTema } from "@/components/tema";
import { lerCredenciaisSalvas, lerSessao } from "@/lib/sessao";
import { FormLogin } from "./form-login";

export const dynamic = "force-dynamic";

const DESTAQUES = [
  { Icone: Scale, texto: "Saldo do mês sempre à mão" },
  { Icone: CalendarCheck, texto: "Dias incompletos sinalizados" },
  { Icone: Eye, texto: "Só leitura: nunca registra ponto" },
];

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  if (await lerSessao()) redirect("/");
  const { expirada } = await searchParams;
  const salvas = await lerCredenciaisSalvas();
  // Só usuário e tipo seguem para o navegador; a senha salva fica no servidor.
  const salvo = salvas ? { usuario: salvas.usuario, tipo: salvas.tipo } : null;
  return (
    <div className="auth">
      <aside className="auth-side">
        <IconeFundoPreto className="art" />
        <Marca className="marca-grande" />
        <div className="auth-side-texto">
          <h2>Seu saldo de horas, sem surpresa no fim do mês.</h2>
          <p>Veja em segundos se você está devendo ou com horas a mais, a partir do seu cartão ponto.</p>
          <ul>
            {DESTAQUES.map(({ Icone, texto }) => (
              <li key={texto}><span><Icone size={15} aria-hidden="true" /></span>{texto}</li>
            ))}
          </ul>
        </div>
        <small className="auth-legal">App não oficial, sem ligação com a Secullum.</small>
      </aside>

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
