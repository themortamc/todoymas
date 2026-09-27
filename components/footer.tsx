'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Phone, MapPin, Instagram, Facebook, CreditCard, Landmark, Wallet } from 'lucide-react';
import { supabase, type Category } from '@/lib/supabase';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { TikTokIcon } from '@/components/icons/tiktok-icon';
import { LogoMark } from '@/components/decorative-plants';
import { WHATSAPP_URL, WHATSAPP_CHANNEL_URL, INSTAGRAM_URL, TIKTOK_URL, FACEBOOK_URL } from '@/lib/contact';

export function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .is('parent_id', null)
        .order('name')
        .limit(6);
      if (data) setCategories(data as Category[]);
    }
    load();
  }, []);

  return (
    <footer className="mt-16">
      {/* Onda superior */}
      <div className="bg-background leading-[0]">
        <svg
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          className="h-[50px] w-full md:h-[70px]"
          aria-hidden="true"
        >
          <path
            d="M0,55 C240,90 480,10 720,40 C960,70 1200,85 1440,35 L1440,90 L0,90 Z"
            fill="hsl(var(--footer))"
          />
        </svg>
      </div>
      <div className="bg-footer text-footer-foreground">
        <div className="container mx-auto px-4 pb-8 pt-4 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <LogoMark className="h-12 w-12 shrink-0" />
                <div>
                  <span className="text-2xl font-display font-semibold leading-none block">Todo y Más</span>
                  <span className="font-script text-sm text-footer-foreground/70 leading-none">Un poco de todo, en un solo lugar ♡</span>
                </div>
              </div>
              <p className="text-sm text-footer-foreground/70">
                Tu tienda de confianza, con una gran variedad de rubros y productos, todo en un mismo lugar.
              </p>
              <p className="font-display font-semibold text-footer-foreground pt-1">Seguinos</p>
              <div className="flex items-center gap-2">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Escribinos por WhatsApp"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground text-footer hover:bg-white transition-colors"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Seguinos en Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground text-footer hover:bg-white transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Seguinos en Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground text-footer hover:bg-white transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href={TIKTOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Seguinos en TikTok"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground text-footer hover:bg-white transition-colors"
                >
                  <TikTokIcon className="h-4 w-4" />
                </a>
              </div>
              <p className="text-xs text-footer-foreground/80 leading-relaxed">
                ¿Querés recibir notificaciones de promociones y nuevos productos? Sumate a nuestro{' '}
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-footer-foreground underline underline-offset-2 hover:no-underline font-medium"
                >
                  canal de WhatsApp
                </a>.
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold mb-3 text-footer-foreground">Contacto</h3>
              <ul className="space-y-2 text-sm text-footer-foreground/70">
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /> Paseo España, Avenida España 86, Local 8</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> +54 9 261 665-7183</li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold mb-3 text-footer-foreground">Categorías</h3>
              <ul className="space-y-2 text-sm text-footer-foreground/70">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/catalogo?categoria=${cat.slug}`} className="hover:text-footer-foreground transition-colors">
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/catalogo" className="hover:text-footer-foreground transition-colors">
                    Ver todas
                  </Link>
                </li>
              </ul>
            </div>

            <div className="flex lg:justify-end items-start">
              <p className="font-script text-2xl md:text-3xl leading-snug text-footer-foreground/90 lg:text-right -rotate-2">
                Gracias<br />por ser parte<br />de este proyecto ♡
              </p>
            </div>
          </div>

          <div className="border-t border-footer-foreground/15 mt-8 pt-6">
            <h3 className="font-display font-semibold mb-3 text-footer-foreground text-sm">Medios de pago</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Go Cuotas', icon: Wallet },
                { label: 'Mercado Pago', icon: Landmark },
                { label: 'Tarjetas de crédito', icon: CreditCard },
                { label: 'Tarjetas de débito', icon: CreditCard },
                { label: 'Y más', icon: null },
              ].map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-footer-foreground/15 bg-footer-foreground/5 px-3 py-1.5 text-xs text-footer-foreground/80"
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-footer-foreground/15 mt-6 pt-6 text-center text-xs text-footer-foreground/65">
            <p>&copy; {new Date().getFullYear()} Todo y Más · Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
