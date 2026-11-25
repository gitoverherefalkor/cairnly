import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, LayoutDashboard, Info, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import atlasFigure from '@/logos/live/cairnly_logo_symbol_only.png';

interface ClosingCardProps {
  firstName?: string;
}

export const ClosingCard: React.FC<ClosingCardProps> = ({ firstName }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('chat');

  const handleDownloadReport = () => {
    // Navigate to dashboard where the report can be downloaded
    navigate('/dashboard');
  };

  const handleReturnToDashboard = () => {
    // Clear the chat session and return to dashboard
    localStorage.removeItem('n8n-chat/sessionId');
    navigate('/dashboard');
  };

  return (
    <div className="w-full max-w-[800px] mx-auto py-4">
      <Card className="border-2 border-green-500/20 shadow-lg">
        <CardHeader className="text-center pb-4">
          <img src={atlasFigure} alt="Cairnly" className="mx-auto mb-4 h-40 w-auto" />
          <CardTitle className="text-2xl font-bold text-atlas-navy">
            {firstName ? t('closing.titleNamed', { name: firstName }) : t('closing.title')}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-lg text-gray-700 leading-relaxed">
            {t('closing.thanks')}
          </p>

          <p className="text-gray-700 leading-relaxed">
            {t('closing.saved')}
          </p>

          <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-r-lg text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-3">
                <p className="font-semibold text-green-900">{t('closing.nextTitle')}</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>{t('closing.next1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>{t('closing.next2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>{t('closing.next3')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-lg text-left">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-amber-900">{t('closing.noteTitle')}</p>
                <p className="text-sm text-gray-700">
                  {t('closing.note')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg text-left">
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>{t('closing.howToLead')}</strong> {t('closing.howTo')}
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleDownloadReport}
              size="lg"
              className="bg-gradient-to-r from-atlas-blue to-atlas-teal text-white hover:opacity-90 transition-opacity px-6 py-6 text-base font-semibold"
            >
              <FileDown className="h-5 w-5 mr-2" />
              {t('closing.viewReport')}
            </Button>
            <Button
              onClick={handleReturnToDashboard}
              variant="outline"
              size="lg"
              className="border-2 border-atlas-navy text-atlas-navy hover:bg-atlas-navy hover:text-white px-6 py-6 text-base font-semibold"
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              {t('closing.toDashboard')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
