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

    // Log the specific parameters for debugging
    console.log('API Callback - Raw parameters:');
    console.log('  - code:', code ? 'present' : 'missing');
    console.log('  - state:', state);
    console.log('  - oauth_token:', oauth_token);
    console.log('  - oauth_verifier:', oauth_verifier ? 'present' : 'missing');
    console.log('  - error:', error);

    if (error) {
      console.log('API Callback - OAuth error:', error);
      const callbackUrl = await this._callbackService.getCallbackUrl(state);
      if (callbackUrl) {
        // Try to send error notification
        try {
          await this._callbackService.sendCallbackNotification(state, {
            integrationId: '',
            name: '',
            provider: '',
            status: 'error',
            error: error,
          });
        } catch (notificationError) {
          console.error('Failed to send error notification:', notificationError);
        }

        // Clean up and redirect with error
        await this._callbackService.cleanupCallbackUrl(state);
        return response.redirect(`${callbackUrl}?status=error&error=${encodeURIComponent(error)}`);
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

      // For X/Twitter, the oauth_token IS the state that was generated during initiation
      console.log('API Callback - X/Twitter oauth_token (state):', oauth_token);
      console.log('API Callback - X/Twitter oauth_verifier (code):', oauth_verifier ? 'present' : 'missing');
    }

    console.log('API Callback - Final code:', finalCode ? 'present' : 'missing');
    console.log('API Callback - Final state:', finalState);

    // Debug: Check what's stored in Redis for this state
    console.log('API Callback - Checking Redis keys for state:', finalState);
    const storedCallback = await this._callbackService.getCallbackUrl(finalState);
    const storedOrg = await ioRedis.get(`org:${finalState}`);
    const storedLogin = await ioRedis.get(`login:${finalState}`);
    const storedExternal = await ioRedis.get(`external:${finalState}`);

    console.log('API Callback - Stored callback URL:', storedCallback || 'NOT FOUND');
    console.log('API Callback - Stored org ID:', storedOrg || 'NOT FOUND');
    console.log('API Callback - Stored login token:', storedLogin ? 'present' : 'NOT FOUND');
    console.log('API Callback - Stored external data:', storedExternal ? 'present' : 'NOT FOUND');

    // Check TTL for debugging expiration issues
    const callbackTtl = await ioRedis.ttl(`callback:${finalState}`);
    const orgTtl = await ioRedis.ttl(`org:${finalState}`);
    const loginTtl = await ioRedis.ttl(`login:${finalState}`);
    console.log('API Callback - TTL values - callback:', callbackTtl, 'org:', orgTtl, 'login:', loginTtl);

    // Note: For X/Twitter OAuth 1.0a, there is no separate 'state' parameter
    // The oauth_token IS the state, so finalState should be correct
    console.log('API Callback - Using finalState for all lookups:', finalState);

    if (!finalCode || !finalState) {
      throw new HttpException('Missing required OAuth parameters', HttpStatus.BAD_REQUEST);
    }

    try {
      // Find which provider this state belongs to
      let provider: string | null = null;
      let integrationProvider: any = null;
      let getCodeVerifier: string | null = null;
      let details: string | null = null;
      let orgId: string | null = null;

      for (const providerName of this._integrationManager.getAllowedSocialsIntegrations()) {
        const tempProvider = this._integrationManager.getSocialIntegration(providerName);
        const tempCodeVerifier = tempProvider.customFields
          ? 'none'
          : await ioRedis.get(`login:${finalState}`);

        if (tempCodeVerifier) {
          provider = providerName;
          integrationProvider = tempProvider;
          getCodeVerifier = tempCodeVerifier;
          break;
        }
      }

      if (!provider || !integrationProvider) {
        throw new HttpException('Invalid state or expired session', HttpStatus.BAD_REQUEST);
      }

      if (!getCodeVerifier) {
        throw new HttpException('Invalid state or expired session', HttpStatus.BAD_REQUEST);
      }

      // Get details and orgId using finalState
      details = await ioRedis.get(`external:${finalState}`);
      orgId = await ioRedis.get(`org:${finalState}`);

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

      // Get the callback URL to redirect the user (do this BEFORE trying to send notification)
      const callbackUrl = await this._callbackService.getCallbackUrl(finalState);
      console.log('API Callback - Final callback URL lookup with state', finalState, ':', callbackUrl ? 'FOUND' : 'NOT FOUND');

      // If callback URL not found, debug what keys exist
      if (!callbackUrl) {
        console.log('API Callback - Debugging missing callback URL...');
        const allCallbackKeys = await ioRedis.keys('callback:*');
        const allOrgKeys = await ioRedis.keys('org:*');
        const allLoginKeys = await ioRedis.keys('login:*');
        console.log('API Callback - Available callback keys:', allCallbackKeys);
        console.log('API Callback - Available org keys:', allOrgKeys);
        console.log('API Callback - Available login keys:', allLoginKeys);

        // Check if there's a similar state
        const similarKeys = allCallbackKeys.filter((key: string) => key.includes(finalState.substring(0, 10)));
        console.log('API Callback - Similar state keys:', similarKeys);
      }

      if (callbackUrl) {
        // Try to send POST notification, but don't let it block redirection
        try {
          const notificationSent = await this._callbackService.sendCallbackNotification(finalState, callbackData);
          console.log('API Callback - POST notification sent:', notificationSent);
        } catch (error) {
          console.error('API Callback - Failed to send POST notification:', error);
          // Continue with redirection even if POST fails
        }

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
        const redirectUrl = `${callbackUrl}${separator}${params.toString()}`;
        console.log('API Callback - Redirecting to:', redirectUrl);

        // Clean up the callback URL after successful redirection
        await this._callbackService.cleanupCallbackUrl(finalState);

        return response.redirect(redirectUrl);
      } else {
        // No callback URL found in Redis - check if we can use a fallback
        console.log('API Callback - No callback URL found, checking for fallback options');

        // TEMPORARY WORKAROUND: If you want to force redirect to a specific URL for testing
        // Uncomment and modify the URL below:
        /*
        const fallbackCallbackUrl = 'http://laravel.test/settings/social-media/callback/x';
        const params = new URLSearchParams({
          status: callbackData.status,
          provider: callbackData.provider,
          integrationId: callbackData.integrationId,
          ...(callbackData.name && { name: callbackData.name }),
          ...(callbackData.username && { username: callbackData.username }),
          ...(callbackData.picture && { picture: callbackData.picture }),
        });
        const redirectUrl = `${fallbackCallbackUrl}?${params.toString()}`;
        console.log('API Callback - Using fallback redirect to:', redirectUrl);
        return response.redirect(redirectUrl);
        */

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
      console.log('API Callback - Error occurred:', errorMessage);

      // Try to get callback URL for error redirection
      const callbackUrl = await this._callbackService.getCallbackUrl(finalState);

      if (callbackUrl) {
        console.log('API Callback - Found callback URL for error redirection');

        // Try to send error notification
        try {
          await this._callbackService.sendCallbackNotification(finalState, {
            integrationId: '',
            name: '',
            provider: '',
            status: 'error',
            error: errorMessage,
          });
        } catch (notificationError) {
          console.error('Failed to send error notification:', notificationError);
        }

        // Clean up and redirect with error
        await this._callbackService.cleanupCallbackUrl(finalState);
        return response.redirect(`${callbackUrl}?status=error&error=${encodeURIComponent(errorMessage)}`);
      }

      throw new HttpException(
        errorMessage || 'Failed to process OAuth callback',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
