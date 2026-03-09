#!/bin/bash

# Contractor Invoicing Feature - Quick Setup Script

echo "🚀 Setting up Contractor Invoicing Feature..."

# 1. Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install pdfkit @types/pdfkit

# 2. Run database migration
echo "🗄️  Running database migration..."
# Assuming you have a migration runner, adjust as needed
# psql -d your_database -f src/db/migrations/018_create_invoices.sql
echo "⚠️  Please run the migration manually:"
echo "   psql -d your_database -f src/db/migrations/018_create_invoices.sql"

# 3. Build backend
echo "🔨 Building backend..."
npm run build

# 4. Install frontend dependencies (if needed)
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# 5. Build frontend
echo "🔨 Building frontend..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Run the database migration (see above)"
echo "2. Start the backend: cd backend && npm start"
echo "3. Start the frontend: cd frontend && npm run dev"
echo "4. Create a contractor user with role='CONTRACTOR'"
echo "5. Visit /contractor to submit invoices"
echo "6. Visit /invoices as employer to approve/reject"
echo ""
echo "📚 See CONTRACTOR_INVOICING_FEATURE.md for full documentation"
