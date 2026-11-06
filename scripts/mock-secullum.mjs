// Simula a API da Secullum com os exemplos do PDF, para testar sem credenciais reais.
// Usuário 12345678, senha 1234, código de recuperação 123456. Uso: npm run mock
import { createServer } from "node:http";

let senhaAtual = "1234";
const authOk = () => Buffer.from(`12345678:${senhaAtual}:0`).toString("base64");
const CODIGO = "123456"; // Código de recuperação de senha, que na API real chega por e-mail.
const util = { entrada1: "08:00", saida1: "11:00", entrada2: "12:00", saida2: "17:00" };

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const adicionais = {
  endereco: null, bairro: null, cidade: "Goiânia", estado: null, cep: null, telefone: null, celular: null,
  email: "maria@exemplo.com.br", rg: "RG-SECRETO", mae: "MAE-SECRETA", pai: null, cpf: "123.456.789-00",
  nascimento: "1990-05-20", foto: PNG_1X1, possuiFoto: true, comprovanteEndereco: null,
};

const perfil = {
  id: 1,
  nome: "Maria Exemplo da Silva",
  funcao: "Analista de Suporte",
  empresa: "Empresa Exemplo Ltda",
  email: "maria@exemplo.com.br",
  numeroIdentificador: "998877",
  cidade: "Goiânia",
  uf: null,
  cpf: "123.456.789-00",
  loginEnderecoIp: "203.0.113.10",
  listaHorarios: [
    { periodo: "Período 1", horario: "08:00 - 11:00" },
    { periodo: "Período 2", horario: "12:00 - 17:00" },
  ],
  bancoHorasHabilitado: false,
  dadosHorario: {
    itens: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
      diaSemana,
      ...(diaSemana >= 1 && diaSemana <= 5 ? util : {}),
    })),
  },
};

const dia = (data, valores, saldo = "+00:00", situacao = 0, feriado = false) => ({
  data: `${data}T00:00:00`,
  funcionarioNome: perfil.nome,
  batidas: valores.map((valor, i) => ({
    nome: `${i % 2 ? "Saída" : "Entrada"} ${Math.floor(i / 2) + 1}`,
    valor,
    valorOriginal: valor,
    geolocalizacao: { latitude: 0, longitude: 0 },
  })),
  saldo,
  situacao,
  feriado,
});

const dias = [
  // Saldos nos períodos anteriores, para testar os registros de compensação em sequência.
  dia("2026-09-15", ["08:00", "11:00", "12:00", "16:00"], "-01:00"),
  dia("2026-10-13", ["08:00", "11:00", "12:00", "20:00"], "+03:00"),
  dia("2026-10-15", ["08:00", "11:00", "12:00", "19:30"], "+02:30"),
  dia("2026-10-22", ["08:24", "11:44", "12:44", "17:47"], "+00:23"),
  dia("2026-10-24", ["FOLGA", "FOLGA", "FOLGA", "FOLGA"]),
  dia("2026-10-28", ["08:34", "11:55", "12:57", "18:30"], "+00:54"),
  dia("2026-10-30", ["08:19", "12:09", "", ""], "+00:00", 1),
  dia("2026-11-02", ["Feriado", "Feriado", "Feriado", "Feriado"], "+00:00", 0, true),
  dia("2026-11-03", ["ATESTADO", "ATESTADO", "", ""], "+00:00", 1),
  dia("2026-11-04", ["08:47", "12:27", "13:27", "16:53"], "+00:00", 1),
  dia("2026-11-05", ["08:02", "12:00", "", ""], "+00:00", 1),
];

const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};

// Simula falhas sem senha errada, para testar que elas não encerram a sessão:
// /__falha/perfil ou /__falha/adicionais devolvem 404; /__falha/senha recusa o login, como
// se a senha tivesse mudado; /__falha/nenhuma volta ao normal.
let falha = "nenhuma";

// Os formatos de resposta são inferidos: os endpoints reais nunca foram chamados.
async function recuperacao(req, res, passo) {
  let texto = "";
  for await (const parte of req) texto += parte;
  const corpo = JSON.parse(texto || "{}");
  console.log("RecuperacaoSenha", passo, "autorizacao:", req.headers.authorization ?? "nenhuma");
  if (corpo.usuario === "semmail") return json(res, 200, "");
  if (corpo.usuario !== "12345678") return json(res, 400, { usuario: "Usuário não encontrado." });
  if (passo === "ObterEmailOcultoFuncionario") return json(res, 200, "ma***@exemplo.com.br");
  if (passo === "ConfirmarEmail") {
    // Como na API real, que recusa o e-mail mascarado com esta mesma mensagem.
    return corpo.email === perfil.email ? json(res, 200, {}) : json(res, 400, { email: "Informe o email corretamente." });
  }
  if (corpo.codigo !== CODIGO) return json(res, 400, { codigo: "Código inválido." });
  if (passo === "ConfirmarCodigo") return json(res, 200, {});
  if (passo === "TrocarSenha") {
    if (corpo.novaSenha !== corpo.confirmarSenha) return json(res, 400, { confirmarSenha: "As senhas não conferem." });
    senhaAtual = corpo.novaSenha;
    return json(res, 200, {});
  }
  return json(res, 404, {});
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  console.log(req.method, pathname);
  if (pathname.startsWith("/__falha/")) {
    falha = pathname.split("/").pop();
    return json(res, 200, { falha });
  }
  if (pathname.includes("/RecuperacaoSenha/")) return recuperacao(req, res, pathname.split("/").pop());
  if (req.headers.authorization !== `Basic ${authOk()}` || falha === "senha") return json(res, 401, {});
  if (req.method === "POST" && pathname.endsWith("/Login")) return json(res, 200, perfil);
  if (pathname.endsWith("/Funcionarios/DadosAdicionais/1")) {
    return falha === "adicionais" ? json(res, 404, {}) : json(res, 200, adicionais);
  }
  if (pathname.endsWith("/Funcionarios/1")) {
    return falha === "perfil" ? json(res, 404, {}) : json(res, 200, perfil);
  }
  const m = pathname.match(/\/Batidas\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    const lista = dias.filter((d) => d.data.slice(0, 10) >= m[1] && d.data.slice(0, 10) <= m[2]);
    return json(res, 200, { erros: [], totais: [], lista });
  }
  return json(res, 404, {});
}).listen(4010, () => console.log("Mock da Secullum em http://localhost:4010"));
