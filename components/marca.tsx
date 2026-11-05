/* eslint-disable @next/next/no-img-element */

/** Nome do app em texto, na fonte de títulos: é a logo principal. */
export function Marca({ className }: { className?: string }) {
  return <span className={`marca${className ? ` ${className}` : ""}`}>meu ponto</span>;
}

/** Ícone sobre um fundo sempre preto, como o painel do login. */
export function IconeFundoPreto({ className }: { className: string }) {
  return <img src="/brand/meu-ponto-icone-branco.png" alt="" aria-hidden="true" className={className} />;
}

/** Ícone sobre o bloco de boas-vindas, que é preto no tema claro e branco no escuro. */
export function IconeBoasVindas({ className }: { className: string }) {
  return (
    <>
      <img src="/brand/meu-ponto-icone-branco.png" alt="" aria-hidden="true" className={`${className} so-claro`} />
      <img src="/brand/meu-ponto-icone-preto.png" alt="" aria-hidden="true" className={`${className} so-escuro`} />
    </>
  );
}
