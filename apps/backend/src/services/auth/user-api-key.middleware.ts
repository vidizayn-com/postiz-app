import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserApiKeyService } from '@gitroom/nestjs-libraries/database/prisma/user-api-keys/user-api-key.service';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

@Injectable()
export class UserApiKeyMiddleware implements NestMiddleware {
  constructor(private _userApiKeyService: UserApiKeyService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const auth = (req.headers.authorization || req.headers.Authorization) as string;
    
    if (!auth) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        error: 'No API Key found',
        message: 'Please provide an API key in the Authorization header' 
      });
      return;
    }

    // Extract the API key from the Authorization header
    // Support both "Bearer <key>" and direct key formats
    let apiKey = auth;
    if (auth.startsWith('Bearer ')) {
      apiKey = auth.substring(7);
    }

    try {
      // Get client IP address
      const ip = req.ip || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress || 
                 (req.connection as any)?.socket?.remoteAddress ||
                 req.headers['x-forwarded-for'] as string ||
                 req.headers['x-real-ip'] as string;

      // Validate the API key
      const validatedKey = await this._userApiKeyService.validateApiKey(apiKey, ip);
      
      if (!validatedKey) {
        res.status(HttpStatus.UNAUTHORIZED).json({ 
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or inactive' 
        });
        return;
      }

      // Check if user is activated
      if (!validatedKey.user.activated) {
        res.status(HttpStatus.UNAUTHORIZED).json({ 
          error: 'User not activated',
          message: 'User account is not activated' 
        });
        return;
      }

      // Check subscription if required
      if (!!process.env.STRIPE_SECRET_KEY && !validatedKey.organization.subscription) {
        res.status(HttpStatus.UNAUTHORIZED).json({ 
          error: 'No subscription found',
          message: 'Organization does not have an active subscription' 
        });
        return;
      }

      // Attach user and organization information to the request
      // This mimics the structure used by the existing AuthMiddleware
      // @ts-ignore
      req.user = {
        id: validatedKey.user.id,
        email: validatedKey.user.email,
        name: validatedKey.user.name,
        activated: validatedKey.user.activated,
        isSuperAdmin: validatedKey.user.isSuperAdmin,
      };

      // @ts-ignore
      req.org = {
        id: validatedKey.organization.id,
        name: validatedKey.organization.name,
        subscription: validatedKey.organization.subscription,
        // Add users array to match the expected structure
        users: [{ 
          user: { 
            role: 'USER' // Default role for API key access
          } 
        }],
      };

      // @ts-ignore - Add API key information for potential logging/tracking
      req.apiKey = {
        id: validatedKey.apiKey.id,
        name: validatedKey.apiKey.name,
      };

    } catch (err) {
      console.error('API Key validation error:', err);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        error: 'Authentication error',
        message: 'An error occurred while validating the API key' 
      });
      return;
    }

    next();
  }
}
