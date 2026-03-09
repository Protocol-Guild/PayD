#!/usr/bin/env node

/**
 * Simple test script for PDF Certificate API
 * Usage: node test-certificate.js <transactionHash> [employeeId] [organizationId]
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const CERT_API = `${BASE_URL}/api/certificates`;

async function testCertificateAPI(transactionHash, employeeId, organizationId) {
  console.log('=== Testing PDF Certificate Generation API ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Transaction Hash: ${transactionHash}\n`);

  try {
    // Test 1: Get transaction info
    console.log('Test 1: Get transaction info (auto-detect employee/org)');
    console.log(`GET ${CERT_API}/transaction-info?transactionHash=${transactionHash}`);
    try {
      const infoResponse = await axios.get(`${CERT_API}/transaction-info`, {
        params: { transactionHash },
      });
      console.log('✓ Success:', JSON.stringify(infoResponse.data, null, 2));
      
      if (infoResponse.data.data) {
        employeeId = employeeId || infoResponse.data.data.employeeId;
        organizationId = organizationId || infoResponse.data.data.organizationId;
        console.log(`\nAuto-detected: Employee ID=${employeeId}, Organization ID=${organizationId}\n`);
      }
    } catch (error) {
      console.log('✗ Failed:', error.response?.data || error.message);
      if (!employeeId || !organizationId) {
        console.log('\n⚠ Could not auto-detect. Please provide employeeId and organizationId.\n');
        return;
      }
    }

    // Test 2: Generate certificate
    console.log('\nTest 2: Generate PDF certificate');
    const generateParams = { transactionHash };
    if (employeeId) generateParams.employeeId = employeeId;
    if (organizationId) generateParams.organizationId = organizationId;
    
    console.log(`GET ${CERT_API}/generate?${new URLSearchParams(generateParams).toString()}`);
    try {
      const certResponse = await axios.get(`${CERT_API}/generate`, {
        params: generateParams,
        responseType: 'arraybuffer',
      });
      
      const fs = await import('fs');
      const filename = `payment-certificate-${transactionHash.substring(0, 16)}.pdf`;
      fs.writeFileSync(filename, certResponse.data);
      
      console.log(`✓ Certificate generated successfully!`);
      console.log(`  File: ${filename}`);
      console.log(`  Size: ${certResponse.data.byteLength} bytes`);
    } catch (error) {
      console.log('✗ Failed:', error.response?.data?.toString() || error.message);
      if (error.response?.data) {
        try {
          const errorText = Buffer.from(error.response.data).toString('utf-8');
          const errorJson = JSON.parse(errorText);
          console.log('  Error details:', JSON.stringify(errorJson, null, 2));
        } catch {
          console.log('  Error:', errorText);
        }
      }
    }

    // Test 3: Verify certificate
    if (employeeId && organizationId) {
      console.log('\nTest 3: Verify certificate');
      console.log(`GET ${CERT_API}/verify?transactionHash=${transactionHash}&employeeId=${employeeId}&organizationId=${organizationId}`);
      try {
        const verifyResponse = await axios.get(`${CERT_API}/verify`, {
          params: {
            transactionHash,
            employeeId,
            organizationId,
          },
        });
        console.log('✓ Verification result:', JSON.stringify(verifyResponse.data, null, 2));
      } catch (error) {
        console.log('✗ Verification failed:', error.response?.data || error.message);
      }
    }

    console.log('\n=== Tests Complete ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-certificate.js <transactionHash> [employeeId] [organizationId]');
  console.log('\nExample:');
  console.log('  node test-certificate.js abc123def456...');
  console.log('  node test-certificate.js abc123def456... 1 1');
  process.exit(1);
}

const [txHash, empId, orgId] = args;
testCertificateAPI(txHash, empId ? Number(empId) : undefined, orgId ? Number(orgId) : undefined);
