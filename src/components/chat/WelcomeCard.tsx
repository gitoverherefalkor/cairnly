import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import atlasFigure from '@/logos/live/cairnly_logo_symbol_only.png';

interface WelcomeCardProps {
  onReady: () => void;
  isLoading?: boolean;
  // On /chat the card sits beside the report sidebar, whose fixed panel is
  // centred in the viewport. With this on, the card measures that panel and
  // takes exactly its height (from md up), so their top and bottom edges
  // line up on any screen size.
  matchSidebar?: boolean;
}

// Height of the desktop sidebar panel (ReportSidebar marks it with
// data-report-sidebar-panel), tracked live so a collapse/expand or a window
// resize keeps the card in step. 0 when no panel is on screen (mobile).
function useSidebarPanelHeight(enabled: boolean): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let observer: ResizeObserver | null = null;
    let observed: Element | null = null;
    const measure = () => {
      const panel = document.querySelector('[data-report-sidebar-panel]');
      if (panel !== observed) {
        observer?.disconnect();
        observed = panel;
        if (panel && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure);
          observer.observe(panel);
        }
      }
      setHeight(panel ? Math.round(panel.getBoundingClientRect().height) : 0);
    };
    measure();
    // The panel mounts in a sibling subtree; poll briefly so the first
    // measurement does not miss it, then rely on the observer + resize.
    const retry = window.setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [enabled]);
  return height;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({
  onReady,
  isLoading = false,
  matchSidebar = false,
}) => {
  const { t } = useTranslation('chat');
  const panelHeight = useSidebarPanelHeight(matchSidebar);
  return (
    <div className="w-full max-w-[800px] mx-auto py-4">
      <Card
        className={`border-2 border-atlas-blue/20 shadow-lg ${
          matchSidebar ? 'flex flex-col justify-center' : ''
        }`}
        style={matchSidebar && panelHeight > 0 ? { minHeight: panelHeight } : undefined}
      >
        <CardHeader className="text-center pb-4">
          <img src={atlasFigure} alt="Cairnly" className="mx-auto mb-4 h-40 w-auto" />
          <CardTitle className="text-2xl font-bold text-atlas-navy">
            {t('welcome.title')}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 text-center">
          <p className="text-gray-700 leading-relaxed">
            {t('welcome.intro')}
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-atlas-blue mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                {t('welcome.tip')}
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <Button
              onClick={onReady}
              disabled={isLoading}
              size="lg"
              className="bg-gradient-to-r from-atlas-blue to-atlas-teal text-white hover:opacity-90 transition-opacity px-8 py-6 text-lg font-semibold"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  {t('welcome.preparing')}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  {t('welcome.ready')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
