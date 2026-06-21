import axios, { type AxiosError } from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3001';

export interface CertificateGenerationParams {
  employeeId: number;
  transactionHash: string;
  organizationId: number;
}

export interface CertificateVerificationParams {
  transactionHash: string;
  employeeId: number;
  organizationId: number;
}

export interface CertificateVerificationResult {
  verified: boolean;
  transactionHash?: string;
  details?: {
    employee: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      position?: string;
      department?: string;
    };
    organization: {
      id: number;
      name: string;
    };
    transaction: {
      hash: string;
      amount: string;
      assetCode: string;
      status: string;
      createdAt: string;
      ledgerSequence: number;
      sourceAccount: string;
    };
    verificationUrl: string;
  };
  message?: string;
}

/**
 * Generate and download a PDF certificate for a payment transaction
 */
export const generateCertificate = async (params: CertificateGenerationParams): Promise<Blob> => {
  try {
    const response = await axios.get<Blob>(`${API_BASE_URL}/api/certificates/generate`, {
      params,
      responseType: 'blob',
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const errorMessage =
        (axiosError.response?.data as { message?: string } | undefined)?.message ||
        axiosError.message ||
        'Failed to generate certificate';
      const newError = new Error(errorMessage);
      // Attach cause for error chaining (ES2022 feature, but works at runtime)
      Object.assign(newError, { cause: error });
      throw newError;
    }
    throw error;
  }
};

/**
 * Download certificate as PDF file
 */
export const downloadCertificate = async (params: CertificateGenerationParams): Promise<void> => {
  const blob = await generateCertificate(params);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payment-certificate-${params.transactionHash.substring(0, 16)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Verify a certificate by transaction hash
 */
export const verifyCertificate = async (
  params: CertificateVerificationParams
): Promise<CertificateVerificationResult> => {
  try {
    const response = await axios.get<CertificateVerificationResult>(
      `${API_BASE_URL}/api/certificates/verify`,
      {
        params,
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response?.status === 404) {
        return {
          verified: false,
          message: 'Certificate could not be verified',
        };
      }
      const errorMessage =
        (axiosError.response?.data as { message?: string } | undefined)?.message ||
        axiosError.message ||
        'Failed to verify certificate';
      const newError = new Error(errorMessage);
      // Attach cause for error chaining (ES2022 feature, but works at runtime)
      Object.assign(newError, { cause: error });
      throw newError;
    }
    throw error;
  }
};

/**
 * Get employee and organization info from transaction hash
 */
interface TransactionInfoResponse {
  success: boolean;
  data?: { employeeId: number; organizationId: number };
}

export const getTransactionInfo = async (
  transactionHash: string
): Promise<{ employeeId: number; organizationId: number } | null> => {
  try {
    const response = await axios.get<TransactionInfoResponse>(
      `${API_BASE_URL}/api/certificates/transaction-info`,
      {
        params: { transactionHash },
      }
    );

    return response.data.data || null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
