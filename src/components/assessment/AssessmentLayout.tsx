
import React from 'react';

interface AssessmentLayoutProps {
  children: React.ReactNode;
  // Kept optional for backwards compatibility with callers, but no longer rendered.
  // We don't encourage users to exit partway through — the auto-save indicator in the
  // Survey Progress panel tells them it's safe to close the tab instead.
  onExit?: () => void;
  // Large-type flavors (encore) render the shared survey ~12% bigger via the
  // .survey-lg scope in index.css. Scale, not redesign.
  largeType?: boolean;
}

export const AssessmentLayout: React.FC<AssessmentLayoutProps> = ({ children, largeType = false }) => {
  return (
    <div className={`min-h-screen bg-gray-50 survey-bg${largeType ? ' survey-lg' : ''}`}>
      {children}
    </div>
  );
};
