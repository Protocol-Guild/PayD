const winston = require('winston');

// Configuração do logger de auditoria
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/audit.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.Console(),
  ],
});

const log = async (logData) => {
  auditLogger.info('Audit Log', logData);
};

module.exports = { log };
