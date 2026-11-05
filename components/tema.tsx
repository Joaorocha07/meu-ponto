"use client";

import { Moon, Sun } from "lucide-react";

export function BotaoTema() {
  function alternar() {
    const novo = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    document.cookie = `tema=${novo}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" className="icon-btn bordered" onClick={alternar} aria-label="Alternar tema claro ou escuro" title="Alternar tema">
      <Moon className="so-claro" size={17} aria-hidden="true" />
      <Sun className="so-escuro" size={17} aria-hidden="true" />
    </button>
  );
}
