import { NextResponse, type NextRequest } from "next/server";
import { apagarSessao } from "@/lib/sessao";

// Páginas não podem alterar cookies durante a renderização, então a limpeza acontece aqui.
export async function GET(request: NextRequest) {
  await apagarSessao();
  return NextResponse.redirect(new URL("/login?expirada", request.url));
}
