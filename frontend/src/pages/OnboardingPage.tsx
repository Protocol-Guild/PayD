import React from 'react';
import { OrganizationOnboardingWizard } from '../components/OrganizationOnboardingWizard';
import { useOrganizationOnboarding } from '../hooks/useOrganizationOnboarding';
import { useNotification } from '../hooks/useNotification';

const OnboardingPage: React.FC = () => {
  const { completeOnboarding, cancelOnboarding } = useOrganizationOnboarding();
  const { notifySuccess } = useNotification();

  const handleComplete = (data: any) => {
    completeOnboarding(data);
    notifySuccess('Organization setup completed successfully!');
  };

  const handleCancel = () => {
    cancelOnboarding();
  };

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
};

export default OnboardingPage;
