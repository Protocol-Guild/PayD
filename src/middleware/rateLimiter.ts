import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

export const rateLimiter = rateLimit({
    store: new (require('rate-limit-redis').RedisStore)({
        client: redisClient,
    }),
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP
    message: 'Muitas requisições a partir desse IP, tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
    store: new (require('rate-limit-redis').RedisStore)({
        client: redisClient,
    }),
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10, // Limite de 10 requisições por IP
    message: 'Muitas requisições a partir desse IP, tente novamente em 1 minuto.',
    standardHeaders: true,
    legacyHeaders: false,
});
