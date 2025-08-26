import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationCallbackService } from '@gitroom/nestjs-libraries/services/integration-callback.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { 
  ApiConnectIntegrationDto, 
  ApiInitiateIntegrationDto 
} from '@gitroom/nestjs-libraries/dtos/integrations/connect.integration.dto';
import {
  ApiKeyIntegrationDto,
  UpdateIntegrationDto
} from '@gitroom/nestjs-libraries/dtos/integrations/api.integration.dto';
import { AuthTokenDetails } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

@ApiTags('User API - Integrations')
@Controller('/api/v1/integrations')
export class UserApiIntegrationsController {
  constructor(
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _callbackService: IntegrationCallbackService
  ) {}

  @Get('/platforms')
  async getAvailablePlatforms() {
    const integrations = await this._integrationManager.getAllIntegrations();
    return {
      platforms: integrations.social.map(platform => ({
        identifier: platform.identifier,
        name: platform.name,
        toolTip: platform.toolTip,
        editor: platform.editor,
        isExternal: platform.isExternal,
        isWeb3: platform.isWeb3,
        customFields: platform.customFields || [],
        supportsApiKey: !!platform.customFields, // Platforms with custom fields typically support API keys
      }))
    };
  }

  @Post('/initiate')
  async initiateIntegration(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ApiInitiateIntegrationDto
  ) {
    const { provider, callbackUrl, externalUrl } = body;

    if (!this._integrationManager.getAllowedSocialsIntegrations().includes(provider)) {
      throw new HttpException('Integration not allowed', HttpStatus.BAD_REQUEST);
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(provider);

    if (integrationProvider.externalUrl && !externalUrl) {
      throw new HttpException('Missing external url for this provider', HttpStatus.BAD_REQUEST);
    }

    try {
      const getExternalUrl = integrationProvider.externalUrl
        ? {
            ...(await integrationProvider.externalUrl(externalUrl)),
            instanceUrl: externalUrl,
          }
        : undefined;

      // Generate auth URL
      const { codeVerifier, state, url } = await integrationProvider.generateAuthUrl(getExternalUrl);

      let authUrl = url;

      // If callback URL is provided, modify the OAuth URL to use our API callback endpoint
      if (callbackUrl) {
        const apiCallbackUrl = `${process.env.BACKEND_URL || process.env.FRONTEND_URL}/api/callback/oauth/${provider}`;
        const frontendCallbackUrl = `${process.env.FRONTEND_URL}/integrations/social/${provider}`;

        // Replace the frontend callback URL with our API callback URL
        authUrl = url.replace(
          encodeURIComponent(frontendCallbackUrl),
          encodeURIComponent(apiCallbackUrl)
        );
      }

      // Store callback URL and organization context
      if (callbackUrl) {
        await this._callbackService.storeCallbackUrl(state, callbackUrl);
      }

      // Store organization ID for the callback
      await ioRedis.set(`org:${state}`, org.id, 'EX', 300);
      await ioRedis.set(`login:${state}`, codeVerifier, 'EX', 300);
      await ioRedis.set(`external:${state}`, JSON.stringify(getExternalUrl), 'EX', 300);

      return {
        authUrl,
        state,
        provider,
        callbackUrl: callbackUrl || null,
        message: callbackUrl
          ? 'Redirect user to authUrl. Integration result will be sent to your callback URL.'
          : 'Redirect user to authUrl to complete OAuth flow'
      };
    } catch (err) {
      throw new HttpException('Failed to generate auth URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('/api-key')
  async connectWithApiKey(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ApiKeyIntegrationDto
  ) {
    const { provider, apiKey, apiSecret, name, additionalSettings, callbackUrl } = body;

    if (!this._integrationManager.getAllowedSocialsIntegrations().includes(provider)) {
      throw new HttpException('Integration not allowed', HttpStatus.BAD_REQUEST);
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(provider);

    // Check if provider supports custom fields (API key authentication)
    if (!integrationProvider.customFields) {
      throw new HttpException(
        'This provider does not support API key authentication. Use OAuth flow instead.',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Get the custom fields to understand what's required
      const customFields = await integrationProvider.customFields();

      // Build the authentication payload based on custom fields
      const authPayload: any = {};

      for (const field of customFields) {
        switch (field.key) {
          case 'apiKey':
            authPayload.apiKey = apiKey;
            break;
          case 'password':
            authPayload.password = apiKey; // For providers like Nostr that use 'password' field
            break;
          case 'identifier':
            authPayload.identifier = additionalSettings?.identifier || name;
            break;
          case 'service':
            authPayload.service = additionalSettings?.service || field.defaultValue;
            break;
          default:
            if (additionalSettings && additionalSettings[field.key]) {
              authPayload[field.key] = additionalSettings[field.key];
            }
        }
      }

      // Add API secret if provided and needed
      if (apiSecret) {
        authPayload.apiSecret = apiSecret;
      }

      // Encode the payload as base64 (this is how custom field providers expect it)
      const encodedPayload = Buffer.from(JSON.stringify(authPayload)).toString('base64');

      // Authenticate using the provider's authenticate method
      const authResult = await integrationProvider.authenticate({
        code: encodedPayload,
        codeVerifier: 'none', // Custom field providers use 'none'
      });

      if (typeof authResult === 'string') {
        throw new HttpException(authResult, HttpStatus.BAD_REQUEST);
      }

      const { accessToken, expiresIn, refreshToken, id, name: providerName, picture, username, additionalSettings: providerSettings } = authResult;

      const integration = await this._integrationService.createOrUpdateIntegration(
        providerSettings,
        !!integrationProvider.oneTimeToken,
        org.id,
        name || providerName.trim(),
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
        undefined // customInstanceDetails
      );

      const response = {
        integrationId: integration.id,
        name: integration.name,
        provider: integration.providerIdentifier,
        status: integration.inBetweenSteps ? 'pending' : 'connected',
        picture: integration.picture,
        username: integration.profile,
        createdAt: integration.createdAt,
      };

      // If callback URL is provided, send notification
      if (callbackUrl) {
        try {
          await fetch(callbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Postiz-Integration-Callback/1.0',
            },
            body: JSON.stringify({
              ...response,
              timestamp: new Date().toISOString(),
              method: 'api-key',
            }),
          });
        } catch (error) {
          // Log error but don't fail the integration
          console.error('Failed to send callback:', error);
        }

        return {
          ...response,
          callbackUrl,
          message: 'Integration created successfully. Callback notification sent.'
        };
      }

      return response;
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to authenticate with API key',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('/connect')
  async connectIntegration(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ApiConnectIntegrationDto
  ) {
    const { state, code, timezone, refresh, callbackUrl } = body;

    // Get the provider from state (we need to store this in initiate)
    const storedCallbackUrl = await ioRedis.get(`callback:${state}`);
    const finalCallbackUrl = callbackUrl || storedCallbackUrl;

    // Find which provider this state belongs to by checking all providers
    let provider: string | null = null;
    let integrationProvider: any = null;

    for (const providerName of this._integrationManager.getAllowedSocialsIntegrations()) {
      const tempProvider = this._integrationManager.getSocialIntegration(providerName);
      const getCodeVerifier = tempProvider.customFields
        ? 'none'
        : await ioRedis.get(`login:${state}`);
      
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
      : await ioRedis.get(`login:${state}`);

    if (!getCodeVerifier) {
      throw new HttpException('Invalid state or expired session', HttpStatus.BAD_REQUEST);
    }

    const details = await ioRedis.get(`external:${state}`);

    try {
      const authResult = await new Promise<AuthTokenDetails>((resolve) => {
        integrationProvider.authenticate(
          { code, codeVerifier: getCodeVerifier, refresh },
          details ? JSON.parse(details) : undefined
        ).then((auth: AuthTokenDetails | string) => {
          if (typeof auth === 'string') {
            throw new HttpException(auth, HttpStatus.BAD_REQUEST);
          }
          resolve(auth);
        });
      });

      const { accessToken, expiresIn, refreshToken, id, name, picture, username, additionalSettings } = authResult;

      const integration = await this._integrationService.createOrUpdateIntegration(
        additionalSettings,
        !!integrationProvider.oneTimeToken,
        org.id,
        name.trim(),
        picture,
        'social',
        String(id),
        provider,
        accessToken,
        refreshToken,
        expiresIn,
        username,
        refresh ? false : integrationProvider.isBetweenSteps,
        refresh,
        +timezone,
        details
      );

      const response = {
        integrationId: integration.id,
        name: integration.name,
        provider: integration.providerIdentifier,
        status: integration.inBetweenSteps ? 'pending' : 'connected',
        picture: integration.picture,
        username: integration.profile,
        createdAt: integration.createdAt,
      };

      // If callback URL is provided, we would typically make a POST request to it
      // For now, we'll include it in the response
      if (finalCallbackUrl) {
        return {
          ...response,
          callbackUrl: finalCallbackUrl,
          message: 'Integration created successfully. Callback URL should be notified separately.'
        };
      }

      return response;
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to authenticate with provider',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('/list')
  async getIntegrations(@GetOrgFromRequest() org: Organization) {
    const integrations = await this._integrationService.getIntegrationsList(org.id);
    
    return {
      integrations: integrations.map(integration => ({
        id: integration.id,
        name: integration.name,
        provider: integration.providerIdentifier,
        status: integration.disabled ? 'disabled' : (integration.inBetweenSteps ? 'pending' : 'connected'),
        picture: integration.picture,
        username: integration.profile,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      }))
    };
  }

  @Get('/:id/status')
  async getIntegrationStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const integration = await this._integrationService.getIntegrationById(org.id, id);
    
    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: integration.id,
      name: integration.name,
      provider: integration.providerIdentifier,
      status: integration.disabled ? 'disabled' : (integration.inBetweenSteps ? 'pending' : 'connected'),
      picture: integration.picture,
      username: integration.profile,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      refreshNeeded: integration.refreshNeeded,
    };
  }

  @Post('/:id/enable')
  async enableIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const integration = await this._integrationService.getIntegrationById(org.id, id);

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    // Get organization subscription info to check channel limits
    const totalChannels = 999; // TODO: Get from subscription service

    await this._integrationService.enableChannel(org.id, totalChannels, id);

    return {
      id: integration.id,
      name: integration.name,
      provider: integration.providerIdentifier,
      status: 'connected',
      message: 'Integration enabled successfully'
    };
  }

  @Post('/:id/disable')
  async disableIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const integration = await this._integrationService.getIntegrationById(org.id, id);

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    await this._integrationService.disableChannel(org.id, id);

    return {
      id: integration.id,
      name: integration.name,
      provider: integration.providerIdentifier,
      status: 'disabled',
      message: 'Integration disabled successfully'
    };
  }

  @Post('/:id/update')
  async updateIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateIntegrationDto
  ) {
    const { name, settings } = body;
    const integration = await this._integrationService.getIntegrationById(org.id, id);

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    const updateData: any = {};
    if (name) {
      updateData.name = name;
    }
    if (settings) {
      updateData.additionalSettings = JSON.stringify(settings);
    }

    await this._integrationService.updateIntegration(id, updateData);

    const updatedIntegration = await this._integrationService.getIntegrationById(org.id, id);

    return {
      id: updatedIntegration!.id,
      name: updatedIntegration!.name,
      provider: updatedIntegration!.providerIdentifier,
      status: updatedIntegration!.disabled ? 'disabled' : (updatedIntegration!.inBetweenSteps ? 'pending' : 'connected'),
      picture: updatedIntegration!.picture,
      username: updatedIntegration!.profile,
      updatedAt: updatedIntegration!.updatedAt,
      message: 'Integration updated successfully'
    };
  }

  @Post('/:id/refresh')
  async refreshIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const integration = await this._integrationService.getIntegrationById(org.id, id);

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    if (!integrationProvider) {
      throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Attempt to refresh the token
      const refreshedAuth = await integrationProvider.refreshToken(integration.refreshToken || '');

      await this._integrationService.createOrUpdateIntegration(
        undefined, // additionalSettings
        !!integrationProvider.oneTimeToken,
        org.id,
        integration.name,
        integration.picture,
        'social',
        integration.internalId,
        integration.providerIdentifier,
        refreshedAuth.accessToken,
        refreshedAuth.refreshToken,
        refreshedAuth.expiresIn,
        integration.profile,
        false, // isBetweenSteps
        undefined, // refresh
        0, // timezone
        integration.customInstanceDetails
      );

      return {
        id: integration.id,
        name: integration.name,
        provider: integration.providerIdentifier,
        status: 'connected',
        message: 'Integration refreshed successfully'
      };
    } catch (error) {
      throw new HttpException(
        'Failed to refresh integration: ' + (error instanceof Error ? error.message : 'Unknown error'),
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete('/:id')
  async deleteIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const integration = await this._integrationService.getIntegrationById(org.id, id);

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    // Check if there are posts associated with this integration
    const posts = await this._integrationService.getPostsForChannel(org.id, id);

    await this._integrationService.deleteChannel(org.id, id);

    return {
      message: 'Integration deleted successfully',
      deletedPostsCount: posts.length
    };
  }
}
