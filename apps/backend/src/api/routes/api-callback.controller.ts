import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationCallbackService } from '@gitroom/nestjs-libraries/services/integration-callback.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { AuthTokenDetails } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

@ApiTags('API Callbacks')
@Controller('/api/callback')
export class ApiCallbackController {
  constructor(
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _callbackService: IntegrationCallbackService
  ) {}

  @Get('/oauth/:provider')
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query() query: Record<string, any>,
    @Res() response: Response
  ) {
    console.log(`API Callback - Provider: ${provider}`);
    console.log('API Callback - Query params:', query);

    const { code, state, oauth_token, oauth_verifier, error } = query;

    if (error) {
      console.log('API Callback - OAuth error:', error);
      const callbackUrl = await this._callbackService.getCallbackUrl(state);
      if (callbackUrl) {
        await this._callbackService.sendCallback(state, {
          integrationId: '',
          name: '',
          provider: '',
          status: 'error',
          error: error,
        });
        return response.redirect(`${callbackUrl}?error=${encodeURIComponent(error)}`);
      }
      throw new HttpException(`OAuth error: ${error}`, HttpStatus.BAD_REQUEST);
    }

    // Handle different OAuth flow parameters
    let finalCode = code;
    let finalState = state;

    // Twitter/X uses different parameter names
    if (oauth_token && oauth_verifier) {
      console.log('API Callback - Using X/Twitter OAuth 1.0a parameters');
      finalCode = oauth_verifier;
      finalState = oauth_token;
    }

    console.log('API Callback - Final code:', finalCode ? 'present' : 'missing');
    console.log('API Callback - Final state:', finalState);

    if (!finalCode || !finalState) {
      throw new HttpException('Missing required OAuth parameters', HttpStatus.BAD_REQUEST);
    }

    try {
      // Find which provider this state belongs to
      let provider: string | null = null;
      let integrationProvider: any = null;

      for (const providerName of this._integrationManager.getAllowedSocialsIntegrations()) {
        const tempProvider = this._integrationManager.getSocialIntegration(providerName);
        const getCodeVerifier = tempProvider.customFields
          ? 'none'
          : await ioRedis.get(`login:${finalState}`);
        
        if (getCodeVerifier) {
          provider = providerName;
          integrationProvider = tempProvider;
          break;
        }
      }

      if (!provider || !integrationProvider) {
        throw new HttpException('Invalid state or expired session', HttpStatus.BAD_REQUEST);
      }

      const getCodeVerifier = integrationProvider.customFields
        ? 'none'
        : await ioRedis.get(`login:${finalState}`);

      if (!getCodeVerifier) {
        throw new HttpException('Invalid state or expired session', HttpStatus.BAD_REQUEST);
      }

      const details = await ioRedis.get(`external:${finalState}`);

      // Get organization ID from state - this is only available for API-initiated flows
      const orgId = await ioRedis.get(`org:${finalState}`);

      // If no org ID is found, this might be a frontend-initiated flow
      // In that case, we should redirect to the frontend to handle the OAuth completion
      if (!orgId) {
        console.log('No organization context found - redirecting to frontend OAuth handler');
        const frontendCallbackUrl = `${process.env.FRONTEND_URL}/integrations/social/${provider}?code=${encodeURIComponent(finalCode)}&state=${encodeURIComponent(finalState)}`;
        return response.redirect(frontendCallbackUrl);
      }

      const authResult = await new Promise<AuthTokenDetails>((resolve, reject) => {
        integrationProvider.authenticate(
          { code: finalCode, codeVerifier: getCodeVerifier },
          details ? JSON.parse(details) : undefined
        ).then((auth: AuthTokenDetails | string) => {
          if (typeof auth === 'string') {
            reject(new Error(auth));
          } else {
            resolve(auth);
          }
        }).catch(reject);
      });

      const { accessToken, expiresIn, refreshToken, id, name, picture, username, additionalSettings } = authResult;

      const integration = await this._integrationService.createOrUpdateIntegration(
        additionalSettings,
        !!integrationProvider.oneTimeToken,
        orgId,
        name.trim(),
        picture,
        'social',
        String(id),
        provider,
        accessToken,
        refreshToken,
        expiresIn,
        username,
        integrationProvider.isBetweenSteps,
        undefined, // refresh
        0, // timezone - default
        details
      );

      const callbackData = {
        integrationId: integration.id,
        name: integration.name,
        provider: integration.providerIdentifier,
        status: (integration.inBetweenSteps ? 'pending' : 'connected') as 'pending' | 'connected',
        picture: integration.picture,
        username: integration.profile,
      };

      // Try to send callback notification
      const callbackSent = await this._callbackService.sendCallback(finalState, callbackData);

      // Get the callback URL to redirect the user
      const callbackUrl = await this._callbackService.getCallbackUrl(finalState);
      console.log('API Callback - Stored callback URL:', callbackUrl ? 'found' : 'not found');

      if (callbackUrl) {
        await this._callbackService.sendCallback(finalState, callbackData);

        // Redirect user to their callback URL with success parameters
        const params = new URLSearchParams({
          status: callbackData.status,
          provider: callbackData.provider,
          integrationId: callbackData.integrationId,
          ...(callbackData.name && { name: callbackData.name }),
          ...(callbackData.username && { username: callbackData.username }),
          ...(callbackData.picture && { picture: callbackData.picture }),
        });

        const separator = callbackUrl.includes('?') ? '&' : '?';
        console.log('API Callback - Redirecting to:', `${callbackUrl}${separator}${params.toString()}`);
        return response.redirect(`${callbackUrl}${separator}${params.toString()}`);
      } else {
        // No callback URL was provided, return JSON response
        console.log('API Callback - No callback URL, returning JSON response');
        return response.status(200).json({
          success: true,
          message: 'Integration completed successfully',
          data: callbackData,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const callbackUrl = await this._callbackService.getCallbackUrl(finalState);
      if (callbackUrl) {
        await this._callbackService.sendCallback(finalState, {
          integrationId: '',
          name: '',
          provider: '',
          status: 'error',
          error: errorMessage,
        });
        return response.redirect(`${callbackUrl}?error=${encodeURIComponent(errorMessage)}`);
      }

      throw new HttpException(
        errorMessage || 'Failed to process OAuth callback',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
