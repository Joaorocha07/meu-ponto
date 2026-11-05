// Simula a API da Secullum com os exemplos do PDF, para testar sem credenciais reais.
// Usuário 12345678, senha 1234. Uso: npm run mock
import { createServer } from "node:http";

const AUTH_OK = Buffer.from("12345678:1234:0").toString("base64");
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

createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  console.log(req.method, pathname);
  if (pathname.startsWith("/__falha/")) {
    falha = pathname.split("/").pop();
    return json(res, 200, { falha });
  }
  if (req.headers.authorization !== `Basic ${AUTH_OK}` || falha === "senha") return json(res, 401, {});
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
