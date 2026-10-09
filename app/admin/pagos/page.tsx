'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, Percent, Save, Unlink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const MP_ERROR_MESSAGES: Record<string, string> = {
  cancelado: 'Cancelaste la conexión con Mercado Pago.',
  faltan_datos: 'Mercado Pago no envió los datos esperados. Probá de nuevo.',
  estado_invalido: 'El enlace de conexión expiró o ya se usó. Probá de nuevo.',
  no_configurado: 'Falta configuración del lado del servidor para conectar Mercado Pago.',
  token_fallo: 'Mercado Pago rechazó la conexión. Probá de nuevo.',
  inesperado: 'Ocurrió un error inesperado al conectar. Probá de nuevo.',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercadopago_tarjeta: 'Mercado Pago — Tarjeta de crédito/débito',
  mercadopago_dinero: 'Mercado Pago — Dinero en cuenta',
  gocuotas: 'GoCuotas',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
  mostrador_tarjeta: 'Tarjeta de crédito/débito',
  mostrador_efectivo: 'Efectivo',
  mostrador_transferencia: 'Transferencia',
  mostrador_otro: 'Otro',
};

const SURCHARGE_COPY = {
  online: {
    title: 'Recargos online',
    description:
      'Se suman al total cuando el cliente paga desde la tienda online, según el método que elija en el checkout. Poné 0 para no cobrar recargo.',
  },
  mostrador: {
    title: 'Recargos en mostrador',
    description:
      'Se suman automáticamente al total cuando registrás una venta en mostrador, según el método de pago que elijas. Poné 0 para no cobrar recargo.',
  },
} as const;

function SurchargesCard({ scope }: { scope: 'online' | 'mostrador' }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<{ payment_method: string; surcharge_percent: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_surcharges')
      .select('payment_method, surcharge_percent')
      .order('payment_method');
    if (!error && data) {
      const all = data as { payment_method: string; surcharge_percent: number }[];
      setRows(all.filter((r) => r.payment_method.startsWith('mostrador_') === (scope === 'mostrador')));
    }
    setLoading(false);
  }

  function updateValue(method: string, value: string) {
    const num = value === '' ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setRows((prev) => prev.map((r) => (r.payment_method === method ? { ...r, surcharge_percent: num } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      for (const row of rows) {
        const { error } = await supabase
          .from('payment_surcharges')
          .update({ surcharge_percent: row.surcharge_percent, updated_at: new Date().toISOString() })
          .eq('payment_method', row.payment_method);
        if (error) throw error;
      }
      setNotice('Recargos actualizados. Van a aplicarse desde el próximo pedido.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos guardar los recargos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="h-5 w-5" />
          {SURCHARGE_COPY[scope].title}
        </CardTitle>
        <CardDescription>{SURCHARGE_COPY[scope].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <div className="rounded-lg border border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400 px-4 py-2 text-sm">
            {notice}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.payment_method} className="flex items-center justify-between gap-4">
                  <Label className="flex-1 font-normal">
                    {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
                  </Label>
                  <div className="relative w-28 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.5"
                      disabled={!isAdmin}
                      value={row.surcharge_percent}
                      onChange={(e) => updateValue(row.payment_method, e.target.value)}
                      className="pr-7"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {isAdmin ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar recargos
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Solo un administrador puede cambiar los recargos.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PagosContent() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [mpUserId, setMpUserId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accessToken = session?.access_token;

  async function fetchStatus() {
    if (!accessToken) return;
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/mercadopago/oauth/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setConnected(data.connected);
        setMpUserId(data.mpUserId);
      }
    } catch {
      // silent - the card will just show "no conectado"
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const mpConnected = searchParams.get('mp_connected');
    const mpError = searchParams.get('mp_error');

    if (mpConnected) {
      setNotice('¡Cuenta de Mercado Pago conectada con éxito!');
      router.replace('/admin/pagos');
    } else if (mpError) {
      setErrorMsg(MP_ERROR_MESSAGES[mpError] || 'No pudimos conectar Mercado Pago.');
      router.replace('/admin/pagos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnect() {
    if (!accessToken) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mercadopago/oauth/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg((data.error || 'No pudimos iniciar la conexión.') + (data.details ? "\nDetalles: " + data.details : ''));
        setConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErrorMsg('No pudimos iniciar la conexión.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!accessToken) return;
    if (!confirm('¿Seguro que querés desconectar la cuenta de Mercado Pago? Los clientes no van a poder pagar con Mercado Pago hasta que la vuelvas a conectar.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/mercadopago/oauth/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        setMpUserId(null);
        setNotice('Cuenta de Mercado Pago desconectada.');
      } else {
        setErrorMsg(data.error || 'No pudimos desconectar la cuenta.');
      }
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conectá tu propia cuenta de Mercado Pago para poder cobrar. Nunca compartís tu contraseña ni ninguna clave con nadie: iniciás sesión directo en Mercado Pago.
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400 px-4 py-3 text-sm">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Mercado Pago
          </CardTitle>
          <CardDescription>
            Necesario para que los clientes puedan pagar online con tarjeta desde el checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando estado de la conexión...
            </div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Cuenta conectada{mpUserId ? ` (ID de vendedor: ${mpUserId})` : ''}
              </div>
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Desconectar cuenta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Todavía no conectaste ninguna cuenta de Mercado Pago.
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Conectar con Mercado Pago
              </Button>
              <p className="text-xs text-muted-foreground">
                Te vamos a llevar a mercadopago.com para que inicies sesión con tu cuenta y autorices la conexión. No vas a escribir ninguna clave acá.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <SurchargesCard scope="online" />
      <SurchargesCard scope="mostrador" />
    </div>
  );
}

export default function AdminPagosPage() {
  return (
    <Suspense fallback={null}>
      <PagosContent />
    </Suspense>
  );
}
