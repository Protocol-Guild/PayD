import React, { useState, useCallback, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

const ONBOARDING_KEY = 'payd_onboarding_complete';

const TOUR_STEPS: Step[] = [
  {
    target: '#tour-welcome',
    content: 'Welcome to PayD! This quick tour will show you how to manage your workforce and payroll — all in just a few clicks.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#tour-connect',
    content: 'Connect your Stellar wallet to securely manage your organization and process payments.',
    placement: 'bottom',
  },
  {
    target: '#tour-employees',
    content: 'Manage your team here. Navigate to the Employees page to add and manage your workforce.',
    placement: 'right',
  },
  {
    target: '#tour-add-employee',
    content: 'Click here to add your first employee. Fill in their details and save them to the payroll roster.',
    placement: 'right',
  },
  {
    target: '#tour-payroll',
    content: 'Set up automated payroll streams here. Configure recurring payments for your team in real-time.',
    placement: 'right',
  },
  {
    target: '#tour-init-payroll',
    content: 'Open the scheduling wizard to configure recurring payments, set frequency, and fund your distribution account.',
    placement: 'bottom',
  },
];

export const OnboardingTour: React.FC<{
  run: boolean;
  navigateTo?: (path: string) => void;
  onComplete: () => void;
}> = ({ run, navigateTo, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [internalRun, setInternalRun] = useState(false);

  useEffect(() => {
    if (run) {
      setStepIndex(0);
      setInternalRun(true);
    } else {
      setInternalRun(false);
    }
  }, [run]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { index, type, status } = data;

      const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
      if (finishedStatuses.includes(status)) {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setInternalRun(false);
        onComplete();
        return;
      }

      // Auto-navigate to correct page when transitioning between steps
      if (type === 'step:after') {
        if (index === 2 && navigateTo) {
          // After step 3 (Employees), navigate to employee page for step 4 (Add Employee)
          navigateTo('/employee');
        }
        if (index === 4 && navigateTo) {
          // After step 5 (Payroll sidebar), navigate to payroll page for step 6 (Init Payroll)
          navigateTo('/payroll');
        }
        setStepIndex(index + 1);
      }
    },
    [navigateTo, onComplete]
  );

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={internalRun}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      disableScrolling
      styles={{
        options: {
          primaryColor: '#4AF0B8',
          textColor: '#fff',
          backgroundColor: '#111827',
          arrowColor: '#111827',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        },
        tooltipContent: {
          padding: '10px 0',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        buttonNext: {
          backgroundColor: '#4AF0B8',
          color: '#000',
          fontWeight: '800',
          borderRadius: '8px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: '#9CA3AF',
          fontWeight: '600',
          marginRight: '10px',
        },
        buttonSkip: {
          color: '#9CA3AF',
          fontSize: '13px',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
        },
      }}
    />
  );
};

export { ONBOARDING_KEY };