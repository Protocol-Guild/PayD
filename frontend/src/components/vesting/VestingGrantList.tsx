import React from 'react';
import { Card, Heading, Text, Button } from '@stellar/design-system';

interface VestingGrant {
  id: string;
  employeeName: string;
  totalAmount: number;
  vestedAmount: number;
  cliffDate: string;
  startDate: string;
  duration: string;
}

interface VestingGrantListProps {
  grants: VestingGrant[];
  onClaim: (id: string) => void;
}

export const VestingGrantList: React.FC<VestingGrantListProps> = ({ grants, onClaim }) => {
  return (
    <div className="space-y-4">
      {grants.length === 0 ? (
        <Card>
          <Text as="p" size="sm" weight="regular" addlClassName="text-muted">
            No active vesting grants found.
          </Text>
        </Card>
      ) : (
        grants.map((grant) => {
          const progress = (grant.vestedAmount / grant.totalAmount) * 100;
          return (
            <Card key={grant.id}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Heading as="h3" size="xs" weight="bold">
                      {grant.employeeName}
                    </Heading>
                    <Text as="p" size="xs" weight="regular" addlClassName="text-muted">
                      Total: {grant.totalAmount} XLM | Vested: {grant.vestedAmount} XLM
                    </Text>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onClaim(grant.id)}
                    disabled={grant.vestedAmount === 0}
                  >
                    Claim
                  </Button>
                </div>

                <div className="w-full bg-black/20 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-bold tracking-widest text-muted">
                  <div>
                    <span>Cliff:</span>
                    <span className="ml-1 text-text">
                      {new Date(grant.cliffDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span>Start:</span>
                    <span className="ml-1 text-text">
                      {new Date(grant.startDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
