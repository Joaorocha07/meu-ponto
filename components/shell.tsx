"use client";

import { CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sair } from "@/app/acoes";
import { Marca } from "./marca";
import { BotaoTema } from "./tema";

const PRINCIPAL = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard },
  { href: "/cartao", rotulo: "Cartão ponto", Icone: CalendarDays },
];
const CONTA = [{ href: "/perfil", rotulo: "Meu perfil", Icone: UserRound }];

export function Shell({ nome, children }: { nome: string; children: ReactNode }) {
  const caminho = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const conta = useRef<HTMLDivElement>(null);
  const inicial = nome.charAt(0).toUpperCase();
  const pagina = [...PRINCIPAL, ...CONTA].find((i) => i.href === caminho)?.rotulo ?? "Painel";

  const links = (itens: typeof PRINCIPAL) =>
    itens.map(({ href, rotulo, Icone }) => {
      const ativo = caminho === href;
      return (
        <Link key={href} href={href} className={ativo ? "active" : undefined} aria-current={ativo ? "page" : undefined}>
          <Icone size={18} aria-hidden="true" />{rotulo}
        </Link>
      );
    });

  useEffect(() => {
    setMenuAberto(false);
    setContaAberta(false);
  }, [caminho]);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (!conta.current?.contains(e.target as Node)) setContaAberta(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuAberto(false);
      setContaAberta(false);
    }
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <div className={`shell${menuAberto ? " nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand"><Marca /></div>
        <div className="nav-label">Principal</div>
        <nav className="nav" aria-label="Menu principal">{links(PRINCIPAL)}</nav>
        <div className="nav-label">Conta</div>
        <nav className="nav" aria-label="Menu da conta">{links(CONTA)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">{inicial}</span>
            <strong>{nome}</strong>
            <form action={sair}>
              <button type="submit" className="icon-btn" aria-label="Sair" title="Sair"><LogOut size={17} aria-hidden="true" /></button>
            </form>
          </div>
        </div>
      </aside>
      {menuAberto && <button type="button" className="nav-overlay" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}

      <div className="workspace">
        <header className="topbar">
          <button type="button" className="icon-btn bordered menu-btn" onClick={() => setMenuAberto((v) => !v)} aria-label={menuAberto ? "Fechar menu" : "Abrir menu"} aria-expanded={menuAberto}>
            {menuAberto ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <div className="crumbs">
            <span className="hide-mobile">Meu ponto</span>
            <span className="hide-mobile" aria-hidden="true">/</span>
            <strong>{pagina}</strong>
          </div>
          <div className="spacer" />
          <BotaoTema />
          <div className="dropdown" ref={conta}>
            <button type="button" className="conta-btn" onClick={() => setContaAberta((v) => !v)} aria-label="Conta" aria-expanded={contaAberta}>
              <span className="avatar inverse" aria-hidden="true">{inicial}</span>
              <span className="hide-mobile conta-nome">{nome}</span>
              <ChevronDown size={15} className="hide-mobile" aria-hidden="true" />
            </button>
            {contaAberta && (
              <div className="menu">
                <div className="menu-label">{nome}</div>
                <Link href="/perfil"><UserRound size={16} aria-hidden="true" />Meu perfil</Link>
                <form action={sair}>
                  <button type="submit"><LogOut size={16} aria-hidden="true" />Sair</button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
