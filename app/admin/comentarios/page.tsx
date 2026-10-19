'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, EyeOff, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { supabase, type ProductComment } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type CommentRow = ProductComment & { products: { name: string } | null };
type Filter = 'pendientes' | 'aprobados' | 'todos';

export default function ComentariosPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pendientes');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentRow | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_comments')
      .select('*, products(name)')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      setLoadError(null);
      setRows((data as unknown as CommentRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pendingCount = rows.filter((r) => !r.approved).length;
  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === 'todos' ? true : filter === 'pendientes' ? !r.approved : r.approved
      ),
    [rows, filter]
  );

  async function setApproved(row: CommentRow, approved: boolean) {
    setBusyId(row.id);
    const { error } = await supabase.from('product_comments').update({ approved }).eq('id', row.id);
    setBusyId(null);
    if (error) {
      toast({ title: 'No se pudo actualizar el comentario', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, approved } : r)));
    toast({ title: approved ? 'Comentario aprobado' : 'Comentario ocultado' });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    const { error } = await supabase.from('product_comments').delete().eq('id', target.id);
    setBusyId(null);
    setDeleteTarget(null);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== target.id));
    toast({ title: 'Comentario eliminado' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comentarios</h1>
        <p className="text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? 'comentario espera' : 'comentarios esperan'} tu aprobación`
            : 'No hay comentarios pendientes'}
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pendientes">Pendientes{pendingCount > 0 ? ` (${pendingCount})` : ''}</TabsTrigger>
          <TabsTrigger value="aprobados">Aprobados</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          No pudimos cargar los comentarios: {loadError}. Si es la primera vez, revisá que hayas corrido la
          migración <code>20260930000000_add_product_comments.sql</code> en Supabase.
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay comentarios en esta lista.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => (
            <div key={row.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.author_name}</span>
                  <Badge variant={row.approved ? 'secondary' : 'outline'}>
                    {row.approved ? 'Publicado' : 'Pendiente'}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                En:{' '}
                <Link href={`/producto/${row.product_id}`} target="_blank" className="underline hover:text-primary">
                  {row.products?.name ?? 'Producto eliminado'}
                </Link>
              </p>

              {row.rating ? (
                <div className="flex items-center gap-0.5" aria-label={`${row.rating} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn('h-4 w-4', n <= (row.rating ?? 0) ? 'fill-accent text-accent' : 'text-muted-foreground/40')}
                    />
                  ))}
                </div>
              ) : null}

              <p className="text-sm whitespace-pre-line break-words">{row.body}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                {row.approved ? (
                  <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => setApproved(row, false)}>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar
                  </Button>
                ) : (
                  <Button size="sm" disabled={busyId === row.id} onClick={() => setApproved(row, true)}>
                    <Check className="h-4 w-4 mr-2" />
                    Aprobar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busyId === row.id}
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comentario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra para siempre. Si solo querés que no se vea en la tienda, es mejor ocultarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
