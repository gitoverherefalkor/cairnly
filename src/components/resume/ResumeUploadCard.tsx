
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, Loader2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAIResumeUpload } from './hooks/useAIResumeUpload';

interface ResumeUploadCardProps {
  onProcessingComplete?: (data: any) => void;
  title?: string;
  description?: string;
  showSuccessMessage?: boolean;
}

export const ResumeUploadCard: React.FC<ResumeUploadCardProps> = ({
  onProcessingComplete,
  title,
  description,
  showSuccessMessage = true
}) => {
  // Copy lives in resume:uploadCard (Encore "u" via nl-formal/resume.json).
  const { t } = useTranslation('resume');
  const tu = (key: string, opts?: Record<string, unknown>) => t(`uploadCard.${key}`, opts);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const {
    isUploading,
    isProcessing,
    hasProcessed,
    setHasProcessed,
    processingResult,
    error,
    uploadAndProcess,
    resetState
  } = useAIResumeUpload({
    onSuccess: (data) => {
      if (showSuccessMessage) {
        toast({
          title: tu('toastSuccess'),
          description: tu('toastSuccessDesc', { count: data.fieldsExtracted ?? 0, file: uploadedFile?.name ?? '' }),
        });
      }
      onProcessingComplete?.(data);
    },
    onError: (error) => {
      toast({
        title: tu('toastFailed'),
        description: error || tu('toastFailedDesc'),
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type — PDF only. The n8n resume parser (WF0.1) can't read
    // Word/text files and fails downstream if anything else gets through.
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      toast({
        title: tu('pdfOnly'),
        description: tu('pdfOnlyDesc'),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: tu('tooLarge'),
        description: tu('tooLargeDesc'),
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    resetState();
    uploadAndProcess(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          {title ?? t('uploadCard.defaultTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{description ?? t('uploadCard.defaultDescription')}</p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {uploadedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  {hasProcessed && <CheckCircle className="h-6 w-6 text-green-600" />}
                  <FileText className="h-8 w-8 text-atlas-gold" />
                  <div className="text-left">
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      {hasProcessed && tu('processed')}
                      {isProcessing && tu('processingShort')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {isProcessing && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-atlas-gold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{tu('processing')}</span>
                  </div>
                )}

                {error && !isProcessing && !hasProcessed && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
                    <div className="flex items-center space-x-2 text-red-800 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">{tu('readError')}</span>
                    </div>
                    <p className="text-red-700 mb-3">
                      {tu('readErrorDesc')}
                    </p>
                    <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      {tu('tryOther')}
                    </Button>
                  </div>
                )}

                {hasProcessed && processingResult && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                    <div className="flex items-center space-x-2 text-green-800 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">{tu('success')}</span>
                    </div>
                    <div className="text-green-700 space-y-1">
                      <p>• {tu('prefilled', { count: processingResult.fieldsExtracted || 0 })}</p>
                      <p>• {tu('tailorReady')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">{tu('uploadPrompt')}</p>
                  <p className="text-sm text-gray-500">{tu('limits')}</p>
                  <p className="text-xs text-gray-400 mt-1">{tu('autoStart')}</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()}>
                  {tu('select')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
