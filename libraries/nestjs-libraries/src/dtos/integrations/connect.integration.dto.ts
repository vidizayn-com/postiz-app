import { IsDefined, IsOptional, IsString, IsUrl } from 'class-validator';

export class ConnectIntegrationDto {
  @IsString()
  @IsDefined()
  state: string;

  @IsString()
  @IsDefined()
  code: string;

  @IsString()
  @IsDefined()
  timezone: string;

  @IsString()
  @IsOptional()
  refresh?: string;
}

export class ApiConnectIntegrationDto {
  @IsString()
  @IsDefined()
  state: string;

  @IsString()
  @IsDefined()
  code: string;

  @IsString()
  @IsDefined()
  timezone: string;

  @IsString()
  @IsOptional()
  refresh?: string;

  @IsUrl()
  @IsOptional()
  callbackUrl?: string;
}

export class ApiInitiateIntegrationDto {
  @IsString()
  @IsDefined()
  provider: string;

  @IsUrl()
  @IsOptional()
  callbackUrl?: string;

  @IsString()
  @IsOptional()
  externalUrl?: string;
}
