import { NextResponse } from "next/server";
import { decodificarFoto } from "@/lib/perfil";
import { buscarDadosAdicionais, SecullumError } from "@/lib/secullum";
import { lerSessao } from "@/lib/sessao";

// Rota separada para a foto (cerca de 262 KB) não pesar no HTML da página.
export async function GET() {
  const sessao = await lerSessao();
  if (!sessao?.funcionarioId) return new NextResponse(null, { status: 401 });

  try {
    const adicionais = (await buscarDadosAdicionais(sessao.cred, sessao.funcionarioId)) as { foto?: unknown } | null;
    const foto = decodificarFoto(adicionais?.foto);
    if (!foto) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(foto.bytes), {
      // no-store: em aparelho compartilhado, a foto não pode sobrar depois do logout.
      headers: { "Content-Type": foto.tipo, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof SecullumError) return new NextResponse(null, { status: 502 });
    throw e;
  }
}
