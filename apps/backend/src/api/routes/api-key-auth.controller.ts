import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RealIP } from 'nestjs-real-ip';
import { UserAgent } from '@gitroom/nestjs-libraries/user/user.agent';
import { Provider } from '@prisma/client';

import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { UserApiKeyService } from '@gitroom/nestjs-libraries/database/prisma/user-api-keys/user-api-key.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';

import {
  ApiKeyLoginDto,
  ApiKeyRegisterDto,
  ApiKeyAuthResponseDto,
} from '@gitroom/nestjs-libraries/dtos/auth/api-key-auth.dto';

@ApiTags('API Key Authentication')
@Controller('/auth/api-key')
export class ApiKeyAuthController {
  constructor(
    private _authService: AuthService,
    private _userApiKeyService: UserApiKeyService,
    private _usersService: UsersService,
    private _organizationService: OrganizationService
  ) {}

  @Post('/login')
  async loginWithApiKey(
    @Body() body: ApiKeyLoginDto,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ): Promise<ApiKeyAuthResponseDto> {
    try {
      // Validate user credentials
      if (body.provider !== Provider.LOCAL) {
        throw new HttpException('Only local authentication supported for API key login', HttpStatus.BAD_REQUEST);
      }

      const user = await this._usersService.getUserByEmail(body.email);
      if (!user || !AuthChecker.comparePassword(body.password, user.password)) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      if (!user.activated) {
        throw new HttpException('User account is not activated', HttpStatus.UNAUTHORIZED);
      }

      // Get user's organizations
      const organizations = await this._organizationService.getOrgsByUserId(user.id);
      if (!organizations || organizations.length === 0) {
        throw new HttpException('No organization found for user', HttpStatus.BAD_REQUEST);
      }

      // Use the first active organization
      const activeOrg = organizations.find(org => !org.users[0].disabled) || organizations[0];

      // Create API key
      const apiKey = await this._userApiKeyService.createApiKey({
        userId: user.id,
        organizationId: activeOrg.id,
        name: body.keyName,
        expiresInDays: body.expiresInDays,
      });

      return {
        success: true,
        apiKey,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
        },
        organization: {
          id: activeOrg.id,
          name: activeOrg.name || activeOrg.id,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  @Post('/register')
  async registerWithApiKey(
    @Body() body: ApiKeyRegisterDto,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ): Promise<ApiKeyAuthResponseDto> {
    try {
      // Check if registration is allowed
      if (!(await this._authService.canRegister(body.provider))) {
        throw new HttpException('Registration is disabled', HttpStatus.FORBIDDEN);
      }

      if (body.provider !== Provider.LOCAL) {
        throw new HttpException('Only local registration supported for API key registration', HttpStatus.BAD_REQUEST);
      }

      // Check if user already exists
      const existingUser = await this._usersService.getUserByEmail(body.email);
      if (existingUser) {
        // If user exists, perform login flow instead of throwing error
        // Validate registration token instead of password
        const registrationToken = process.env.API_KEY_REGISTRATION_TOKEN;
        if (!registrationToken) {
          throw new HttpException('API key registration is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        if (body.password !== registrationToken) {
          throw new HttpException('Invalid registration token', HttpStatus.UNAUTHORIZED);
        }

        if (!existingUser.activated) {
          throw new HttpException('User account is not activated', HttpStatus.UNAUTHORIZED);
        }

        // Get user's organizations
        const organizations = await this._organizationService.getOrgsByUserId(existingUser.id);
        if (!organizations || organizations.length === 0) {
          throw new HttpException('No organization found for user', HttpStatus.BAD_REQUEST);
        }

        // Use the first active organization
        const activeOrg = organizations.find((org: any) => !org.users[0].disabled) || organizations[0];

        // Create API key for existing user (handle errors gracefully)
        let apiKey;
        try {
          apiKey = await this._userApiKeyService.createApiKey({
            userId: existingUser.id,
            organizationId: activeOrg.id,
            name: body.keyName,
            expiresInDays: body.expiresInDays,
          });
        } catch (error) {
          // If key name already exists or user has too many keys, get the existing/recent key
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists') || errorMessage.includes('Maximum')) {
            // Get existing key with same name first
            const existingKey = await this._userApiKeyService.findByNameAndUser(
              body.keyName,
              existingUser.id,
              activeOrg.id
            );

            if (existingKey) {
              // Return existing key but regenerate it to get the key value
              apiKey = await this._userApiKeyService.regenerateApiKey(
                existingKey.id,
                existingUser.id,
                activeOrg.id
              );
            } else {
              // If no existing key with same name, get the most recent key and regenerate it
              const userKeys = await this._userApiKeyService.getUserApiKeys(existingUser.id, activeOrg.id);
              if (userKeys.length > 0) {
                const mostRecentKey = userKeys[0]; // getUserApiKeys returns keys ordered by createdAt desc
                apiKey = await this._userApiKeyService.regenerateApiKey(
                  mostRecentKey.id,
                  existingUser.id,
                  activeOrg.id
                );
              } else {
                // This shouldn't happen, but if it does, throw the original error
                throw error;
              }
            }
          } else {
            throw error;
          }
        }

        return {
          success: true,
          apiKey,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name || '',
          },
          organization: {
            id: activeOrg.id,
            name: activeOrg.name || activeOrg.id,
          },
        };
      }

      // Create organization and user
      const createOrgUserDto = {
        email: body.email,
        password: body.password,
        provider: body.provider,
        company: body.company,
      };

      const orgAndUser = await this._organizationService.createOrgAndUser(
        createOrgUserDto,
        ip,
        userAgent
      );

      const user = orgAndUser.users[0].user;
      const organization = orgAndUser;

      // For API key registration, we'll auto-activate the user
      // In a production environment, you might want to require email verification
      if (!user.activated) {
        await this._usersService.activateUser(user.id);
      }

      // Create API key (for new users, this should always succeed)
      let apiKey;
      try {
        apiKey = await this._userApiKeyService.createApiKey({
          userId: user.id,
          organizationId: organization.id,
          name: body.keyName,
          expiresInDays: body.expiresInDays,
        });
      } catch (error) {
        // For new users, this shouldn't happen, but handle gracefully just in case
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('already exists') || errorMessage.includes('Maximum')) {
          // Get existing key with same name first
          const existingKey = await this._userApiKeyService.findByNameAndUser(
            body.keyName,
            user.id,
            organization.id
          );

          if (existingKey) {
            // Return existing key but regenerate it to get the key value
            apiKey = await this._userApiKeyService.regenerateApiKey(
              existingKey.id,
              user.id,
              organization.id
            );
          } else {
            // If no existing key with same name, get the most recent key and regenerate it
            const userKeys = await this._userApiKeyService.getUserApiKeys(user.id, organization.id);
            if (userKeys.length > 0) {
              const mostRecentKey = userKeys[0]; // getUserApiKeys returns keys ordered by createdAt desc
              apiKey = await this._userApiKeyService.regenerateApiKey(
                mostRecentKey.id,
                user.id,
                organization.id
              );
            } else {
              // This shouldn't happen, but if it does, throw the original error
              throw error;
            }
          }
        } else {
          throw error;
        }
      }

      return {
        success: true,
        apiKey,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
        },
        organization: {
          id: organization.id,
          name: organization.name || organization.id,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }
}
