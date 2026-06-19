# PayD Path Payments API Reference

## Base URL
```
https://api.payd.stellar/api/v1/path-payments
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Configuration Endpoints

### Configure Organization
Configure organization for path payment payrolls.

**POST** `/configure`

**Request Body:**
```json
{
  "employerAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  "defaultSourceAsset": {
    "code": "USDC",
    "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  },
  "maxSlippageBps": 500,
  "maxPriceImpactBps": 1000,
  "autoApproveThreshold": "10000",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "organizationId": 1,
    "employerAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    "defaultSourceAsset": {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "isNative": false
    },
    "maxSlippageBps": 500,
    "maxPriceImpactBps": 1000,
    "autoApproveThreshold": "10000",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Organization Config
Get current organization configuration.

**GET** `/config`

**Response:**
```json
{
  "success": true,
  "config": {
    "organizationId": 1,
    "employerAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    "defaultSourceAsset": {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "isNative": false
    },
    "maxSlippageBps": 500,
    "maxPriceImpactBps": 1000,
    "autoApproveThreshold": "10000",
    "isActive": true
  }
}
```

## Payroll Execution Endpoints

### Execute Payroll Run
Execute payroll using path payments.

**POST** `/payroll/execute`

**Request Body:**
```json
{
  "employees": [
    {
      "employeeId": 1,
      "employeeAddress": "GCKFBEIYTKP2Q3K7VDEGBJ76MN3QGCWTXPC3U3YDAG5FGABUO3DDSC2V",
      "destinationAsset": {
        "code": "EUR",
        "issuer": "GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT"
      },
      "destinationAmount": "1000"
    }
  ],
  "paymentType": "strict_send"
}
```

**Response:**
```json
{
  "success": true,
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "contractBatchId": 1,
  "totalEmployees": 1,
  "successfulPayments": 1,
  "failedPayments": 0,
  "totalSourceAmount": "1050.25",
  "totalDestinationAmount": "1000.00"
}
```

### Estimate Payroll Costs
Estimate costs for payroll execution.

**POST** `/payroll/estimate`

**Request Body:**
```json
{
  "sourceAsset": {
    "code": "USDC",
    "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  },
  "employees": [
    {
      "destinationAsset": {
        "code": "EUR",
        "issuer": "GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT"
      },
      "destinationAmount": "1000"
    }
  ],
  "paymentType": "strict_send"
}
```

**Response:**
```json
{
  "success": true,
  "estimate": {
    "totalEstimatedSourceCost": "1050.25",
    "totalDestinationAmount": "1000.00",
    "averageSlippage": 0.025,
    "averagePriceImpact": 0.015,
    "feasibleEmployees": 1,
    "infeasibleEmployees": [],
    "confidenceScore": 0.92,
    "warnings": []
  }
}
```

### Get Payroll Run Status
Get status of a specific payroll run.

**GET** `/payroll/runs/{runId}`

**Response:**
```json
{
  "success": true,
  "payrollRun": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": 1,
    "employerAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    "sourceAsset": {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "isNative": false
    },
    "paymentType": "strict_send",
    "totalEmployees": 1,
    "successfulPayments": 1,
    "failedPayments": 0,
    "status": "completed",
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:32:00Z"
  },
  "employeePayments": [
    {
      "id": "payment-1",
      "employeeId": 1,
      "employeeAddress": "GCKFBEIYTKP2Q3K7VDEGBJ76MN3QGCWTXPC3U3YDAG5FGABUO3DDSC2V",
      "destinationAsset": {
        "code": "EUR",
        "issuer": "GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT",
        "isNative": false
      },
      "destinationAmount": "1000.00",
      "actualDestinationAmount": "1000.00",
      "status": "completed"
    }
  ]
}
```

### Get Payroll Runs History
Get paginated list of organization's payroll runs.

**GET** `/payroll/runs?limit=50&offset=0`

**Response:**
```json
{
  "success": true,
  "payrollRuns": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "organizationId": 1,
      "employerAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      "sourceAsset": {
        "code": "USDC",
        "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        "isNative": false
      },
      "paymentType": "strict_send",
      "totalEmployees": 1,
      "successfulPayments": 1,
      "failedPayments": 0,
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:32:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

## Path Discovery Endpoints

### Find Optimal Paths
Find optimal conversion paths between assets.

**POST** `/paths/find`

**Request Body:**
```json
{
  "sourceAsset": {
    "code": "USDC",
    "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  },
  "destinationAsset": {
    "code": "EUR",
    "issuer": "GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT"
  },
  "amount": "1000",
  "amountType": "source"
}
```

**Response:**
```json
{
  "success": true,
  "paths": [
    {
      "path": ["USDC", "XLM", "EUR"],
      "estimatedSourceAmount": "1000.00",
      "estimatedDestinationAmount": "950.25",
      "slippage": 0.025,
      "priceImpact": 0.015,
      "optimal": true
    }
  ],
  "totalPaths": 1,
  "optimalPath": {
    "path": ["USDC", "XLM", "EUR"],
    "estimatedSourceAmount": "1000.00",
    "estimatedDestinationAmount": "950.25",
    "slippage": 0.025,
    "priceImpact": 0.015,
    "optimal": true
  }
}
```

### Get Supported Assets
Get list of supported assets for path payments.

**GET** `/assets`

**Response:**
```json
{
  "success": true,
  "assets": [
    {
      "code": "XLM",
      "issuer": null,
      "isNative": true
    },
    {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "isNative": false
    }
  ],
  "totalAssets": 2
}
```

### Get Liquidity Statistics
Get current liquidity pool statistics.

**GET** `/liquidity/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalPools": 25,
    "totalLiquidity": "50000000.00",
    "totalVolume24h": "5000000.00",
    "averageSpread": 0.003,
    "topPools": [
      {
        "poolId": "xlm-usdc",
        "assetPair": "XLM/USDC",
        "liquidity": "10000000.00",
        "volume24h": "2000000.00",
        "apr": 0.085
      }
    ]
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error"
    }
  ]
}
```

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute
- **Configuration endpoints**: 10 requests per minute  
- **Payroll execution**: 3 requests per minute
- **Other endpoints**: 60 requests per minute

Rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp