'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Arma la lista de páginas a mostrar: siempre la primera y la última, y las
// vecinas de la actual. Los huecos se marcan con 'gap'.
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  const wanted = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = Array.from(wanted)
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push('gap');
    result.push(n);
  });
  return result;
}

export function PaginationControls({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Paginación" className={cn('flex items-center justify-center gap-1.5 flex-wrap', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Anterior</span>
      </Button>

      {/* En pantallas chicas solo se muestra "Página X de Y" */}
      <span className="px-2 text-sm text-muted-foreground sm:hidden">
        Página {page} de {pageCount}
      </span>

      <div className="hidden sm:flex items-center gap-1.5">
        {pageWindow(page, pageCount).map((item, i) =>
          item === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={item === page ? 'default' : 'outline'}
              className="min-w-9 px-2.5"
              aria-label={`Ir a la página ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          )
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Página siguiente"
      >
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight className="h-4 w-4 sm:ml-1" />
      </Button>
    </nav>
  );
}
