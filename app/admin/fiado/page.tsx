'use client';

import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, Plus, Search, Download, MessageCircle, Wallet, Archive, ArchiveRestore, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase, type Order } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  KIND_LABEL, withRunningBalance, reminderLink, accountsCsv,
  type AccountBalance, type AccountMovement,
} from '@/lib/fiado';

const PAGO_METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'tarjeta', label: 'Tarjeta' },
];
const METODO_LABEL: Record<string, string> = Object.fromEntries(PAGO_METODOS.map((m) => [m.value, m.label]));

const montoValido = (v: string) => Math.round((Number(v.replace(',', '.')) || 0) * 100) / 100;

export default function FiadoPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { toast } = useToast();

  const [cuentas, setCuentas] = useState<AccountBalance[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloDeuda, setSoloDeuda] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);

  const [abierta, setAbierta] = useState<AccountBalance | null>(null);
  const [movs, setMovs] = useState<AccountMovement[]>([]);
  const [ordenes, setOrdenes] = useState<Record<string, Order>>({});
  const [cargandoMovs, setCargandoMovs] = useState(false);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevo, setNuevo] = useState({ name: '', phone: '', credit_limit: '', notes: '', deuda: '' });

  const [pago, setPago] = useState({ monto: '', metodo: 'efectivo', nota: '' });
  const [ajuste, setAjuste] = useState({ monto: '', nota: '' });
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase.from('account_balances').select('*').order('name');
    if (error) toast({ title: 'No se pudo cargar el fiado', description: error.message, variant: 'destructive' });
    setCuentas(((data as AccountBalance[]) ?? []).map((c) => ({ ...c, balance: Number(c.balance) })));
    setCargando(false);
  }

  async function abrir(c: AccountBalance) {
    setAbierta(c);
    setPago({ monto: '', metodo: 'efectivo', nota: '' });
    setAjuste({ monto: '', nota: '' });
    setCargandoMovs(true);
    const { data } = await supabase.from('account_movements').select('*').eq('account_id', c.id).order('created_at', { ascending: false });
    const lista = (data as AccountMovement[]) ?? [];
    setMovs(lista);
    const ids = lista.map((m) => m.order_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: ords } = await supabase.from('orders').select('id, items, created_at, total').in('id', ids);
      setOrdenes(Object.fromEntries(((ords as Order[]) ?? []).map((o) => [o.id, o])));
    } else setOrdenes({});
    setCargandoMovs(false);
  }

  async function refrescarAbierta(id: string) {
    await cargar();
    const { data } = await supabase.from('account_balances').select('*').eq('id', id).maybeSingle();
    if (data) await abrir({ ...(data as AccountBalance), balance: Number((data as AccountBalance).balance) });
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cuentas
      .filter((c) => (verArchivados ? c.archived : !c.archived))
      .filter((c) => !soloDeuda || c.balance > 0)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'es'));
  }, [cuentas, busqueda, soloDeuda, verArchivados]);

  const totalPendiente = cuentas.filter((c) => !c.archived && c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const deudores = cuentas.filter((c) => !c.archived && c.balance > 0).length;

  async function crearCliente() {
    const name = nuevo.name.trim();
    if (!name) return toast({ title: 'Escribí el nombre del cliente', variant: 'destructive' });
    const limite = nuevo.credit_limit.trim() ? montoValido(nuevo.credit_limit) : null;
    const deuda = montoValido(nuevo.deuda);
    setGuardando(true);
    const { data, error } = await supabase.from('customer_accounts').insert({
      name, phone: nuevo.phone.trim() || null, notes: nuevo.notes.trim() || null, credit_limit: limite,
    }).select().single();
    if (!error && data && isAdmin && deuda > 0) {
      const r = await supabase.rpc('register_account_adjustment', { p_account_id: data.id, p_amount: deuda, p_note: 'Saldo anterior (deuda que ya tenía)' });
      if (r.error) toast({ title: 'El cliente se creó, pero no se cargó la deuda anterior', description: r.error.message, variant: 'destructive' });
    }
    setGuardando(false);
    if (error) return toast({ title: 'No se pudo crear el cliente', description: error.message, variant: 'destructive' });
    toast({ title: `Cliente "${name}" creado` });
    setNuevo({ name: '', phone: '', credit_limit: '', notes: '', deuda: '' });
    setNuevoOpen(false);
    cargar();
  }

  async function registrarPago() {
    if (!abierta) return;
    const monto = montoValido(pago.monto);
    if (monto <= 0) return toast({ title: 'Escribí cuánto pagó', variant: 'destructive' });
    setGuardando(true);
    const { error } = await supabase.rpc('register_account_payment', {
      p_account_id: abierta.id, p_amount: monto, p_payment_method: pago.metodo, p_note: pago.nota.trim() || null,
    });
    setGuardando(false);
    if (error) return toast({ title: 'No se pudo registrar el pago', description: error.message, variant: 'destructive' });
    toast({ title: `Pago de ${formatPrice(monto)} registrado` });
    refrescarAbierta(abierta.id);
  }

  async function registrarAjuste() {
    if (!abierta) return;
    const monto = montoValido(ajuste.monto);
    if (!monto) return toast({ title: 'Escribí el monto del ajuste', variant: 'destructive' });
    if (!ajuste.nota.trim()) return toast({ title: 'Escribí el motivo del ajuste', variant: 'destructive' });
    setGuardando(true);
    const { error } = await supabase.rpc('register_account_adjustment', { p_account_id: abierta.id, p_amount: monto, p_note: ajuste.nota.trim() });
    setGuardando(false);
    if (error) return toast({ title: 'No se pudo ajustar el saldo', description: error.message, variant: 'destructive' });
    toast({ title: 'Saldo corregido' });
    refrescarAbierta(abierta.id);
  }

  async function guardarDatos(campos: Partial<AccountBalance>) {
    if (!abierta) return;
    const { error } = await supabase.from('customer_accounts').update(campos).eq('id', abierta.id);
    if (error) return toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
    toast({ title: 'Datos guardados' });
    refrescarAbierta(abierta.id);
  }

  function exportar() {
    const blob = new Blob([accountsCsv(visibles)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fiado-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const historial = useMemo(() => withRunningBalance(movs).reverse(), [movs]);
  const link = abierta ? reminderLink(abierta.name, abierta.phone, abierta.balance) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><NotebookPen className="h-6 w-6 text-primary" /> Fiado</h1>
          <p className="text-muted-foreground">Clientes con cuenta corriente: lo que deben y lo que van pagando.</p>
        </div>
        <div className="flex gap-3">
          <Card className="border-dashed"><CardContent className="py-2.5 px-4 text-sm">
            <span className="text-muted-foreground">Total a cobrar: </span><span className="font-semibold">{formatPrice(totalPendiente)}</span>
          </CardContent></Card>
          <Card className="border-dashed"><CardContent className="py-2.5 px-4 text-sm">
            <span className="font-semibold">{deudores}</span> <span className="text-muted-foreground">cliente{deudores === 1 ? '' : 's'} con deuda</span>
          </CardContent></Card>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente por nombre o teléfono" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={soloDeuda} onCheckedChange={setSoloDeuda} /> Solo con deuda</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={verArchivados} onCheckedChange={setVerArchivados} /> Archivados</label>
        <Button variant="outline" onClick={exportar} disabled={!visibles.length}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button>
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo cliente</Button>
      </div>

      {cargando ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : visibles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <NotebookPen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {cuentas.length === 0 ? 'Todavía no hay clientes con fiado. Creá uno o elegí Fiado como forma de pago en el Mostrador.' : 'No hay clientes con ese filtro.'}
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {visibles.map((c) => (
            <button key={c.id} type="button" onClick={() => abrir(c)}
              className="text-left rounded-xl border bg-card px-4 py-3 hover:border-primary/60 transition-colors flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.phone || 'Sin teléfono'}{c.last_movement_at ? ` · último movimiento ${formatDate(c.last_movement_at)}` : ''}
                </p>
              </div>
              {c.credit_limit != null && c.balance > Number(c.credit_limit) * 0.8 && (
                <Badge variant="outline" className="hidden sm:inline-flex">Cerca del límite</Badge>
              )}
              <div className="text-right">
                <p className={cn('font-bold', c.balance > 0 ? 'text-destructive' : 'text-emerald-600')}>{formatPrice(c.balance)}</p>
                <p className="text-[11px] text-muted-foreground">{c.balance > 0 ? 'debe' : c.balance < 0 ? 'a favor' : 'al día'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Nuevo cliente */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cliente con fiado</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Nombre y apellido</Label><Input value={nuevo.name} onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })} autoFocus /></div>
            <div className="grid gap-1.5"><Label>Teléfono (para mandarle recordatorios)</Label><Input value={nuevo.phone} onChange={(e) => setNuevo({ ...nuevo, phone: e.target.value })} inputMode="tel" placeholder="261 555-1234" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Límite de fiado (opcional)</Label><Input value={nuevo.credit_limit} onChange={(e) => setNuevo({ ...nuevo, credit_limit: e.target.value })} inputMode="decimal" placeholder="Sin límite" /></div>
              {isAdmin && <div className="grid gap-1.5"><Label>Deuda que ya tenía</Label><Input value={nuevo.deuda} onChange={(e) => setNuevo({ ...nuevo, deuda: e.target.value })} inputMode="decimal" placeholder="0" /></div>}
            </div>
            <div className="grid gap-1.5"><Label>Nota (opcional)</Label><Textarea rows={2} value={nuevo.notes} onChange={(e) => setNuevo({ ...nuevo, notes: e.target.value })} placeholder="Ej: paga los viernes" /></div>
          </div>
          <DialogFooter><Button onClick={crearCliente} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear cliente'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle del cliente */}
      <Sheet open={!!abierta} onOpenChange={(v) => !v && setAbierta(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {abierta && (
            <>
              <SheetHeader><SheetTitle>{abierta.name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="rounded-xl border p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{abierta.balance > 0 ? 'Debe' : abierta.balance < 0 ? 'Tiene a favor' : 'Está al día'}</p>
                    <p className={cn('text-3xl font-bold', abierta.balance > 0 ? 'text-destructive' : 'text-emerald-600')}>{formatPrice(Math.abs(abierta.balance))}</p>
                    {abierta.credit_limit != null && <p className="text-xs text-muted-foreground">Límite: {formatPrice(Number(abierta.credit_limit))}</p>}
                  </div>
                  {link ? (
                    <Button asChild variant="outline"><a href={link} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4 mr-2" />Recordarle por WhatsApp</a></Button>
                  ) : abierta.balance > 0 ? <p className="text-xs text-muted-foreground max-w-[10rem] text-right">Cargale un teléfono para mandarle un recordatorio.</p> : null}
                </div>

                {/* Registrar pago */}
                <div className="rounded-xl border p-4 space-y-3">
                  <p className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" />Registrar un pago</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5"><Label>Monto</Label><Input value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} inputMode="decimal" placeholder={abierta.balance > 0 ? String(abierta.balance) : '0'} /></div>
                    <div className="grid gap-1.5"><Label>Forma de pago</Label>
                      <Select value={pago.metodo} onValueChange={(v) => setPago({ ...pago, metodo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAGO_METODOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input value={pago.nota} onChange={(e) => setPago({ ...pago, nota: e.target.value })} placeholder="Nota (opcional)" />
                  <div className="flex gap-2">
                    {abierta.balance > 0 && <Button variant="outline" onClick={() => setPago({ ...pago, monto: String(abierta.balance) })}>Paga todo</Button>}
                    <Button className="flex-1" onClick={registrarPago} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar pago'}</Button>
                  </div>
                </div>

                {/* Historial */}
                <div className="space-y-2">
                  <p className="font-semibold">Movimientos</p>
                  {cargandoMovs ? <p className="text-sm text-muted-foreground">Cargando...</p> : historial.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no tiene movimientos. Las compras fiadas se cargan desde el Mostrador eligiendo &ldquo;Fiado&rdquo;.</p>
                  ) : historial.map((m) => {
                    const orden = m.order_id ? ordenes[m.order_id] : undefined;
                    const detalle = orden ? orden.items.map((i) => `${i.quantity}× ${i.name}`).join(', ') : m.note;
                    return (
                      <div key={m.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{KIND_LABEL[m.kind]}{m.kind === 'pago' && m.payment_method ? ` · ${METODO_LABEL[m.payment_method] ?? m.payment_method}` : ''}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                            {detalle && <p className="text-xs text-muted-foreground mt-1 break-words">{detalle}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('font-semibold', Number(m.amount) > 0 ? 'text-destructive' : 'text-emerald-600')}>{Number(m.amount) > 0 ? '+' : '−'}{formatPrice(Math.abs(Number(m.amount)))}</p>
                            <p className="text-[11px] text-muted-foreground">saldo {formatPrice(m.saldo)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Datos del cliente */}
                <details className="rounded-xl border p-4">
                  <summary className="font-semibold cursor-pointer">Datos del cliente</summary>
                  <form className="grid gap-3 mt-3" onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const lim = String(f.get('credit_limit') ?? '').trim();
                    guardarDatos({ name: String(f.get('name')).trim(), phone: String(f.get('phone')).trim() || null, notes: String(f.get('notes')).trim() || null, credit_limit: lim ? montoValido(lim) : null });
                  }}>
                    <div className="grid gap-1.5"><Label>Nombre</Label><Input name="name" defaultValue={abierta.name} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Teléfono</Label><Input name="phone" defaultValue={abierta.phone ?? ''} inputMode="tel" /></div>
                      <div className="grid gap-1.5"><Label>Límite</Label><Input name="credit_limit" defaultValue={abierta.credit_limit ?? ''} inputMode="decimal" placeholder="Sin límite" /></div>
                    </div>
                    <div className="grid gap-1.5"><Label>Nota</Label><Textarea name="notes" rows={2} defaultValue={abierta.notes ?? ''} /></div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="outline" className="flex-1">Guardar datos</Button>
                      <Button type="button" variant="ghost" onClick={() => guardarDatos({ archived: !abierta.archived })}>
                        {abierta.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" />Reactivar</> : <><Archive className="h-4 w-4 mr-2" />Archivar</>}
                      </Button>
                    </div>
                  </form>
                </details>

                {isAdmin && (
                  <details className="rounded-xl border p-4">
                    <summary className="font-semibold cursor-pointer flex items-center gap-2"><Scale className="h-4 w-4" />Corregir saldo (solo dueño)</summary>
                    <p className="text-xs text-muted-foreground mt-2">Para cargar una deuda vieja o corregir un error. Positivo suma deuda, negativo la resta. Queda registrado con el motivo.</p>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <Input value={ajuste.monto} onChange={(e) => setAjuste({ ...ajuste, monto: e.target.value })} inputMode="decimal" placeholder="Ej: 5000 o -2000" />
                      <Input value={ajuste.nota} onChange={(e) => setAjuste({ ...ajuste, nota: e.target.value })} placeholder="Motivo" />
                    </div>
                    <Button variant="outline" className="w-full mt-3" onClick={registrarAjuste} disabled={guardando}>Aplicar ajuste</Button>
                  </details>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
