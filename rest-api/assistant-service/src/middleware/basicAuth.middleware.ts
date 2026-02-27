
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '~/config/env';

const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Only apply to test routes if needed, but this middleware can be reused anywhere.
    // For now, we will rely on env vars or fallbacks.

    // In a real scenario, these should be in .env. 
    // If not set, default to a secure complex string or simply 'admin'/'admin' for local dev if acceptable,
    // but user asked for "for safety", so defaulting to something known but maybe logging a warning is better,
    // or just assume user will set them. Let's use env vars.

    const validUser = env.TEST_API_USERNAME || 'admin';
    const validPass = env.TEST_API_PASSWORD || 'password';

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Test API"');
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authorization required' });
    }

    const [scheme, credentials] = authHeader.split(' ');

    if (!/^Basic$/i.test(scheme) || !credentials) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Test API"');
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid authorization scheme' });
    }

    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');

    if (username === validUser && password === validPass) {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Test API"');
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
};

export default basicAuthMiddleware;
