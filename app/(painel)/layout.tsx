import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { lerSessao } from "@/lib/sessao";

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  return <Shell nome={sessao.primeiroNome || "Funcionário"}>{children}</Shell>;
}
