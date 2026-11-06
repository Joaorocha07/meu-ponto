import { describe, expect, it } from "vitest";
import { lerEmailOculto, lerMensagemErro } from "./recuperacao";

describe("lerEmailOculto", () => {
  it("aceita JSON, texto puro e objeto", () => {
    expect(lerEmailOculto('"jo***@gmail.com"')).toBe("jo***@gmail.com");
    expect(lerEmailOculto("jo***@gmail.com")).toBe("jo***@gmail.com");
    expect(lerEmailOculto('{"email":"jo***@gmail.com"}')).toBe("jo***@gmail.com");
  });

  it("trata vazio, false e null como sem e-mail", () => {
    for (const texto of ["", '""', "   ", "false", "null", "{}"]) {
      expect(lerEmailOculto(texto)).toBeNull();
    }
  });
});

describe("lerMensagemErro", () => {
  it("encontra a mensagem nos formatos prováveis", () => {
    expect(lerMensagemErro('"Código inválido"')).toBe("Código inválido");
    expect(lerMensagemErro('{"message":"Código inválido"}')).toBe("Código inválido");
    expect(lerMensagemErro('{"codigo":"Código inválido"}')).toBe("Código inválido");
    expect(lerMensagemErro('{"erros":[{"mensagem":"Código inválido"}]}')).toBe("Código inválido");
    expect(lerMensagemErro('[{"property":"","message":"Código inválido"}]')).toBe("Código inválido");
  });

  it("não repassa página de erro nem texto enorme", () => {
    expect(lerMensagemErro("<html>erro</html>")).toBeNull();
    expect(lerMensagemErro("x".repeat(201))).toBeNull();
    expect(lerMensagemErro("")).toBeNull();
    expect(lerMensagemErro("{}")).toBeNull();
  });
});
