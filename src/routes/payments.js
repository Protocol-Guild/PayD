const express = require('express');
const router = express.Router();
const { sensitiveLimiter } = require('../middleware/rateLimit');

// Aplicar rate limiting sensível a rotas de pagamentos
router.use(sensitiveLimiter);

// Rota de criar pagamento
router.post('/', async (req, res, next) => {
  try {
    // Usar req.tenantId para garantir isolamento
    const { tenantId } = req;
    const paymentData = { ...req.body, tenantId };

    // Lógica de criar pagamento
    const payment = await Payment.create(paymentData);

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

// ... outras rotas

module.exports = router;
