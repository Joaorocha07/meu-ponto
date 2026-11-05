import { describe, expect, it } from "vitest";
import { decodificarFoto, formatarNascimento, mapearPerfil, mascararCpf } from "./perfil";

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("mascararCpf", () => {
  it("esconde o início e os dígitos finais", () => {
    expect(mascararCpf("123.456.789-00")).toBe("***.456.789-**");
  });

  it("não exibe valor em formato desconhecido", () => {
    expect(mascararCpf("12345678900")).toBeNull();
    expect(mascararCpf(null)).toBeNull();
  });
});

describe("formatarNascimento", () => {
  it("aceita data simples e com horário", () => {
    expect(formatarNascimento("1990-05-20")).toBe("20/05/1990");
    expect(formatarNascimento("1990-05-20T00:00:00")).toBe("20/05/1990");
  });

  it("ignora valor inválido", () => {
    expect(formatarNascimento("20/05/1990")).toBeNull();
    expect(formatarNascimento(null)).toBeNull();
  });
});

describe("mapearPerfil", () => {
  it("aceita respostas vazias", () => {
    expect(mapearPerfil({}, null)).toMatchObject({ nome: null, email: null, horarios: [], bancoHoras: null, possuiFoto: false });
    expect(mapearPerfil(null, undefined).nome).toBeNull();
  });

  it("não repassa campos sensíveis fora da lista", () => {
    const dados = JSON.stringify(mapearPerfil(
      { nome: "Maria", cpf: "123.456.789-00", loginEnderecoIp: "10.0.0.1", senha: "x" },
      { rg: "RG-SECRETO", mae: "MAE-SECRETA", pai: "PAI-SECRETO", foto: "FOTO-BASE64", comprovanteEndereco: "COMPROVANTE" },
    ));
    for (const sensivel of ["123.456.789-00", "10.0.0.1", "RG-SECRETO", "MAE-SECRETA", "PAI-SECRETO", "FOTO-BASE64", "COMPROVANTE", "senha"]) {
      expect(dados).not.toContain(sensivel);
    }
  });

  it("prefere os dados adicionais e usa o perfil como reserva", () => {
    expect(mapearPerfil({ email: "a@x.com" }, { email: "b@x.com" }).email).toBe("b@x.com");
    expect(mapearPerfil({ email: "a@x.com" }, { email: null }).email).toBe("a@x.com");
    expect(mapearPerfil({ cpf: "123.456.789-00" }, null).cpfMascarado).toBe("***.456.789-**");
  });

  it("compõe endereço e cidade só com o que existe", () => {
    const dados = mapearPerfil({ cidade: "Goiânia", uf: null }, { endereco: "Rua A", bairro: null, cep: "74000-000" });
    expect(dados.endereco).toBe("Rua A, 74000-000");
    expect(dados.cidade).toBe("Goiânia");
    expect(mapearPerfil({}, { cidade: "Goiânia", estado: "GO" }).cidade).toBe("Goiânia - GO");
    expect(mapearPerfil({}, {}).endereco).toBeNull();
  });

  it("descarta horários malformados", () => {
    const dados = mapearPerfil({ listaHorarios: [{ periodo: "Período 1", horario: "08:00 - 11:00" }, { periodo: "Período 2" }, null] }, null);
    expect(dados.horarios).toEqual([{ periodo: "Período 1", horario: "08:00 - 11:00" }]);
  });
});

describe("decodificarFoto", () => {
  it("identifica PNG, com ou sem prefixo data:", () => {
    expect(decodificarFoto(PNG_1X1)?.tipo).toBe("image/png");
    expect(decodificarFoto(`data:image/png;base64,${PNG_1X1}`)?.tipo).toBe("image/png");
  });

  it("identifica JPEG pelos primeiros bytes", () => {
    expect(decodificarFoto(Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64"))?.tipo).toBe("image/jpeg");
  });

  it("recusa SVG e HTML, mesmo declarados como imagem", () => {
    const svg = Buffer.from("<svg onload='alert(1)'></svg>").toString("base64");
    expect(decodificarFoto(`data:image/png;base64,${svg}`)).toBeNull();
    expect(decodificarFoto(Buffer.from("<html></html>").toString("base64"))).toBeNull();
  });

  it("recusa valor ausente", () => {
    expect(decodificarFoto(null)).toBeNull();
    expect(decodificarFoto("")).toBeNull();
  });
});
