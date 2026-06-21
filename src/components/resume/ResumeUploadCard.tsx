
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, Loader2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAIResumeUpload } from './hooks/useAIResumeUpload';

interface ResumeUploadCardProps {
  onProcessingComplete?: (data: any) => void;
  title?: string;
  description?: string;
  showSuccessMessage?: boolean;
}

export const ResumeUploadCard: React.FC<ResumeUploadCardProps> = ({
  onProcessingComplete,
  title = "Resume Upload",
  description = "Upload your resume as a PDF.",
  showSuccessMessage = true
}) => {
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
          title: "Resume uploaded successfully! ✅",
          description: `Pre-filled ${data.fieldsExtracted ?? 0} survey questions from your ${uploadedFile?.name}.`,
        });
      }
      onProcessingComplete?.(data);
    },
    onError: (error) => {
      toast({
        title: "Processing failed",
        description: error || "Failed to process your resume. You can continue manually.",
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
        title: "PDF files only",
        description: 'Please upload your resume as a PDF. Tip: in Word, use "Save As" and choose PDF.',
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
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
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

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
                      {hasProcessed && " - Successfully processed ✓"}
                      {isProcessing && " - Processing..."}
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
                    <span>Processing your document...</span>
                  </div>
                )}

                {error && !isProcessing && !hasProcessed && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
                    <div className="flex items-center space-x-2 text-red-800 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">We couldn't read that file</span>
                    </div>
                    <p className="text-red-700 mb-3">
                      Please make sure it's a PDF and try again.
                    </p>
                    <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Try a different file
                    </Button>
                  </div>
                )}

                {hasProcessed && processingResult && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                    <div className="flex items-center space-x-2 text-green-800 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Resume uploaded successfully!</span>
                    </div>
                    <div className="text-green-700 space-y-1">
                      <p>• Pre-filled {processingResult.fieldsExtracted || 0} survey questions</p>
                      <p>• Ready to use for tailored résumé generation</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">Upload your document</p>
                  <p className="text-sm text-gray-500">PDF files only, up to 10MB</p>
                  <p className="text-xs text-gray-400 mt-1">Processing will start automatically after upload</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Select File
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
