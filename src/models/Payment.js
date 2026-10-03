const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  tenantId: {
    type: String,
    required: true,
    index: true, // Índice para consultas por tenant
  },
  // ... outros campos
});

// Middleware de isolamento multitenant no banco de dados
paymentSchema.pre('find', function (next) {
  if (this._options && this._options.tenantId) {
    this.query = this.query.where('tenantId', this._options.tenantId);
  }
  next();
});

// ... outros hooks

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
