import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Provider } from '@prisma/client';

export class ApiKeyLoginDto {
  @IsEmail()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @IsDefined()
  password: string;

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsDefined()
  keyName: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class ApiKeyRegisterDto {
  @IsEmail()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @IsDefined()
  password: string; // Used as registration token for API key registration

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @IsDefined()
  company: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsDefined()
  keyName: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsDefined()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApiKeyResponseDto {
  id: string;
  name: string;
  key?: string; // Only returned when creating/regenerating
  lastUsedAt?: Date;
  lastUsedIp?: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export class ApiKeyAuthResponseDto {
  success: boolean;
  apiKey?: ApiKeyResponseDto;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}
