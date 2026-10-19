'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Store, LayoutDashboard, Package, FolderTree, ShoppingCart, ShoppingBag, LogOut, Menu, X, CreditCard, Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/admin/ventas', label: 'Mostrador', icon: ShoppingBag, adminOnly: false },
  { href: '/admin/productos', label: 'Productos', icon: Package, adminOnly: false },
  { href: '/admin/categorias', label: 'Categorías', icon: FolderTree, adminOnly: false },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart, adminOnly: false },
  { href: '/admin/comentarios', label: 'Comentarios', icon: MessageCircle, adminOnly: true },
  // Pagos (credenciales de Mercado Pago) y Usuarios son cosas que solo el
  // dueño debería ver o tocar - un empleado ni siquiera necesita saber que
  // existen. El servidor igual las bloquea aunque alguien entre por URL
  // directa (ver requireAdmin en las rutas /api/mercadopago/* y
  // /api/admin/users), esto es solo para no mostrarlas en el menú.
  { href: '/admin/pagos', label: 'Pagos', icon: CreditCard, adminOnly: true },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2 px-6 h-16 border-b shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-sm">Todo y Más</p>
          <p className="text-[10px] text-muted-foreground">Panel admin</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || profile?.role === 'admin')
          .map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
            >
              <button
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t shrink-0">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
            {profile?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {profile?.role === 'admin' ? 'Dueño' : 'Empleado'}
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm">Panel admin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex w-64 flex-col bg-card animate-slide-in-right">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
