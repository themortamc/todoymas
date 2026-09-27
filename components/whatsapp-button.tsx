import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { WHATSAPP_URL } from '@/lib/contact';

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-brand-cream shadow-soft-lg transition-transform hover:scale-105 active:scale-95"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
