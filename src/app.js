// Adicione esta linha após as outras importações de rotas
const healthRoutes = require('./routes/healthRoutes');

// ... código existente ...

// Adicione esta linha para usar as rotas de health check
app.use('/api/v1', healthRoutes);

// ... código existente ...
