import React, { useEffect } from 'react';
import { useOrganizationOnboarding } from '../hooks/useOrganizationOnboarding';
import { OrganizationOnboardingWizard } from './OrganizationOnboardingWizard';
import { useNotification } from '../hooks/useNotification';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ children }) => {
  const { showWizard, completeOnboarding, cancelOnboarding } = useOrganizationOnboarding();
  const { notifySuccess } = useNotification();

  const handleComplete = (data: any) => {
    completeOnboarding(data);
    notifySuccess('Organization setup completed successfully!');
  };

  const handleCancel = () => {
    cancelOnboarding();
  };

  if (showWizard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface via-black to-surface flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <OrganizationOnboardingWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
