import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';

interface ScreenshotSlotProps {
  src: string;
  alt: string;
  meta: string;
  /** Tailwind aspect-ratio class, e.g. 'aspect-[4/3]'. */
  aspect: string;
  /** Use the dark-surface frame variant (for slots placed on the teal canvas). */
  onDark?: boolean;
}

/**
 * A framed product screenshot. Clicking it opens a full-screen lightbox where
 * the image can be toggled to native-resolution zoom (with pan via scroll).
 */
const ScreenshotSlot: React.FC<ScreenshotSlotProps> = ({ src, alt, meta, aspect, onDark }) => {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) {
      setZoomed(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge screenshot: ${alt}`}
        className={`lp-screenshot-slot ${onDark ? 'lp-on-dark' : ''} ${aspect} w-full block`}
      >
        <div className="lp-screenshot-slot__meta">{meta}</div>
        <img className="lp-screenshot-slot__img" src={src} alt={alt} />
        <span className="lp-screenshot-slot__zoom" aria-hidden="true">
          <ZoomIn size={16} strokeWidth={2.2} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: 'rgba(10,18,23,0.93)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-5 right-5 text-white/75 hover:text-white p-2 z-10"
            >
              <X size={28} />
            </button>

            <div
              className={
                zoomed
                  ? 'overflow-auto max-h-[92vh] max-w-[96vw] rounded-lg'
                  : 'flex items-center justify-center'
              }
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <img
                src={src}
                alt={alt}
                onClick={() => setZoomed((z) => !z)}
                className={zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}
                style={
                  zoomed
                    ? { maxWidth: 'none', maxHeight: 'none', display: 'block' }
                    : { maxHeight: '86vh', maxWidth: '92vw', objectFit: 'contain', borderRadius: 12, display: 'block' }
                }
              />
            </div>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/55 text-[12px] font-medium">
              {zoomed ? 'Click image to fit · Esc to close' : 'Click image to zoom in · Esc to close'}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ScreenshotSlot;
