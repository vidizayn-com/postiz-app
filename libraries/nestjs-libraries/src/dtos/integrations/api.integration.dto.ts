import { IsDefined, IsOptional, IsString, IsUrl, IsObject } from 'class-validator';

export class ApiKeyIntegrationDto {
  @IsString()
  @IsDefined()
  provider: string;

  @IsString()
  @IsDefined()
  apiKey: string;

  @IsString()
  @IsOptional()
  apiSecret?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  additionalSettings?: Record<string, any>;

  @IsUrl()
  @IsOptional()
  callbackUrl?: string;
}

export class IntegrationStatusDto {
  @IsString()
  @IsDefined()
  integrationId: string;
}

export class UpdateIntegrationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}
