type RangeQuery<T> = {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

// Supabase devuelve como máximo ~1000 filas por consulta, aunque la tabla
// tenga más. Esta función pide los datos en tandas hasta traerlos todos.
//
// `makeQuery` tiene que devolver una consulta NUEVA en cada llamada y con un
// orden estable y único (ej. .order('name').order('id')), si no las tandas
// podrían repetir o saltearse filas.
export async function fetchAllRows<T>(makeQuery: () => RangeQuery<T>, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Tope de seguridad (200 tandas) para no quedar en un bucle infinito.
  for (let i = 0; i < 200; i++) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    // Se avanza por lo que realmente llegó (no por pageSize): si el servidor
    // devuelve menos filas que las pedidas, no se saltea ninguna.
    from += data.length;
  }
  return all;
}
