import React, { useState, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useNotification } from '../hooks/useNotification';
import { generateWallet } from '../services/stellar';
import { parseCSVFile } from '../utils/csvParser';

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

interface OrganizationOnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
  onCancel: () => void;
}

export const OrganizationOnboardingWizard: React.FC<OrganizationOnboardingWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const { address: connectedWallet, connect, isConnecting } = useWallet();
  const { notifySuccess, notifyError } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isGeneratingWallet, setIsGeneratingWallet] = useState(false);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    organizationName: '',
    payrollWallet: {
      address: '',
    },
    employees: [],
    paymentSettings: {
      defaultCurrency: 'USDC',
      payoutFrequency: 'monthly',
      processingDay: 1,
      processingTime: '09:00',
    },
  });

  const totalSteps = 4;
  const stepTitles = [
    'Welcome to PayD',
    'Setup Payroll Wallet', 
    'Import Employees',
    'Configure Payment Settings',
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connect();
      setOnboardingData(prev => ({
        ...prev,
        payrollWallet: {
          address: connectedWallet || '',
        },
      }));
      notifySuccess('Wallet connected successfully!');
    } catch (error) {
      notifyError('Failed to connect wallet');
    }
  };

  const handleGenerateWallet = async () => {
    setIsGeneratingWallet(true);
    try {
      const newWallet = generateWallet();
      setOnboardingData(prev => ({
        ...prev,
        payrollWallet: {
          address: newWallet.publicKey,
          secretKey: newWallet.secretKey,
        },
      }));
      notifySuccess('Payroll wallet generated successfully!');
    } catch (error) {
      notifyError('Failed to generate wallet');
    } finally {
      setIsGeneratingWallet(false);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingCSV(true);
    try {
      const parsedData = await parseCSVFile(file);
      setCsvPreview(parsedData.slice(0, 5)); // Show first 5 rows as preview
      
      const employees = parsedData.map((row: any) => ({
        name: row.name || row.Name || '',
        email: row.email || row.Email || '',
        role: row.role || row.Role || 'contractor',
        salary: row.salary || row.Salary || '2000',
        currency: onboardingData.paymentSettings.defaultCurrency,
        walletAddress: row.wallet || row.Wallet || '',
      }));

      setOnboardingData(prev => ({
        ...prev,
        employees: employees.filter(emp => emp.name && emp.email),
      }));
      
      notifySuccess(`Successfully imported ${employees.length} employees!`);
    } catch (error) {
      notifyError('Failed to process CSV file');
    } finally {
      setIsProcessingCSV(false);
    }
  };

  const handleManualAddEmployee = () => {
    const newEmployee = {
      name: '',
      email: '',
      role: 'contractor',
      salary: '2000',
      currency: onboardingData.paymentSettings.defaultCurrency,
      walletAddress: '',
    };
    
    setOnboardingData(prev => ({
      ...prev,
      employees: [...prev.employees, newEmployee],
    }));
  };

  const handleEmployeeChange = (index: number, field: string, value: string) => {
    setOnboardingData(prev => ({
      ...prev,
      employees: prev.employees.map((emp, i) =>
        i === index ? { ...emp, [field]: value } : emp
      ),
    }));
  };

  const handleComplete = () => {
    onComplete(onboardingData);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-4">Welcome to PayD!</h2>
              <p className="text-muted mb-8">
                Let's set up your organization for seamless payroll management on Stellar.
                This wizard will guide you through setting up your payroll wallet, importing employees, and configuring payment settings.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Organization Name</label>
                <input
                  type="text"
                  value={onboardingData.organizationName}
                  onChange={(e) => setOnboardingData(prev => ({ ...prev, organizationName: e.target.value }))}
                  className="w-full px-4 py-3 border border-hi rounded-lg bg-black/20 focus:border-accent focus:outline-none"
                  placeholder="Enter your organization name"
                />
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <h3 className="font-semibold mb-2">What we'll set up:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Payroll wallet for secure fund management
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Employee database via CSV import
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Global payment settings and schedules
                </li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Setup Payroll Wallet</h3>
              <p className="text-muted mb-6">
                Choose how you want to set up your organization's payroll wallet for processing payments.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="border border-hi rounded-lg p-4 hover:border-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="walletOption"
                    id="connectWallet"
                    checked={!!connectedWallet}
                    onChange={handleConnectWallet}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="connectWallet" className="block font-medium cursor-pointer">
                      Connect Existing Wallet
                    </label>
                    <p className="text-sm text-muted mt-1">
                      Use your existing Stellar wallet for payroll operations
                    </p>
                    {connectedWallet && (
                      <div className="mt-3 p-3 bg-accent/10 rounded text-sm">
                        <span className="font-mono">{connectedWallet}</span>
                      </div>
                    )}
                  </div>
                </div>
                {!connectedWallet && (
                  <button
                    onClick={handleConnectWallet}
                    disabled={isConnecting}
                    className="mt-3 px-4 py-2 bg-accent text-bg rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                )}
              </div>

              <div className="border border-hi rounded-lg p-4 hover:border-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="walletOption"
                    id="generateWallet"
                    checked={!!onboardingData.payrollWallet.address && !connectedWallet}
                    onChange={() => {}}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="generateWallet" className="block font-medium cursor-pointer">
                      Generate New Wallet
                    </label>
                    <p className="text-sm text-muted mt-1">
                      Create a new wallet specifically for payroll operations
                    </p>
                    {onboardingData.payrollWallet.address && !connectedWallet && (
                      <div className="mt-3 p-3 bg-accent/10 rounded text-sm">
                        <span className="font-mono">{onboardingData.payrollWallet.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(!onboardingData.payrollWallet.address || connectedWallet) && (
                  <button
                    onClick={handleGenerateWallet}
                    disabled={isGeneratingWallet}
                    className="mt-3 px-4 py-2 bg-accent text-bg rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    {isGeneratingWallet ? 'Generating...' : 'Generate Wallet'}
                  </button>
                )}
              </div>
            </div>

            {onboardingData.payrollWallet.secretKey && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-400 mb-2">⚠️ Important: Save Your Secret Key</h4>
                <p className="text-sm text-muted mb-3">
                  This secret key is required to access your payroll wallet funds. Save it securely:
                </p>
                <div className="bg-black/40 p-3 rounded font-mono text-xs break-all">
                  {onboardingData.payrollWallet.secretKey}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Import Employees</h3>
              <p className="text-muted mb-6">
                Import your employee database via CSV file or add employees manually.
              </p>
            </div>

            <div className="border-2 border-dashed border-hi rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <svg className="w-12 h-12 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingCSV}
                className="px-4 py-2 bg-accent text-bg rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {isProcessingCSV ? 'Processing...' : 'Upload CSV File'}
              </button>
              <p className="text-sm text-muted mt-2">
                CSV should include: name, email, role, salary, wallet (optional)
              </p>
            </div>

            {csvPreview.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">CSV Preview ({csvPreview.length} of {onboardingData.employees.length} employees)</h4>
                <div className="border border-hi rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((emp, i) => (
                        <tr key={i} className="border-t border-hi">
                          <td className="px-3 py-2">{emp.name}</td>
                          <td className="px-3 py-2">{emp.email}</td>
                          <td className="px-3 py-2">{emp.role}</td>
                          <td className="px-3 py-2">{emp.salary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {onboardingData.employees.length} employees imported
              </span>
              <button
                onClick={handleManualAddEmployee}
                className="px-4 py-2 border border-hi rounded-lg font-medium hover:border-accent"
              >
                Add Employee Manually
              </button>
            </div>

            {onboardingData.employees.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Employee List</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {onboardingData.employees.map((emp, i) => (
                    <div key={i} className="border border-hi rounded-lg p-3 grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={emp.name}
                        onChange={(e) => handleEmployeeChange(i, 'name', e.target.value)}
                        placeholder="Name"
                        className="px-3 py-2 bg-black/20 border border-hi rounded focus:border-accent focus:outline-none"
                      />
                      <input
                        type="email"
                        value={emp.email}
                        onChange={(e) => handleEmployeeChange(i, 'email', e.target.value)}
                        placeholder="Email"
                        className="px-3 py-2 bg-black/20 border border-hi rounded focus:border-accent focus:outline-none"
                      />
                      <select
                        value={emp.role}
                        onChange={(e) => handleEmployeeChange(i, 'role', e.target.value)}
                        className="px-3 py-2 bg-black/20 border border-hi rounded focus:border-accent focus:outline-none"
                      >
                        <option value="contractor">Contractor</option>
                        <option value="full-time">Full Time</option>
                        <option value="part-time">Part Time</option>
                      </select>
                      <input
                        type="text"
                        value={emp.salary}
                        onChange={(e) => handleEmployeeChange(i, 'salary', e.target.value)}
                        placeholder="Salary"
                        className="px-3 py-2 bg-black/20 border border-hi rounded focus:border-accent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Configure Payment Settings</h3>
              <p className="text-muted mb-6">
                Set up your organization's default payment preferences and schedule.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Default Currency</label>
                <select
                  value={onboardingData.paymentSettings.defaultCurrency}
                  onChange={(e) => setOnboardingData(prev => ({
                    ...prev,
                    paymentSettings: { ...prev.paymentSettings, defaultCurrency: e.target.value }
                  }))}
                  className="w-full px-4 py-3 bg-black/20 border border-hi rounded-lg focus:border-accent focus:outline-none"
                >
                  <option value="USDC">USDC (Stellar)</option>
                  <option value="XLM">XLM</option>
                  <option value="EURC">EURC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payout Frequency</label>
                <select
                  value={onboardingData.paymentSettings.payoutFrequency}
                  onChange={(e) => setOnboardingData(prev => ({
                    ...prev,
                    paymentSettings: { ...prev.paymentSettings, payoutFrequency: e.target.value as any }
                  }))}
                  className="w-full px-4 py-3 bg-black/20 border border-hi rounded-lg focus:border-accent focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {onboardingData.paymentSettings.payoutFrequency === 'monthly' ? 'Day of Month' : 'Day of Week'}
                </label>
                <input
                  type="number"
                  min={onboardingData.paymentSettings.payoutFrequency === 'monthly' ? '1' : '0'}
                  max={onboardingData.paymentSettings.payoutFrequency === 'monthly' ? '31' : '6'}
                  value={onboardingData.paymentSettings.processingDay}
                  onChange={(e) => setOnboardingData(prev => ({
                    ...prev,
                    paymentSettings: { ...prev.paymentSettings, processingDay: parseInt(e.target.value) }
                  }))}
                  className="w-full px-4 py-3 bg-black/20 border border-hi rounded-lg focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Processing Time</label>
                <input
                  type="time"
                  value={onboardingData.paymentSettings.processingTime}
                  onChange={(e) => setOnboardingData(prev => ({
                    ...prev,
                    paymentSettings: { ...prev.paymentSettings, processingTime: e.target.value }
                  }))}
                  className="w-full px-4 py-3 bg-black/20 border border-hi rounded-lg focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-6">
              <h4 className="font-semibold mb-4">Setup Summary</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Organization:</span>
                  <span className="font-medium">{onboardingData.organizationName || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Payroll Wallet:</span>
                  <span className="font-mono text-xs">
                    {onboardingData.payrollWallet.address ? 
                      `${onboardingData.payrollWallet.address.slice(0, 8)}...${onboardingData.payrollWallet.address.slice(-8)}` : 
                      'Not setup'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Employees:</span>
                  <span className="font-medium">{onboardingData.employees.length} imported</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Payment Schedule:</span>
                  <span className="font-medium capitalize">
                    {onboardingData.paymentSettings.payoutFrequency} on day {onboardingData.paymentSettings.processingDay} at {onboardingData.paymentSettings.processingTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card glass noise w-full p-6 sm:p-8 flex flex-col gap-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black">{stepTitles[currentStep - 1]}</h2>
          <span className="text-sm text-muted">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full transition-colors ${
                currentStep > i + 1 ? 'bg-success' : 
                currentStep === i + 1 ? 'bg-accent' : 
                'bg-surface'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-hi">
        <button
          onClick={currentStep === 1 ? onCancel : handleBack}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            currentStep === 1 
              ? 'text-muted hover:text-text' 
              : 'bg-surface hover:bg-hi/50 text-text'
          }`}
        >
          {currentStep === 1 ? 'Cancel' : 'Back'}
        </button>

        {currentStep < totalSteps ? (
          <button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !onboardingData.organizationName) ||
              (currentStep === 2 && !onboardingData.payrollWallet.address) ||
              (currentStep === 3 && onboardingData.employees.length === 0)
            }
            className="px-6 py-2 bg-accent text-bg rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleComplete}
            className="px-6 py-2 bg-success text-bg rounded-lg font-medium hover:bg-success/90 flex items-center gap-2"
          >
            Complete Setup
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
