import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Category = { id: string; name: string; slug: string; parent_id: string | null; icon: string | null; created_at: string; };
export type Product = { id: string; name: string; description: string | null; price: number; stock: number; category_id: string | null; subcategory_id: string | null; images: string[]; featured: boolean; has_variants: boolean; created_at: string; };
export type ProductVariant = { id: string; product_id: string; group_name: string; label: string; color_hex: string | null; image_url: string | null; stock: number; sort_order: number; created_at: string; };
export type OrderItem = { product_id?: string; name: string; price: number; quantity: number; image?: string; variant?: string; };
export type Order = { id: string; customer_name: string; customer_email: string | null; customer_phone: string | null; status: string; shipping_method: string; address: string | null; city: string | null; notes: string | null; total: number; surcharge_amount: number; items: OrderItem[]; created_at: string; channel: 'online' | 'mostrador' | string; payment_method: string | null; payment_status: 'pendiente' | 'aprobado' | 'rechazado' | 'en_proceso' | string; mp_preference_id: string | null; mp_payment_id: string | null; created_by: string | null; receipt_path: string | null; stock_committed_at: string | null; };
export type Profile = { id: string; email: string; role: 'admin' | 'empleado'; created_at: string; };
export type PaymentSurcharge = { payment_method: string; surcharge_percent: number; updated_at: string; };
export type ProductWithRelations = Product & { category?: Category | null; subcategory?: Category | null; };
