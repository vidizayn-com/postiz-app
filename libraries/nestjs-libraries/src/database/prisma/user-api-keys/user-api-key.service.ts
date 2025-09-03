import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { UserApiKeyRepository, CreateUserApiKeyData } from './user-api-key.repository';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { UserApiKey } from '@prisma/client';

type UserApiKeyWithRelations = UserApiKey & {
  user: {
    id: string;
    email: string;
    name: string;
    activated: boolean;
    isSuperAdmin: boolean;
  };
  organization: {
    id: string;
    name: string;
    subscription: {
      subscriptionTier: string;
      totalChannels: number;
      isLifetime: boolean;
    } | null;
  };
};

export interface CreateApiKeyRequest {
  userId: string;
  organizationId: string;
  name: string;
  expiresInDays?: number;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string; // Only returned when creating
  lastUsedAt?: Date;
  lastUsedIp?: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface ValidatedApiKey {
  user: {
    id: string;
    email: string;
    name: string;
    activated: boolean;
    isSuperAdmin: boolean;
  };
  organization: {
    id: string;
    name: string;
    subscription?: {
      subscriptionTier: string;
      totalChannels: number;
      isLifetime: boolean;
    };
  };
  apiKey: {
    id: string;
    name: string;
  };
}

@Injectable()
export class UserApiKeyService {
  private readonly MAX_KEYS_PER_USER = 10;
  private readonly KEY_PREFIX = 'postiz_live_';
  private readonly TEST_KEY_PREFIX = 'postiz_test_';

  constructor(private _userApiKeyRepository: UserApiKeyRepository) {}

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    // Check if user already has too many keys
    const existingKeysCount = await this._userApiKeyRepository.countUserApiKeys(
      request.userId,
      request.organizationId
    );

    if (existingKeysCount >= this.MAX_KEYS_PER_USER) {
      throw new BadRequestException(`Maximum of ${this.MAX_KEYS_PER_USER} API keys allowed per user`);
    }

    // Check if name is already used by this user
    const existingKey = await this._userApiKeyRepository.findByNameAndUser(
      request.name,
      request.userId,
      request.organizationId
    );

    if (existingKey) {
      throw new BadRequestException('API key name already exists');
    }

    // Generate the API key
    const keyValue = this.generateApiKey();
    const keyHash = AuthService.fixedEncryption(keyValue);

    // Calculate expiration date
    const expiresAt = request.expiresInDays
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const createData: CreateUserApiKeyData = {
      userId: request.userId,
      organizationId: request.organizationId,
      keyHash,
      name: request.name,
      expiresAt,
    };

    const apiKey = await this._userApiKeyRepository.createApiKey(createData);

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: keyValue, // Only returned when creating
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }

  async createOrGetApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    // First, check if a key with the same name already exists
    const existingKey = await this._userApiKeyRepository.findByNameAndUser(
      request.name,
      request.userId,
      request.organizationId
    );

    if (existingKey) {
      // Return the existing key (without the actual key value for security)
      return {
        id: existingKey.id,
        name: existingKey.name,
        lastUsedAt: existingKey.lastUsedAt,
        lastUsedIp: existingKey.lastUsedIp,
        expiresAt: existingKey.expiresAt,
        isActive: existingKey.isActive,
        createdAt: existingKey.createdAt,
      };
    }

    // Check if user has reached the maximum limit
    const existingKeysCount = await this._userApiKeyRepository.countUserApiKeys(
      request.userId,
      request.organizationId
    );

    if (existingKeysCount >= this.MAX_KEYS_PER_USER) {
      // If user has reached the limit, return the most recently created key
      const userKeys = await this._userApiKeyRepository.findUserApiKeys(
        request.userId,
        request.organizationId
      );

      if (userKeys.length > 0) {
        // Sort by creation date and return the most recent one
        const mostRecentKey = userKeys.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        return {
          id: mostRecentKey.id,
          name: mostRecentKey.name,
          lastUsedAt: mostRecentKey.lastUsedAt,
          lastUsedIp: mostRecentKey.lastUsedIp,
          expiresAt: mostRecentKey.expiresAt,
          isActive: mostRecentKey.isActive,
          createdAt: mostRecentKey.createdAt,
        };
      }
    }

