// Fiado / cuentas corrientes: tipos y cálculos puros (sin Supabase) para poder testearlos.
import { formatPrice } from './format';
import { TRANSFER_ALIAS } from './contact';

export type MovementKind = 'compra' | 'pago' | 'ajuste';

export type CustomerAccount = {
  id: string; name: string; phone: string | null; notes: string | null;
  credit_limit: number | null; archived: boolean; created_at: string;
};
export type AccountBalance = CustomerAccount & { balance: number; last_movement_at: string | null };
export type AccountMovement = {
  id: string; account_id: string; kind: MovementKind; amount: number; order_id: string | null;
  payment_method: string | null; note: string | null; created_at: string; created_by: string | null;
};

export const KIND_LABEL: Record<MovementKind, string> = { compra: 'Compra fiada', pago: 'Pago', ajuste: 'Ajuste' };

/** Movimientos de más viejo a más nuevo con el saldo acumulado después de cada uno. */
export function withRunningBalance<T extends { amount: number | string; created_at: string }>(movs: T[]) {
  const sorted = [...movs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let saldo = 0;
  return sorted.map((m) => {
    saldo = Math.round((saldo + Number(m.amount)) * 100) / 100;
    return { ...m, saldo };
  });
}

/** Normaliza un teléfono argentino para wa.me (código país 54 y 9 para celulares). */
export function waPhone(phone: string | null | undefined): string | null {
  let d = (phone ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('9')) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // saca el "15" de celulares escritos a la vieja usanza
  if (d.length !== 10) return null;
  return `549${d}`;
}

/** Link de WhatsApp con el recordatorio del saldo ya escrito, o null si no hay teléfono válido. */
export function reminderLink(name: string, phone: string | null, balance: number): string | null {
  const tel = waPhone(phone);
  if (!tel || balance <= 0) return null;
  const nombre = name.trim().split(/\s+/)[0];
  const texto = `Hola ${nombre}, ¿cómo estás? Te escribo de Todo y Más para recordarte que tenés un saldo pendiente de ${formatPrice(balance)} en tu cuenta. Podés abonarlo en el local o por transferencia al alias ${TRANSFER_ALIAS}. ¡Gracias!`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (separado por ;) que abre bien en Excel en español. */
export function accountsCsv(rows: AccountBalance[]): string {
  const head = ['Cliente', 'Teléfono', 'Saldo', 'Límite', 'Último movimiento'];
  const body = rows.map((r) => [
    r.name, r.phone ?? '', Number(r.balance).toFixed(2).replace('.', ','),
    r.credit_limit == null ? '' : Number(r.credit_limit).toFixed(2).replace('.', ','),
    r.last_movement_at ? r.last_movement_at.slice(0, 10) : '',
  ]);
  return '﻿' + [head, ...body].map((l) => l.map(csvCell).join(';')).join('\r\n');
}
