import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { pathPaymentService } from '@/services/pathPaymentService';

interface PathPaymentConfigProps {
  organizationId: number;
  onConfigUpdate?: (config: any) => void;
}

interface AssetInfo {
  code: string;
  issuer: string | null;
  isNative: boolean;
}

interface ConfigForm {
  employerAddress: string;
  defaultSourceAsset: AssetInfo;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  autoApproveThreshold: string;
  isActive: boolean;
}

export const PathPaymentConfig: React.FC<PathPaymentConfigProps> = ({
  organizationId,
  onConfigUpdate,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigForm>({
    employerAddress: '',
    defaultSourceAsset: { code: 'USDC', issuer: '', isNative: false },
    maxSlippageBps: 500, // 5%
    maxPriceImpactBps: 1000, // 10%
    autoApproveThreshold: '10000',
    isActive: true,
  });
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    loadExistingConfig();
  }, [organizationId]);

  const loadExistingConfig = async () => {
    try {
      setLoading(true);
      const response = await pathPaymentService.getOrganizationConfig();
      
      if (response.success && response.config) {
        setConfig({
          employerAddress: response.config.employerAddress,
          defaultSourceAsset: response.config.defaultSourceAsset,
          maxSlippageBps: response.config.maxSlippageBps,
          maxPriceImpactBps: response.config.maxPriceImpactBps,
          autoApproveThreshold: response.config.autoApproveThreshold,
          isActive: response.config.isActive,
        });
        setHasExistingConfig(true);
      }
    } catch (error) {
      console.error('Failed to load path payment config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      
      // Validate form
      if (!config.employerAddress || config.employerAddress.length !== 56) {
        toast({
          title: 'Invalid Employer Address',
          description: 'Please enter a valid 56-character Stellar public key',
          variant: 'destructive',
        });
        return;
      }

      if (!config.defaultSourceAsset.code) {
        toast({
          title: 'Invalid Source Asset',
          description: 'Please specify a source asset code',
          variant: 'destructive',
        });
        return;
      }

      if (config.maxSlippageBps < 0 || config.maxSlippageBps > 10000) {
        toast({
          title: 'Invalid Slippage',
          description: 'Slippage must be between 0 and 10000 basis points (0-100%)',
          variant: 'destructive',
        });
        return;
      }

      const response = await pathPaymentService.configureOrganization({
        employerAddress: config.employerAddress,
        defaultSourceAsset: config.defaultSourceAsset,
        maxSlippageBps: config.maxSlippageBps,
        maxPriceImpactBps: config.maxPriceImpactBps,
        autoApproveThreshold: config.autoApproveThreshold,
        isActive: config.isActive,
      });

      if (response.success) {
        toast({
          title: 'Configuration Saved',
          description: 'Path payment configuration has been updated successfully',
        });
        setHasExistingConfig(true);
        onConfigUpdate?.(response.config);
      } else {
        throw new Error(response.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Configuration Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ConfigForm, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAssetChange = (field: keyof AssetInfo, value: string) => {
    setConfig(prev => ({
      ...prev,
      defaultSourceAsset: {
        ...prev.defaultSourceAsset,
        [field]: value,
        isNative: field === 'code' && value === 'XLM',
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading configuration...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Path Payment Configuration</h3>
          {hasExistingConfig && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
        <p className="text-sm text-gray-600">
          Configure your organization for multi-asset payroll using Stellar path payments
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {!hasExistingConfig && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Path payments are not configured for this organization. Please set up the configuration below to enable multi-asset payrolls.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employerAddress">Employer Address</Label>
            <Input
              id="employerAddress"
              placeholder="G... (56 character Stellar public key)"
              value={config.employerAddress}
              onChange={(e) => handleInputChange('employerAddress', e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              The Stellar address that will fund payroll transactions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autoApproveThreshold">Auto-Approve Threshold</Label>
            <Input
              id="autoApproveThreshold"
              type="number"
              placeholder="10000"
              value={config.autoApproveThreshold}
              onChange={(e) => handleInputChange('autoApproveThreshold', e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Automatic approval threshold for payroll amounts
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium">Default Source Asset</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assetCode">Asset Code</Label>
              <Input
                id="assetCode"
                placeholder="USDC"
                value={config.defaultSourceAsset.code}
                onChange={(e) => handleAssetChange('code', e.target.value)}
                maxLength={12}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assetIssuer">Asset Issuer</Label>
              <Input
                id="assetIssuer"
                placeholder="G... (leave empty for XLM)"
                value={config.defaultSourceAsset.issuer || ''}
                onChange={(e) => handleAssetChange('issuer', e.target.value)}
                disabled={config.defaultSourceAsset.isNative}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxSlippage">Max Slippage (basis points)</Label>
            <Input
              id="maxSlippage"
              type="number"
              min="0"
              max="10000"
              value={config.maxSlippageBps}
              onChange={(e) => handleInputChange('maxSlippageBps', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-gray-500">
              Current: {(config.maxSlippageBps / 100).toFixed(2)}%
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPriceImpact">Max Price Impact (basis points)</Label>
            <Input
              id="maxPriceImpact"
              type="number"
              min="0"
              max="10000"
              value={config.maxPriceImpactBps}
              onChange={(e) => handleInputChange('maxPriceImpactBps', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-gray-500">
              Current: {(config.maxPriceImpactBps / 100).toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={config.isActive}
            onCheckedChange={(checked) => handleInputChange('isActive', checked)}
          />
          <Label htmlFor="isActive">Enable path payments for this organization</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            onClick={loadExistingConfig}
            variant="outline"
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {hasExistingConfig ? 'Update Configuration' : 'Save Configuration'}
          </Button>
        </div>

        {hasExistingConfig && config.isActive && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Path payments are enabled and ready to use for multi-asset payrolls.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};