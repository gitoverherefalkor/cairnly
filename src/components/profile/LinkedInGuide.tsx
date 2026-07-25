
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Upload, ArrowRight } from 'lucide-react';

export const LinkedInGuide = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2 text-blue-600" />
          LinkedIn Profile Import
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Since LinkedIn's API doesn't provide full profile data, export your LinkedIn profile as a PDF and upload it to the right.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">How to export your LinkedIn profile:</h4>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="text-sm">
                  <p className="font-medium">Go to your LinkedIn profile</p>
                  <p className="text-gray-600">Click on your profile picture or visit your public profile</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div className="text-sm">
                  <p className="font-medium">Open the "More" (•••) menu</p>
                  <p className="text-gray-600">Click the "More" (•••) button near your name (some profiles label it "Resources")</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div className="text-sm">
                  <p className="font-medium">Select "Save to PDF"</p>
                  <p className="text-gray-600">Your complete profile will be exported as a PDF document</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded border">
              <img 
                src="/uploads/linkedin-save-to-pdf-more-menu.png"
                alt="LinkedIn profile More menu showing the Save to PDF option"
                className="w-full max-w-sm mx-auto rounded shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 py-2">
            <Download className="h-4 w-4" />
            <ArrowRight className="h-4 w-4" />
            <Upload className="h-4 w-4" />
            <span>Export from LinkedIn → Upload to the right</span>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Why this approach?</strong> LinkedIn's API only provides basic information like name and email. 
            By exporting your profile as PDF, you can share your complete work history, education, and skills for a more comprehensive career assessment.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
