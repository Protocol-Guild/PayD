#!/bin/bash

# Test script for PDF Certificate Generation API
# Make sure the backend server is running before executing this script

BASE_URL="http://localhost:3001/api/certificates"

echo "=== Testing PDF Certificate Generation API ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Get transaction info (auto-detect employee and org)
echo -e "${YELLOW}Test 1: Get transaction info${NC}"
echo "Testing: GET /api/certificates/transaction-info?transactionHash=<hash>"
echo ""
echo "Please provide a transaction hash from your database:"
read -p "Transaction Hash: " TX_HASH

if [ -z "$TX_HASH" ]; then
  echo -e "${RED}✗ Transaction hash is required${NC}"
  exit 1
fi

echo ""
echo "Fetching transaction info..."
TRANSACTION_INFO=$(curl -s "${BASE_URL}/transaction-info?transactionHash=${TX_HASH}")
echo "$TRANSACTION_INFO" | jq '.' 2>/dev/null || echo "$TRANSACTION_INFO"

EMPLOYEE_ID=$(echo "$TRANSACTION_INFO" | jq -r '.data.employeeId' 2>/dev/null)
ORG_ID=$(echo "$TRANSACTION_INFO" | jq -r '.data.organizationId' 2>/dev/null)

if [ "$EMPLOYEE_ID" != "null" ] && [ -n "$EMPLOYEE_ID" ]; then
  echo -e "${GREEN}✓ Found Employee ID: $EMPLOYEE_ID, Organization ID: $ORG_ID${NC}"
else
  echo -e "${YELLOW}⚠ Could not auto-detect employee/org. Please provide manually.${NC}"
  read -p "Employee ID: " EMPLOYEE_ID
  read -p "Organization ID: " ORG_ID
fi

echo ""

# Test 2: Generate PDF certificate (with auto-detection)
echo -e "${YELLOW}Test 2: Generate PDF certificate (auto-detect)${NC}"
echo "Testing: GET /api/certificates/generate?transactionHash=${TX_HASH}"
echo ""
echo "Generating certificate..."
CERT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/generate?transactionHash=${TX_HASH}")
HTTP_STATUS=$(echo "$CERT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
CERT_BODY=$(echo "$CERT_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo "$CERT_BODY" > "/tmp/payment-certificate-${TX_HASH:0:16}.pdf"
  echo -e "${GREEN}✓ Certificate generated successfully!${NC}"
  echo "Saved to: /tmp/payment-certificate-${TX_HASH:0:16}.pdf"
  echo "File size: $(wc -c < "/tmp/payment-certificate-${TX_HASH:0:16}.pdf") bytes"
else
  echo -e "${RED}✗ Failed to generate certificate${NC}"
  echo "Response: $CERT_BODY"
fi

echo ""

# Test 3: Generate PDF certificate (with explicit IDs)
if [ -n "$EMPLOYEE_ID" ] && [ -n "$ORG_ID" ]; then
  echo -e "${YELLOW}Test 3: Generate PDF certificate (explicit IDs)${NC}"
  echo "Testing: GET /api/certificates/generate?transactionHash=${TX_HASH}&employeeId=${EMPLOYEE_ID}&organizationId=${ORG_ID}"
  echo ""
  echo "Generating certificate..."
  CERT_RESPONSE2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/generate?transactionHash=${TX_HASH}&employeeId=${EMPLOYEE_ID}&organizationId=${ORG_ID}")
  HTTP_STATUS2=$(echo "$CERT_RESPONSE2" | grep "HTTP_STATUS" | cut -d: -f2)
  CERT_BODY2=$(echo "$CERT_RESPONSE2" | sed '/HTTP_STATUS/d')

  if [ "$HTTP_STATUS2" = "200" ]; then
    echo "$CERT_BODY2" > "/tmp/payment-certificate-explicit-${TX_HASH:0:16}.pdf"
    echo -e "${GREEN}✓ Certificate generated successfully!${NC}"
    echo "Saved to: /tmp/payment-certificate-explicit-${TX_HASH:0:16}.pdf"
  else
    echo -e "${RED}✗ Failed to generate certificate${NC}"
    echo "Response: $CERT_BODY2"
  fi
  echo ""
fi

# Test 4: Verify certificate
if [ -n "$EMPLOYEE_ID" ] && [ -n "$ORG_ID" ]; then
  echo -e "${YELLOW}Test 4: Verify certificate${NC}"
  echo "Testing: GET /api/certificates/verify?transactionHash=${TX_HASH}&employeeId=${EMPLOYEE_ID}&organizationId=${ORG_ID}"
  echo ""
  echo "Verifying certificate..."
  VERIFY_RESPONSE=$(curl -s "${BASE_URL}/verify?transactionHash=${TX_HASH}&employeeId=${EMPLOYEE_ID}&organizationId=${ORG_ID}")
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
  
  VERIFIED=$(echo "$VERIFY_RESPONSE" | jq -r '.verified' 2>/dev/null)
  if [ "$VERIFIED" = "true" ]; then
    echo -e "${GREEN}✓ Certificate verified successfully!${NC}"
  else
    echo -e "${RED}✗ Certificate verification failed${NC}"
  fi
  echo ""
fi

echo "=== Tests Complete ==="
echo ""
echo "To view the generated PDF:"
echo "  xdg-open /tmp/payment-certificate-*.pdf"
echo "  (or open with your PDF viewer)"
