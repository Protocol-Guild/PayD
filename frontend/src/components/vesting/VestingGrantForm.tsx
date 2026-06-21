import React, { useState } from 'react';
import { Card, Heading, Input, Button } from '@stellar/design-system';

interface VestingGrantFormData {
  employeeAddress: string;
  totalAmount: string;
  startDate: string;
  cliffDate: string;
  durationYears: string;
}

interface VestingGrantFormProps {
  onSubmit: (data: VestingGrantFormData) => void;
  isSubmitting: boolean;
}

export const VestingGrantForm: React.FC<VestingGrantFormProps> = ({ onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    employeeAddress: '',
    totalAmount: '',
    startDate: '',
    cliffDate: '',
    durationYears: '4',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <div className="p-6">
        <Heading as="h3" size="xs" weight="bold" addlClassName="mb-6">
          Create New Vesting Grant
        </Heading>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="employeeAddress"
            label="Employee Wallet Address (G...)"
            name="employeeAddress"
            value={formData.employeeAddress}
            onChange={handleChange}
            placeholder="GB..."
            fieldSize="md"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="totalAmount"
              label="Total Grant Amount"
              name="totalAmount"
              type="number"
              value={formData.totalAmount}
              onChange={handleChange}
              placeholder="0.00"
              fieldSize="md"
            />
            <Input
              id="durationYears"
              label="Duration (Years)"
              name="durationYears"
              type="number"
              value={formData.durationYears}
              onChange={handleChange}
              fieldSize="md"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="startDate"
              label="Start Date"
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange}
              fieldSize="md"
            />
            <Input
              id="cliffDate"
              label="Cliff Date"
              name="cliffDate"
              type="date"
              value={formData.cliffDate}
              onChange={handleChange}
              fieldSize="md"
            />
          </div>
          <Button type="submit" variant="primary" size="md" isFullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Simulating...' : 'Initialize Vesting Escrow'}
          </Button>
        </form>
      </div>
    </Card>
  );
};