    // If no existing key and under the limit, create a new one
    return this.createApiKey(request);
  }

  async validateApiKey(keyValue: string, ip?: string): Promise<ValidatedApiKey | null> {
    if (!this.isValidKeyFormat(keyValue)) {
      return null;
    }

    const keyHash = AuthService.fixedEncryption(keyValue);
    const apiKey = await this._userApiKeyRepository.findByKeyHash(keyHash) as UserApiKeyWithRelations | null;

    if (!apiKey) {
      return null;
    }

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      // Deactivate expired key
      await this._userApiKeyRepository.updateApiKey(apiKey.id, apiKey.userId, {
        isActive: false,
      });
      return null;
    }

    // Check if user is activated
    if (!apiKey.user.activated) {
      return null;
    }

    // Update last used information
    if (ip) {
      await this._userApiKeyRepository.updateLastUsed(keyHash, ip);
    }

    return {
      user: {
        id: apiKey.user.id,
        email: apiKey.user.email,
        name: apiKey.user.name,
        activated: apiKey.user.activated,
        isSuperAdmin: apiKey.user.isSuperAdmin,
      },
      organization: {
        id: apiKey.organization.id,
        name: apiKey.organization.name,
        subscription: apiKey.organization.subscription,
      },
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
      },
    };
  }

  async getUserApiKeys(userId: string, organizationId: string): Promise<ApiKeyResponse[]> {
    const apiKeys = await this._userApiKeyRepository.findUserApiKeys(userId, organizationId);

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
    }));
  }

  async updateApiKey(
    id: string,
    userId: string,
    organizationId: string,
    updates: { name?: string; isActive?: boolean }
  ): Promise<ApiKeyResponse> {
    // If updating name, check for conflicts
    if (updates.name) {
      const existingKey = await this._userApiKeyRepository.findByNameAndUser(
        updates.name,
        userId,
        organizationId
      );

      if (existingKey && existingKey.id !== id) {
        throw new BadRequestException('API key name already exists');
      }
    }

    const updatedKey = await this._userApiKeyRepository.updateApiKey(id, userId, updates);

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      lastUsedAt: updatedKey.lastUsedAt,
      lastUsedIp: updatedKey.lastUsedIp,
      expiresAt: updatedKey.expiresAt,
      isActive: updatedKey.isActive,
      createdAt: updatedKey.createdAt,
    };
  }

  async deleteApiKey(id: string, userId: string): Promise<void> {
    try {
      await this._userApiKeyRepository.deleteApiKey(id, userId);
    } catch (error) {
      throw new NotFoundException('API key not found');
    }
  }

  async regenerateApiKey(id: string, userId: string, organizationId: string): Promise<ApiKeyResponse> {
    // Get the existing key to preserve name and expiration
    const existingKeys = await this._userApiKeyRepository.findUserApiKeys(userId, organizationId);
    const existingKey = existingKeys.find((key) => key.id === id);

    if (!existingKey) {
      throw new NotFoundException('API key not found');
    }

    // Generate new key value and hash
    const keyValue = this.generateApiKey();
    const keyHash = AuthService.fixedEncryption(keyValue);

    const updatedKey = await this._userApiKeyRepository.updateApiKey(id, userId, {
      keyHash,
      lastUsedAt: null,
      lastUsedIp: null,
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      key: keyValue, // Return the new key value
      lastUsedAt: updatedKey.lastUsedAt,
      lastUsedIp: updatedKey.lastUsedIp,
      expiresAt: updatedKey.expiresAt,
      isActive: updatedKey.isActive,
      createdAt: updatedKey.createdAt,
    };
  }

  private generateApiKey(): string {
    const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const prefix = environment === 'live' ? this.KEY_PREFIX : this.TEST_KEY_PREFIX;
    const randomPart = makeId(32);
    return `${prefix}${randomPart}`;
  }

  private isValidKeyFormat(key: string): boolean {
    return (
      key.startsWith(this.KEY_PREFIX) ||
      key.startsWith(this.TEST_KEY_PREFIX)
    );
  }

  async cleanupExpiredKeys(): Promise<number> {
    return this._userApiKeyRepository.deactivateExpiredKeys();
  }

  async findByNameAndUser(name: string, userId: string, organizationId: string): Promise<ApiKeyResponse | null> {
    const apiKey = await this._userApiKeyRepository.findByNameAndUser(name, userId, organizationId);

    if (!apiKey) {
      return null;
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }
}
