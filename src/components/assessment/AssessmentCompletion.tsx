
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export const AssessmentCompletion: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('survey');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="text-center p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('assessmentCompletion.title')}</h1>
          <p className="text-gray-600 mb-6">
            {t('assessmentCompletion.body')}
          </p>
          <div className="space-y-3">
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              {t('assessmentCompletion.viewDashboard')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('assessmentCompletion.returnHome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
