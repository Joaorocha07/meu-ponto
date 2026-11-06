import { LadoAuth } from "@/components/lado-auth";
import { Marca } from "@/components/marca";
import { BotaoTema } from "@/components/tema";
import { FormRecuperacao } from "./form-recuperacao";

export const metadata = { title: "Recuperar senha · Meu ponto" };

export default function PaginaEsqueciSenha() {
  return (
    <div className="auth">
      <LadoAuth />
      <main className="auth-main">
        <div className="auth-tema"><BotaoTema /></div>
        <div className="auth-card">
          <Marca className="marca-card" />
          <FormRecuperacao />
        </div>
      </main>
    </div>
  );
}
