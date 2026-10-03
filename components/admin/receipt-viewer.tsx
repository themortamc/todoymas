'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

// El bucket 'payment-receipts' es privado (puede tener datos bancarios del
// cliente), así que para mostrarlo acá generamos una URL firmada de corta
// duración en vez de una URL pública fija.
export function ReceiptViewer({ receiptPath }: { receiptPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setErrorMsg(null);
    if (!receiptPath) return;

    let cancelled = false;
    setLoading(true);
    supabase.storage
      .from('payment-receipts')
      .createSignedUrl(receiptPath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setErrorMsg('No pudimos generar el link del comprobante.');
        } else {
          setUrl(data.signedUrl);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [receiptPath]);

  if (!receiptPath) {
    return <p className="text-sm text-muted-foreground">El cliente todavía no adjuntó ningún comprobante.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando comprobante...
      </div>
    );
  }

  if (errorMsg || !url) {
    return <p className="text-sm text-destructive">{errorMsg || 'No se pudo cargar el comprobante.'}</p>;
  }

  const isPdf = receiptPath.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-2">
      {!isPdf && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Comprobante de transferencia" className="max-h-64 rounded-lg border border-border" />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant="outline" size="sm">
          {isPdf ? <FileText className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
          Ver comprobante completo
        </Button>
      </a>
    </div>
  );
}
