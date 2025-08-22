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
          name: activeOrg.name,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      return {
        success: false,
        message: error.message || 'Login failed',
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
        throw new HttpException('Email already exists', HttpStatus.CONFLICT);
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

      // Create API key
      const apiKey = await this._userApiKeyService.createApiKey({
        userId: user.id,
        organizationId: organization.id,
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
          id: organization.id,
          name: organization.name,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      return {
        success: false,
        message: error.message || 'Registration failed',
      };
    }
  }
}
