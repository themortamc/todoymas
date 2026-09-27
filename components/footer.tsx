'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Phone, MapPin, Instagram, Facebook, CreditCard, Landmark, Wallet, Heart } from 'lucide-react';
import { supabase, type Category } from '@/lib/supabase';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { TikTokIcon } from '@/components/icons/tiktok-icon';
import { LeafScatter, LeafSprig, Bloom, Vine, Mandala, LogoMark } from '@/components/decorative-plants';
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
    <footer className="relative overflow-hidden bg-footer bg-mandala-tile-light text-footer-foreground mt-16">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-70" />
      <Mandala className="pointer-events-none absolute -left-16 -bottom-24 h-80 w-80 text-primary-foreground hidden md:block" />
      <LeafScatter className="absolute -right-10 -top-10 h-44 w-44 text-primary opacity-20 sm:-right-16 sm:-top-16 sm:h-72 sm:w-72" />
      <LeafSprig className="absolute -bottom-6 left-3 h-28 w-16 text-primary opacity-15 sm:-bottom-8 sm:left-8 sm:h-40 sm:w-24" />
      <LeafSprig className="absolute -bottom-4 right-6 h-20 w-12 text-accent opacity-15 rotate-[200deg] sm:hidden" />
      <Bloom className="pointer-events-none absolute right-8 bottom-24 h-16 w-16 text-accent opacity-10 hidden sm:block md:right-20" />
      <Vine className="pointer-events-none absolute -bottom-1 left-0 h-6 w-full text-primary opacity-[0.08]" />
      <div className="container mx-auto px-4 py-12 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-footer-foreground/30 text-footer-foreground shrink-0">
                <LogoMark className="h-6 w-6" />
              </div>
              <div>
                <span className="text-2xl font-display font-semibold leading-none block">Todo y Más</span>
                <span className="font-script text-sm text-footer-foreground/70 leading-none">Un poco de todo, en un solo lugar ♡</span>
              </div>
            </div>
            <p className="text-sm text-footer-foreground/70">
              Tu tienda de confianza, con una gran variedad de rubros y productos, todo en un mismo lugar.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Escribinos por WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground/10 text-footer-foreground hover:bg-[#25D366] hover:text-white transition-colors"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguinos en Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground/10 text-footer-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguinos en Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground/10 text-footer-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguinos en TikTok"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-footer-foreground/10 text-footer-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <TikTokIcon className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-footer-foreground/80 pt-1 leading-relaxed">
              ¿Querés recibir notificaciones de promociones y nuevos productos? Sumate a nuestro{' '}
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                canal de WhatsApp
              </a>.
            </p>
          </div>

          <div>
            <h3 className="font-display font-semibold mb-3 text-footer-foreground">Categorías</h3>
            <ul className="space-y-2 text-sm text-footer-foreground/70">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/catalogo?categoria=${cat.slug}`} className="hover:text-primary transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/catalogo" className="hover:text-primary transition-colors">
                  Ver todas
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold mb-3 text-footer-foreground">Información</h3>
            <ul className="space-y-2 text-sm text-footer-foreground/70">
              <li><Link href="/catalogo" className="hover:text-primary transition-colors">Catálogo completo</Link></li>
              <li><Link href="/carrito" className="hover:text-primary transition-colors">Carrito</Link></li>
              <li><Link href="/checkout" className="hover:text-primary transition-colors">Checkout</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold mb-3 text-footer-foreground">Contacto</h3>
            <ul className="space-y-2 text-sm text-footer-foreground/70">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /> Paseo España, Avenida España 86, Local 8</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> +54 9 261 665-7183</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-footer-foreground/10 mt-8 pt-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div>
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
          <p className="font-script text-xl text-footer-foreground/90 flex items-center gap-1.5 shrink-0">
            Gracias por ser parte de este proyecto <Heart className="h-4 w-4 fill-current" />
          </p>
        </div>

        <div className="border-t border-footer-foreground/10 mt-6 pt-6 text-center text-xs text-footer-foreground/65">
          <p>&copy; {new Date().getFullYear()} Todo y Más · Todos los derechos reservados</p>
        </div>
      </div>
    </footer>
  );
}
