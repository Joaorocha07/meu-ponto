// Leitura das respostas do fluxo "Esqueci minha senha". Módulo puro para poder ser testado.
// Os formatos de resposta são inferidos do front oficial: os endpoints nunca foram chamados de
// verdade, porque enviam e-mail e trocam a senha. Por isso a leitura aceita mais de um formato.

const MAX_MENSAGEM = 200;

function parsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/** E-mail mascarado do passo 1. Vazio, false ou null indica usuário sem e-mail cadastrado. */
export function lerEmailOculto(texto: string): string | null {
  const corpo = parsear(texto);
  const email = typeof corpo === "string" ? corpo : (corpo as { email?: unknown } | null)?.email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function primeiraMensagem(valor: unknown): string | null {
  if (typeof valor === "string") return valor.trim() || null;
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const mensagem = primeiraMensagem(item);
      if (mensagem) return mensagem;
    }
    return null;
  }
  if (valor && typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    for (const chave of ["message", "mensagem", "erro", "erros", "errors"]) {
      const mensagem = primeiraMensagem(objeto[chave]);
      if (mensagem) return mensagem;
    }
    // Validação por campo: { campo: "mensagem" }.
    return primeiraMensagem(Object.values(objeto));
  }
  return null;
}

/** Mensagem de erro da API, para mostrar ao usuário. HTML (página de erro) não é mensagem. */
export function lerMensagemErro(texto: string): string | null {
  const mensagem = primeiraMensagem(parsear(texto));
  if (!mensagem || mensagem.includes("<") || mensagem.length > MAX_MENSAGEM) return null;
  return mensagem;
}
