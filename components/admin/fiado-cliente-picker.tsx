'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import type { AccountBalance } from '@/lib/fiado';

// Buscador de clientes con cuenta corriente para el Mostrador. Si no existe, lo crea en el momento.
export function FiadoClientePicker({ value, onChange }: { value: AccountBalance | null; onChange: (c: AccountBalance | null) => void }) {
  const { toast } = useToast();
  const [cuentas, setCuentas] = useState<AccountBalance[]>([]);
  const [q, setQ] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    supabase.from('account_balances').select('*').eq('archived', false).order('name')
      .then(({ data }) => setCuentas(((data as AccountBalance[]) ?? []).map((c) => ({ ...c, balance: Number(c.balance) }))));
  }, []);

  const coincidencias = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return cuentas.filter((c) => c.name.toLowerCase().includes(t) || (c.phone ?? '').includes(t)).slice(0, 6);
  }, [cuentas, q]);

  async function crear() {
    const name = q.trim();
    if (!name) return;
    setCreando(true);
    const { data, error } = await supabase.from('customer_accounts').insert({ name }).select().single();
    setCreando(false);
    if (error || !data) return toast({ title: 'No se pudo crear el cliente', description: error?.message, variant: 'destructive' });
    const nueva = { ...(data as AccountBalance), balance: 0, last_movement_at: null };
    setCuentas((prev) => [...prev, nueva]);
    setQ('');
    onChange(nueva);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm">
        <span className="font-medium truncate flex-1">{value.name}</span>
        <span className={value.balance > 0 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
          {value.balance > 0 ? `debe ${formatPrice(value.balance)}` : 'al día'}
        </span>
        <button type="button" aria-label="Cambiar cliente" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const existeExacto = cuentas.some((c) => c.name.trim().toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá o escribí el nombre" className="h-9" />
      {q.trim() && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {coincidencias.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChange(c); setQ(''); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent text-left">
              <span className="truncate">{c.name}</span>
              <span className={c.balance > 0 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
                {c.balance > 0 ? `debe ${formatPrice(c.balance)}` : 'al día'}
              </span>
            </button>
          ))}
          {!existeExacto && (
            <Button type="button" variant="ghost" className="w-full justify-start rounded-none h-9 text-sm" onClick={crear} disabled={creando}>
              <Plus className="h-3.5 w-3.5 mr-2" />{creando ? 'Creando...' : `Crear cliente "${q.trim()}"`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
