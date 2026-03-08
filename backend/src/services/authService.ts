import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRES_IN = '24h';

export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      walletAddress: user.wallet_address || '', // using snake_case from DB
      organizationId: user.organization_id || null, // using snake_case from DB
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};
