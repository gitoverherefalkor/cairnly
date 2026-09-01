import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, CheckCircle2, Shield } from 'lucide-react';
import { ALL_SECTIONS, SECTION_I18N_KEY } from './ReportSidebar';
import atlasFigure from '@/logos/live/cairnly_logo_symbol_only.png';

interface WelcomeBackCardProps {
  onContinue: () => void;
  firstName?: string;
  completedSectionIndex: number; // -1 = none, 0+ = index of last completed section
}

export const WelcomeBackCard: React.FC<WelcomeBackCardProps> = ({
  onContinue,
  firstName,
  completedSectionIndex
}) => {
  const { t } = useTranslation(['chat', 'report']);

  // Get the sections that were completed (up to last 5)
  const completedSections = completedSectionIndex >= 0
    ? ALL_SECTIONS.slice(0, completedSectionIndex + 1).slice(-5)
    : [];

  return (
    <div className="w-full max-w-[800px] mx-auto py-4">
      <Card className="border-2 border-atlas-blue/20 shadow-lg">
        <CardHeader className="text-center pb-4">
          <img src={atlasFigure} alt="Cairnly" className="mx-auto mb-4 h-40 w-auto" />
          <CardTitle className="text-2xl font-bold text-atlas-navy">
            {t('chat:resume.wbTitle', { defaultValue: 'Welcome Back' })}{firstName ? `, ${firstName}` : ''}!
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-lg text-gray-700 leading-relaxed">
            {t('chat:resume.wbIntro', { defaultValue: "It's been a while since we last spoke. I'm ready to continue our conversation about your career assessment!" })}
          </p>

          {completedSections.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-atlas-blue p-5 rounded-r-lg text-left">
              <p className="font-semibold text-atlas-navy mb-3">
                {t('chat:resume.wbReviewed', { defaultValue: 'Last time we reviewed:' })}
              </p>
              <ul className="space-y-2 text-gray-700">
                {completedSections.map((section) => (
                  <li key={section.id} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-atlas-blue mt-0.5 flex-shrink-0" />
                    <span>
                      {SECTION_I18N_KEY[section.id]
                        ? t(`report:${SECTION_I18N_KEY[section.id]}`, { defaultValue: section.title })
                        : section.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
            <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-green-900 mb-1">
                {t('chat:resume.wbSafeTitle', { defaultValue: 'Your progress is safe' })}
              </p>
              <p>
                {t('chat:resume.wbSafeBody', { defaultValue: "While our previous conversation history isn't visible anymore, all your feedback and report content has been saved and processed. Your final report reflects everything we discussed." })}
              </p>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed">
            {t('chat:resume.wbReady', { defaultValue: 'Ready to pick up where we left off? Feel free to ask about any section of your assessment, request clarifications, or explore new career paths.' })}
          </p>

          <div className="pt-4 flex justify-center">
            <Button
              onClick={onContinue}
              size="lg"
              className="bg-gradient-to-r from-atlas-blue to-atlas-teal text-white hover:opacity-90 transition-opacity px-8 py-6 text-lg font-semibold"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              {t('chat:resume.wbContinue', { defaultValue: 'Continue Session' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
