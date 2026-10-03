'use client';

import { useRef, useState } from 'react';
import { Check, FileText, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';

const BUCKET = 'payment-receipts';
const MAX_SIZE_MB = 8;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function ReceiptUploader({ orderId }: { orderId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setErrorMsg(null);

    if (!ACCEPTED.includes(file.type)) {
      setErrorMsg('Subí una foto (JPG, PNG) o un PDF del comprobante.');
      return;
    }

    setUploading(true);
    try {
      // Las fotos sacadas con el celular se comprimen antes de subir (igual
      // que las fotos de producto del panel); un PDF se sube tal cual.
      const toUpload = file.type === 'application/pdf' ? file : await compressImage(file);

      if (toUpload.size > MAX_SIZE_MB * 1024 * 1024) {
        setErrorMsg(`El archivo pesa más de ${MAX_SIZE_MB}MB.`);
        setUploading(false);
        return;
      }

      const ext = file.type === 'application/pdf' ? 'pdf' : toUpload.name.split('.').pop() || 'jpg';
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, toUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: toUpload.type || undefined,
      });

      if (uploadError) {
        setErrorMsg('No pudimos subir el comprobante. Probá de nuevo.');
        setUploading(false);
        return;
      }

      const { error: attachError } = await supabase.rpc('attach_payment_receipt', {
        p_order_id: orderId,
        p_receipt_path: path,
      });

      if (attachError) {
        setErrorMsg('El archivo se subió pero no pudimos asociarlo al pedido. Mandalo igual por WhatsApp.');
        setUploading(false);
        return;
      }

      setFileName(file.name);
      setDone(true);
    } catch {
      setErrorMsg('No pudimos subir el comprobante. Probá de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <Check className="h-4 w-4" />
        Comprobante recibido{fileName ? `: ${fileName}` : ''}. ¡Gracias!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 mr-2" />
        )}
        {uploading ? 'Subiendo...' : 'Adjuntar comprobante'}
      </Button>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Foto o PDF, hasta {MAX_SIZE_MB}MB
      </p>
      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
    </div>
  );
}
