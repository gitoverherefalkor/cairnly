import React, { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Bump when the video file is replaced, so browsers do not serve the old one.
const VIDEO_VERSION = '202611231';

/**
 * Click-to-play explainer for the Encore hero.
 * Nothing downloads until the visitor presses play (only the small poster
 * loads), and it never autoplays: the soundtrack should be a choice, and
 * the native controls give a clear pause/volume/fullscreen for this audience.
 * The video is Dutch, so the parent only renders it on the Dutch page.
 */
const EncoreHeroVideo: React.FC = () => {
  const { t } = useTranslation('encore');
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const start = () => {
    setStarted(true);
    // Play right after the <video> mounts; the click counts as the user gesture.
    requestAnimationFrame(() => { videoRef.current?.play().catch(() => {}); });
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15 bg-black">
      {started ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full"
          controls
          playsInline
          preload="auto"
          poster={`/videos/encore-explainer-nl-poster.jpg?v=${VIDEO_VERSION}`}
          aria-label={t('hero.videoLabel')}
        >
          <source src={`/videos/encore-explainer-nl.webm?v=${VIDEO_VERSION}`} type="video/webm" />
          <source src={`/videos/encore-explainer-nl.mp4?v=${VIDEO_VERSION}`} type="video/mp4" />
        </video>
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={t('hero.videoPlay')}
          className="group absolute inset-0 w-full h-full"
        >
          <img
            src={`/videos/encore-explainer-nl-poster.jpg?v=${VIDEO_VERSION}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            width={1280}
            height={720}
          />
          <span className="absolute inset-0 bg-[#122E3B]/25 group-hover:bg-[#122E3B]/10 transition-colors" />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#D4A024] text-[#122E3B] shadow-xl group-hover:scale-105 transition-transform">
              <Play size={38} strokeWidth={0} fill="currentColor" className="ml-1.5" />
            </span>
            <span className="px-4 py-1.5 rounded-full bg-[#122E3B]/80 text-white text-base md:text-lg font-semibold">
              {t('hero.videoPlay')}
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

export default EncoreHeroVideo;
