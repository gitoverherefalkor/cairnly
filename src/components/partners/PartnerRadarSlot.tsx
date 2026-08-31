import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon } from 'lucide-react';
import ScreenshotSlot from '@/components/landing/ScreenshotSlot';
import { RADAR_IMAGE_PATH } from './constants';

/**
 * The radar chart from the specimen report, shown under the hero subhead.
 *
 * The asset is delivered separately, so the image is probed before it renders:
 * once it loads we hand off to the shared ScreenshotSlot (framing + zoom
 * lightbox), and until then (or if it never arrives) the dashed placeholder
 * frame stands in. That keeps the page shippable ahead of the artwork and
 * avoids a broken-image icon in the hero if it slips.
 */
const PartnerRadarSlot: React.FC = () => {
  const { t } = useTranslation('partners');
  const [status, setStatus] = useState<'probing' | 'ready' | 'missing'>('probing');

  useEffect(() => {
    const img = new Image();
    img.onload = () => setStatus('ready');
    img.onerror = () => setStatus('missing');
    img.src = RADAR_IMAGE_PATH;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  if (status === 'ready') {
    return (
      <ScreenshotSlot
        src={RADAR_IMAGE_PATH}
        alt={t('hero.radarAlt')}
        meta={t('hero.radarMeta')}
        aspect="aspect-[16/10]"
        onDark
      />
    );
  }

  return (
    <div
      className="lp-screenshot-slot lp-on-dark lp-screenshot-slot--placeholder aspect-[16/10] w-full"
      role="img"
      aria-label={t('hero.radarAlt')}
    >
      <div className="lp-screenshot-slot__inner">
        <ImageIcon size={30} strokeWidth={1.6} />
        <span className="lp-screenshot-slot__label">{t('hero.radarPendingLabel')}</span>
        <span className="lp-screenshot-slot__desc">{t('hero.radarPendingDesc')}</span>
      </div>
    </div>
  );
};

export default PartnerRadarSlot;
