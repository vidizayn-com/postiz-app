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
    const { code, state, oauth_token, oauth_verifier, error } = query;
    
    if (error) {
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
      finalCode = oauth_verifier;
      finalState = oauth_token;
    }

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

      // Get organization ID from state (we need to store this in initiate)
      const orgId = await ioRedis.get(`org:${finalState}`);
      if (!orgId) {
        throw new HttpException('Organization context not found', HttpStatus.BAD_REQUEST);
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

      // Try to send callback
      const callbackSent = await this._callbackService.sendCallback(finalState, callbackData);
      
      if (callbackSent) {
        // If callback was sent successfully, show a success page
        return response.send(`
          <html>
            <head><title>Integration Successful</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>✅ Integration Successful</h1>
              <p>Your ${provider} account has been successfully connected.</p>
              <p>You can close this window now.</p>
              <script>
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } else {
        // No callback URL was provided, return JSON response
        return response.json(callbackData);
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
