export type UserRole = 'EMPLOYER' | 'EMPLOYEE';

export interface JWTPayload {
  id: number;
  walletAddress: string;
  email: string;
  organizationId: number | null;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends JWTPayload {}
}
