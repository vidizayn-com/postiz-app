import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { UserApiKey } from '@prisma/client';

export interface CreateUserApiKeyData {
  userId: string;
  organizationId: string;
  keyHash: string;
  name: string;
  expiresAt?: Date;
}

export interface UpdateUserApiKeyData {
  name?: string;
  keyHash?: string;
  lastUsedIp?: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive?: boolean;
}

@Injectable()
export class UserApiKeyRepository {
  constructor(private _userApiKey: PrismaRepository<'userApiKey'>) {}

  async createApiKey(data: CreateUserApiKeyData): Promise<UserApiKey> {
    return this._userApiKey.model.userApiKey.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        keyHash: data.keyHash,
        name: data.name,
        expiresAt: data.expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByKeyHash(keyHash: string): Promise<UserApiKey | null> {
    return this._userApiKey.model.userApiKey.findUnique({
      where: {
        keyHash,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            activated: true,
            isSuperAdmin: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                subscriptionTier: true,
                totalChannels: true,
                isLifetime: true,
              },
            },
          },
        },
      },
    });
  }

  async findUserApiKeys(userId: string, organizationId: string): Promise<UserApiKey[]> {
    return this._userApiKey.model.userApiKey.findMany({
      where: {
        userId,
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        lastUsedIp: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateApiKey(id: string, userId: string, data: UpdateUserApiKeyData): Promise<UserApiKey> {
    return this._userApiKey.model.userApiKey.update({
      where: {
        id,
        userId,
      },
      data,
    });
  }

  async deleteApiKey(id: string, userId: string): Promise<UserApiKey> {
    return this._userApiKey.model.userApiKey.delete({
      where: {
        id,
        userId,
      },
    });
  }

  async updateLastUsed(keyHash: string, ip: string): Promise<void> {
    await this._userApiKey.model.userApiKey.update({
      where: {
        keyHash,
      },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ip,
      },
    });
  }

  async findExpiredKeys(): Promise<UserApiKey[]> {
    return this._userApiKey.model.userApiKey.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
    });
  }

  async deactivateExpiredKeys(): Promise<number> {
    const result = await this._userApiKey.model.userApiKey.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    return result.count;
  }

  async countUserApiKeys(userId: string, organizationId: string): Promise<number> {
    return this._userApiKey.model.userApiKey.count({
      where: {
        userId,
        organizationId,
        isActive: true,
      },
    });
  }

  async findByNameAndUser(name: string, userId: string, organizationId: string): Promise<UserApiKey | null> {
    return this._userApiKey.model.userApiKey.findFirst({
      where: {
        name,
        userId,
        organizationId,
      },
    });
  }
}
