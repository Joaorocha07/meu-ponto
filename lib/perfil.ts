// Seleciona o que a tela de perfil pode mostrar. Módulo puro, para poder ser testado.
// Lista fechada de campos: RG, filiação, comprovante e IP de login não saem do servidor.

export type PeriodoHorario = { periodo: string; horario: string };

export type DadosPerfil = {
  nome: string | null;
  funcao: string | null;
  empresa: string | null;
  identificador: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  nascimento: string | null;
  cpfMascarado: string | null;
  possuiFoto: boolean;
  horarios: PeriodoHorario[];
  bancoHoras: boolean | null;
};

type Bruto = Record<string, unknown>;

const objeto = (v: unknown): Bruto => (v && typeof v === "object" ? (v as Bruto) : {});
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const juntar = (partes: (string | null)[], separador: string): string | null =>
  partes.filter(Boolean).join(separador) || null;

/** O CPF completo nunca sai do servidor: "123.456.789-00" vira "***.456.789-**". */
export function mascararCpf(cpf: unknown): string | null {
  const m = /^\d{3}\.(\d{3})\.(\d{3})-\d{2}$/.exec(texto(cpf) ?? "");
  return m ? `***.${m[1]}.${m[2]}-**` : null;
}

/** "1990-05-20" ou "1990-05-20T00:00:00" vira "20/05/1990". */
export function formatarNascimento(valor: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(valor) ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Une /Funcionarios/{id} e /Funcionarios/DadosAdicionais/{id}. Qualquer um pode faltar. */
export function mapearPerfil(funcionario: unknown, adicionais: unknown): DadosPerfil {
  const f = objeto(funcionario);
  const a = objeto(adicionais);
  const horarios = Array.isArray(f.listaHorarios)
    ? f.listaHorarios.flatMap((h) => {
        const periodo = texto(h?.periodo);
        const horario = texto(h?.horario);
        return periodo && horario ? [{ periodo, horario }] : [];
      })
    : [];
  return {
    nome: texto(f.nome),
    funcao: texto(f.funcao),
    empresa: texto(f.empresa),
    identificador: texto(f.numeroIdentificador),
    email: texto(a.email) ?? texto(f.email),
    celular: texto(a.celular) ?? texto(f.celular),
    telefone: texto(a.telefone),
    endereco: juntar([texto(a.endereco), texto(a.bairro), texto(a.cep)], ", "),
    cidade: juntar([texto(a.cidade) ?? texto(f.cidade), texto(a.estado) ?? texto(f.uf)], " - "),
    nascimento: formatarNascimento(a.nascimento),
    cpfMascarado: mascararCpf(a.cpf) ?? mascararCpf(f.cpf),
    possuiFoto: a.possuiFoto === true,
    horarios,
    bancoHoras: typeof f.bancoHorasHabilitado === "boolean" ? f.bancoHorasHabilitado : null,
  };
}

/**
 * Decodifica a foto e identifica o tipo pelos primeiros bytes, sem confiar no que a API declara.
 * Só aceita formatos de imagem que não executam código (SVG fica de fora).
 */
export function decodificarFoto(valor: unknown): { bytes: Buffer; tipo: string } | null {
  const base64 = texto(valor)?.replace(/^data:[^,]*,/, "");
  if (!base64) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, tipo: "image/jpeg" };
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "\x89PNG") return { bytes, tipo: "image/png" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") {
    return { bytes, tipo: "image/webp" };
  }
  return null;
}
