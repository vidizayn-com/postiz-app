import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';

import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { UserApiKeyService } from '@gitroom/nestjs-libraries/database/prisma/user-api-keys/user-api-key.service';

import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponseDto,
} from '@gitroom/nestjs-libraries/dtos/auth/api-key-auth.dto';

@ApiTags('API Key Management')
@Controller('/api-keys')
export class ApiKeyManagementController {
  constructor(private _userApiKeyService: UserApiKeyService) {}

  @Get('/')
  async listApiKeys(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ): Promise<ApiKeyResponseDto[]> {
    return this._userApiKeyService.getUserApiKeys(user.id, org.id);
  }

  @Post('/')
  async createApiKey(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateApiKeyDto
  ): Promise<ApiKeyResponseDto> {
    try {
      return await this._userApiKeyService.createApiKey({
        userId: user.id,
        organizationId: org.id,
        name: body.name,
        expiresInDays: body.expiresInDays,
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new HttpException('API key name already exists', HttpStatus.CONFLICT);
      }
      if (error.message.includes('Maximum')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Failed to create API key', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('/:id')
  async updateApiKey(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateApiKeyDto
  ): Promise<ApiKeyResponseDto> {
    try {
      return await this._userApiKeyService.updateApiKey(id, user.id, org.id, body);
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new HttpException('API key name already exists', HttpStatus.CONFLICT);
      }
      throw new HttpException('Failed to update API key', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('/:id/regenerate')
  async regenerateApiKey(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ): Promise<ApiKeyResponseDto> {
    try {
      return await this._userApiKeyService.regenerateApiKey(id, user.id, org.id);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to regenerate API key', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('/:id')
  async deleteApiKey(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this._userApiKeyService.deleteApiKey(id, user.id);
      return {
        success: true,
        message: 'API key deleted successfully',
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to delete API key', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('/cleanup-expired')
  async cleanupExpiredKeys(): Promise<{ cleaned: number; message: string }> {
    try {
      const cleaned = await this._userApiKeyService.cleanupExpiredKeys();
      return {
        cleaned,
        message: `Cleaned up ${cleaned} expired API keys`,
      };
    } catch (error) {
      throw new HttpException('Failed to cleanup expired keys', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
