'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, MessageCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase, type ProductComment } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const MAX_NAME = 60;
const MAX_BODY = 1000;
const COOLDOWN_MS = 30_000;
const COOLDOWN_KEY = 'todoymas_last_comment_at';

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('h-4 w-4', n <= value ? 'fill-accent text-accent' : 'text-muted-foreground/40')}
        />
      ))}
    </span>
  );
}

export function ProductComments({ productId }: { productId: string }) {
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('product_comments')
      .select('*')
      .eq('product_id', productId)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setComments((data as ProductComment[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const rated = comments.filter((c) => c.rating);
  const average = rated.length > 0 ? rated.reduce((sum, c) => sum + (c.rating ?? 0), 0) / rated.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanBody = body.trim();
    if (!cleanName || !cleanBody) {
      setErrorMsg('Completá tu nombre y el comentario.');
      return;
    }

    // Campo trampa para bots: una persona nunca lo ve ni lo completa. Si
    // viene lleno, fingimos que salió bien sin guardar nada.
    if (honeypot) {
      setSent(true);
      return;
    }

    try {
      const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) {
        setErrorMsg('Esperá unos segundos antes de enviar otro comentario.');
        return;
      }
    } catch {
      // sin localStorage no hay freno local, el servidor igual tiene el suyo
    }

    setSending(true);
    // Sin .select(): los comentarios nuevos quedan pendientes y el público no
    // tiene permiso de leerlos hasta que se aprueben.
    const { error } = await supabase.from('product_comments').insert({
      product_id: productId,
      author_name: cleanName,
      rating: rating > 0 ? rating : null,
      body: cleanBody,
      approved: false,
    });
    setSending(false);

    if (error) {
      setErrorMsg(
        error.message.includes('muchos comentarios')
          ? 'Estamos recibiendo muchos comentarios juntos. Probá de nuevo en unos minutos.'
          : 'No pudimos enviar tu comentario. Probá de nuevo.'
      );
      return;
    }

    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch {
      // ignorar
    }
    setSent(true);
    setName('');
    setBody('');
    setRating(0);
  }

  return (
    <section className="mt-12" aria-labelledby="comentarios-titulo">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 id="comentarios-titulo" className="text-xl md:text-2xl font-display font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Comentarios
        </h2>
        {rated.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stars value={Math.round(average)} />
            <span>
              {average.toFixed(1)} · {rated.length} {rated.length === 1 ? 'valoración' : 'valoraciones'}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-2xl bg-muted animate-pulse" />
              <div className="h-20 rounded-2xl bg-muted animate-pulse" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay comentarios sobre este producto. ¡Sé el primero en dejar el tuyo!
            </p>
          ) : (
            comments.map((c) => (
              <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.author_name}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                </div>
                {c.rating ? <Stars value={c.rating} className="mt-1" /> : null}
                <p className="mt-2 text-sm whitespace-pre-line break-words">{c.body}</p>
              </article>
            ))
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Dejá tu comentario</h3>

          {sent ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-success">
                <Check className="h-4 w-4 mt-0.5 shrink-0" />
                <p>¡Gracias! Tu comentario se va a publicar cuando lo revisemos.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSent(false)}>
                Escribir otro
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="comment-name">Tu nombre</Label>
                <Input
                  id="comment-name"
                  value={name}
                  maxLength={MAX_NAME}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Puntaje (opcional)</Label>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Puntaje">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                      onClick={() => setRating(rating === n ? 0 : n)}
                      className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={cn(
                          'h-6 w-6 transition-colors',
                          n <= rating ? 'fill-accent text-accent' : 'text-muted-foreground/40'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comment-body">Comentario</Label>
                <Textarea
                  id="comment-body"
                  value={body}
                  maxLength={MAX_BODY}
                  rows={4}
                  onChange={(e) => setBody(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {body.length}/{MAX_BODY}
                </p>
              </div>

              {/* Campo trampa anti-bots: oculto para personas */}
              <div className="hidden" aria-hidden="true">
                <label>
                  No completar
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </label>
              </div>

              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

              <Button type="submit" disabled={sending} className="w-full">
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar comentario
              </Button>
              <p className="text-xs text-muted-foreground">
                Los comentarios se publican después de que los revisamos.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
