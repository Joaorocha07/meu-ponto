import type { BatidaDetalhe } from "@/lib/batidas";

/** Sem JavaScript: usa <details>. Só aparece se houver algo além do horário já mostrado na linha. */
export function DetalhesBatidas({ batidas }: { batidas: BatidaDetalhe[] }) {
  const temDetalhe = (b: BatidaDetalhe) => b.horarioExato || b.endereco || b.coordenadas || b.original || b.incluida || b.semRepP;
  const lista = batidas.filter(temDetalhe);
  if (lista.length === 0) return null;

  const alteradas = batidas.filter((b) => b.original || b.incluida).length;
  const fora = batidas.filter((b) => b.foraDoHabitual).length;

  return (
    <details className="batidas-detalhe">
      <summary>
        Detalhes das marcações
        {alteradas > 0 && <b>{alteradas === 1 ? "1 alterada" : `${alteradas} alteradas`}</b>}
        {fora > 0 && <b>{fora === 1 ? "1 longe do habitual" : `${fora} longe do habitual`}</b>}
      </summary>
      <ul>
        {lista.map((b) => (
          <li key={b.nome}>
            <strong>{b.nome}: {b.horarioExato ?? b.valor}</strong>
            {b.original && <small>Alterada: era {b.original}, agora {b.valor || "sem marcação"}</small>}
            {b.incluida && <small>Incluída: não há marcação original</small>}
            {b.semRepP && <small>Sem registro REP-P</small>}
            {b.foraDoHabitual && <small>Longe do local habitual deste período</small>}
            {b.endereco && <small>{b.endereco}</small>}
            {b.coordenadas && (
              <small>
                <a href={`https://www.google.com/maps?q=${b.coordenadas.latitude},${b.coordenadas.longitude}`} target="_blank" rel="noopener noreferrer">Ver no mapa</a>
              </small>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
