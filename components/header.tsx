'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, Search, ShoppingCart, Heart } from 'lucide-react';
import { LogoMark } from './decorative-plants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { CartDrawer } from './cart-drawer';
import { CategoryMenu } from './category-menu';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount, isCartOpen, setCartOpen } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalogo?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileOpen(false);
    }
  };

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        'relative px-3 py-2 text-sm font-medium transition-colors hover:text-primary',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary" />
      )}
    </Link>
  );

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full bg-background transition-shadow duration-300',
          scrolled && 'shadow-soft'
        )}
      >
        <div className="container mx-auto px-4 border-b border-border">
          <div className="flex items-center gap-3 h-20">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="flex items-center gap-2 font-display font-semibold text-xl">
                    <LogoMark className="h-5 w-5 text-primary shrink-0" />
                    Todo y Más
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-4">
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="¿Qué estás buscando?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-full"
                    />
                  </form>
                  <nav className="flex flex-col gap-1">
                    <Link href="/" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        Inicio
                      </Button>
                    </Link>
                    <Link href="/catalogo?destacados=true" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        Ofertas
                      </Button>
                    </Link>
                  </nav>
                  <CategoryMenu onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 text-primary shrink-0">
                <LogoMark className="h-9 w-9" />
              </div>
              <div className="hidden sm:block">
                <span className="text-2xl font-display font-semibold leading-none text-primary">Todo y Más</span>
                <p className="font-script text-sm text-accent-ink leading-none mt-1">Un poco de todo, en un solo lugar ♡</p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 mx-auto">
              {navLink('/', 'Inicio', pathname === '/')}
              <CategoryMenu />
              {navLink('/catalogo?destacados=true', 'Ofertas', false)}
            </nav>

            {/* Desktop search */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs relative ml-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="¿Qué estás buscando?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full bg-card border-border/60 shadow-sm"
              />
            </form>

            {/* Wishlist */}
            <Link href="/favoritos" className="shrink-0">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold px-1 ring-2 ring-background">
                    {wishlistCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative shrink-0 rounded-full"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold px-1 ring-2 ring-background">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>

          {/* Mobile search */}
          <form onSubmit={handleSearch} className="md:hidden relative pb-3">
            <Search className="absolute left-4 top-5 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="¿Qué estás buscando?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-card border-border/60 shadow-sm"
            />
          </form>
        </div>
      </header>

      <CartDrawer open={isCartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
