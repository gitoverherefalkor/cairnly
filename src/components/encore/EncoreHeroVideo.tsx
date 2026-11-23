import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Close as DialogClose } from '@radix-ui/react-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

// Bump when the video file is replaced, so browsers do not serve the old one.
const VIDEO_VERSION = '202611231';
const POSTER = `/videos/encore-explainer-nl-poster.jpg?v=${VIDEO_VERSION}`;

/**
 * Explainer video for the Encore hero.
 * The hero shows a large poster with a play button; pressing it opens the
 * video in a modal that fills most of the screen. Nothing but the small
 * poster loads until then, and it never autoplays before the visitor asks.
 * Closes with the big "Sluiten" button, Esc, or a click outside the video.
 * The video is Dutch, so the parent only renders this on the Dutch page.
 */
const EncoreHeroVideo: React.FC = () => {
  const { t } = useTranslation('encore');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('hero.videoPlay')}
        className="group relative block w-full aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15 bg-black"
      >
        <img src={POSTER} alt="" className="absolute inset-0 w-full h-full object-cover" width={1280} height={720} />
        <span className="absolute inset-0 bg-[#122E3B]/25 group-hover:bg-[#122E3B]/10 transition-colors" />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className="flex items-center justify-center w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#D4A024] text-[#122E3B] shadow-xl group-hover:scale-105 transition-transform">
            <Play size={44} strokeWidth={0} fill="currentColor" className="ml-2" />
          </span>
          <span className="px-5 py-2 rounded-full bg-[#122E3B]/80 text-white text-lg md:text-xl font-semibold">
            {t('hero.videoPlay')}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-none w-[96vw] md:w-[92vw] lg:w-[88vw] max-w-[1600px] p-3 md:p-4 gap-3 bg-[#122E3B] border-white/10 sm:rounded-2xl [&>button.absolute]:hidden"
        >
          <DialogTitle className="sr-only">{t('hero.videoLabel')}</DialogTitle>
          <DialogDescription className="sr-only">{t('hero.videoLabel')}</DialogDescription>
          <div className="w-full aspect-video max-h-[calc(100vh-7rem)] mx-auto rounded-xl overflow-hidden bg-black">
            {/* Mounted only while open, so closing the modal stops the video. */}
            <video
              className="w-full h-full"
              controls
              autoPlay
              playsInline
              poster={POSTER}
              aria-label={t('hero.videoLabel')}
            >
              <source src={`/videos/encore-explainer-nl.webm?v=${VIDEO_VERSION}`} type="video/webm" />
              <source src={`/videos/encore-explainer-nl.mp4?v=${VIDEO_VERSION}`} type="video/mp4" />
            </video>
          </div>
          <DialogClose className="justify-self-center inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4A024]">
            <X size={20} />
            {t('hero.videoClose')}
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EncoreHeroVideo;
