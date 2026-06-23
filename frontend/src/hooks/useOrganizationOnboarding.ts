import { useState, useEffect } from 'react';

interface OnboardingData {
  organizationName: string;
  payrollWallet: {
    address: string;
    secretKey?: string;
  };
  employees: Array<{
    name: string;
    email: string;
    role: string;
    salary: string;
    currency: string;
    walletAddress?: string;
  }>;
  paymentSettings: {
    defaultCurrency: string;
    payoutFrequency: 'weekly' | 'biweekly' | 'monthly';
    processingDay: number;
    processingTime: string;
  };
}

export const useOrganizationOnboarding = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    const checkOnboardingStatus = () => {
      const saved = localStorage.getItem('payd-onboarding-completed');
      const hasOrgData = localStorage.getItem('payd-organization-data');
      
      if (!saved && !hasOrgData) {
        setShowWizard(true);
      } else if (hasOrgData) {
        setOnboardingData(JSON.parse(hasOrgData));
        setIsCompleted(true);
      }
    };

    checkOnboardingStatus();
  }, []);

  const startOnboarding = () => {
    setShowWizard(true);
  };

  const completeOnboarding = (data: OnboardingData) => {
    setOnboardingData(data);
    setIsCompleted(true);
    setShowWizard(false);
    
    // Save to localStorage
    localStorage.setItem('payd-onboarding-completed', 'true');
    localStorage.setItem('payd-organization-data', JSON.stringify(data));
    
    // Emit event for other components to listen to
    window.dispatchEvent(new CustomEvent('onboarding-completed', { detail: data }));
  };

  const cancelOnboarding = () => {
    setShowWizard(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('payd-onboarding-completed');
    localStorage.removeItem('payd-organization-data');
    setOnboardingData(null);
    setIsCompleted(false);
    setShowWizard(true);
  };

  const updateOnboardingData = (updates: Partial<OnboardingData>) => {
    if (onboardingData) {
      const newData = { ...onboardingData, ...updates };
      setOnboardingData(newData);
      localStorage.setItem('payd-organization-data', JSON.stringify(newData));
    }
  };

  return {
    showWizard,
    onboardingData,
    isCompleted,
    startOnboarding,
    completeOnboarding,
    cancelOnboarding,
    resetOnboarding,
    updateOnboardingData,
  };
};
