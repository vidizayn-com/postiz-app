import { MiddlewareConsumer, Module, NestModule, Controller } from '@nestjs/common';
import { UploadModule } from '@gitroom/nestjs-libraries/upload/upload.module';

// Controllers
import { ApiKeyManagementController } from '@gitroom/backend/api/routes/api-key-management.controller';
import { UserApiPostsController } from './user-api-posts.controller';

// Services and Middleware
import { UserApiKeyMiddleware } from '@gitroom/backend/services/auth/user-api-key.middleware';
import { UserApiKeyService } from '@gitroom/nestjs-libraries/database/prisma/user-api-keys/user-api-key.service';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@gitroom/nestjs-libraries/services/codes.service';

// Controllers that will be protected by user API key middleware
const userApiKeyProtectedControllers = [
  ApiKeyManagementController,
  UserApiPostsController,
];

@Module({
  imports: [UploadModule],
  controllers: [...userApiKeyProtectedControllers],
  providers: [
    UserApiKeyService,
    UserApiKeyMiddleware,
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
  ],
  exports: [
    UserApiKeyService,
    UserApiKeyMiddleware,
    ...userApiKeyProtectedControllers,
  ],
})
export class UserApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserApiKeyMiddleware)
      .forRoutes(...userApiKeyProtectedControllers);
  }
}
