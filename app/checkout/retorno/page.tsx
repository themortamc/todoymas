'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Clock, X } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { MandalaLine, Bloom, Vine } from '@/components/decorative-plants';
import { WHATSAPP_NUMBER } from '@/lib/contact';

function statusFromParams(searchParams: URLSearchParams) {
  // Mercado Pago appends either "status" or "collection_status" depending on flow version.
  return searchParams.get('collection_status') || searchParams.get('status') || 'pending';
}

function RetornoContent() {
  const searchParams = useSearchParams();
  const status = statusFromParams(searchParams);
  const orderId = searchParams.get('order') || searchParams.get('external_reference');
  const shortOrderId = orderId?.slice(0, 8);

  const config = {
    approved: {
      icon: Check,
      iconClass: 'bg-success/10 text-success',
      title: '¡Pago aprobado!',
      description: 'Tu pago se acreditó correctamente. Ya estamos preparando tu pedido.',
    },
    pending: {
      icon: Clock,
      iconClass: 'bg-warning/10 text-warning',
      title: 'Pago en proceso',
      description: 'Tu pago está siendo procesado. Te avisaremos por WhatsApp en cuanto se confirme.',
    },
    in_process: {
      icon: Clock,
      iconClass: 'bg-warning/10 text-warning',
      title: 'Pago en proceso',
      description: 'Tu pago está siendo procesado. Te avisaremos por WhatsApp en cuanto se confirme.',
    },
    rejected: {
      icon: X,
      iconClass: 'bg-destructive/10 text-destructive',
      title: 'El pago no pudo procesarse',
      description: 'Tu pedido quedó registrado, pero el pago fue rechazado. Podés intentar de nuevo o coordinar otro medio de pago por WhatsApp.',
    },
  } as const;

  const { icon: Icon, iconClass, title, description } =
    config[status as keyof typeof config] ?? config.pending;

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/60">
        <MandalaLine className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 text-primary/15" />
        <Bloom className="pointer-events-none absolute left-8 top-8 h-14 w-14 text-brand-clay/40 hidden sm:block" />
        <Bloom className="pointer-events-none absolute right-8 bottom-8 h-16 w-16 text-primary/25 hidden sm:block" />
        <Vine className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 w-72 text-primary/30 hidden md:block" />
      <div className="container relative mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className={`flex h-20 w-20 mx-auto items-center justify-center rounded-full mb-6 ${iconClass}`}>
            <Icon className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground mb-1">{description}</p>
          {shortOrderId && (
            <p className="text-sm text-muted-foreground mb-6">
              Número de pedido: <span className="font-mono font-medium text-foreground">{shortOrderId}</span>
            </p>
          )}

          <div className="space-y-3 mt-6">
            {status === 'rejected' && (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Hola! Tuve un problema pagando el pedido ${shortOrderId ?? ''} con Mercado Pago. ¿Me ayudan a coordinar el pago?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="w-full">
                  Coordinar por WhatsApp
                </Button>
              </a>
            )}
            <Link href="/catalogo">
              <Button size="lg" className="w-full">
                Seguir comprando
              </Button>
            </Link>
          </div>
        </div>
      </div>
      </div>
    </StoreLayout>
  );
}

export default function RetornoPage() {
  return (
    <Suspense fallback={null}>
      <RetornoContent />
    </Suspense>
  );
}
