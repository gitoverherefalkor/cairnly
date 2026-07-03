import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareVisualButtonProps {
  /** Public URL of the report to share (the "report" half). */
  shareUrl: string;
  /** Title used by the native share sheet. */
  title: string;
  /** Short blurb used by the native share sheet. */
  text: string;
  /** Optional path to the shareable graphic (the "visual" half). Omit to share link only. */
  imageSrc?: string;
  /** File name for the generated PNG. */
  fileName?: string;
  /** Button label. */
  label?: string;
}

/**
 * Rasterizes a self-contained SVG asset into a PNG File so it can ride along in
 * the native share sheet. Returns null if anything fails (we then share link-only).
 * Dimensions come from the SVG viewBox; we also inject width/height so browsers
 * that report a 0 natural size (e.g. Firefox) still draw the image.
 */
async function svgToPngFile(src: string, fileName: string, scale = 2): Promise<File | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    let svgText = await res.text();

    const vb = svgText.match(/viewBox="([\d.\s-]+)"/);
    let w = 1200;
    let h = 665;
    if (vb) {
      const parts = vb[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
    if (!/<svg[^>]*\swidth=/.test(svgText)) {
      svgText = svgText.replace(/<svg/, `<svg width="${w}" height="${h}"`);
    }

    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('svg failed to load'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) return null;
      return new File([png], fileName, { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

const ShareVisualButton: React.FC<ShareVisualButtonProps> = ({
  shareUrl,
  title,
  text,
  imageSrc,
  fileName = 'cairnly-report.png',
  label = 'Share these findings',
}) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied', description: 'The report link is on your clipboard.' });
    } catch {
      toast({
        title: "Couldn't share",
        description: 'Please copy the page URL from your browser manually.',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const file = imageSrc ? await svgToPngFile(imageSrc, fileName) : null;
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      const base: ShareData = { title, text, url: shareUrl };

      if (file && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ ...base, files: [file] });
      } else if (nav.share) {
        await nav.share(base);
      } else {
        await copyLink();
      }
    } catch (err) {
      // The user dismissing the native share sheet is not a failure.
      if ((err as Error)?.name === 'AbortError') return;
      await copyLink();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      aria-label={label}
      className="inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto rounded-full font-heading font-bold text-[13px] px-[18px] py-[10px] text-[#122E3B] bg-white border border-[#E2D8C2] hover:bg-[#F4ECDA] transition-colors disabled:opacity-60 disabled:cursor-default shrink-0"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} strokeWidth={2} />}
      {busy ? 'Preparing…' : label}
    </button>
  );
};

export default ShareVisualButton;
