import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('User API')
@Controller('/api/v1')
export class UserApiPostsController {
  private storage = UploadFactory.createStorage();

  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _mediaService: MediaService
  ) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSimple(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile('file') file: Express.Multer.File
  ) {
    if (!file) {
      throw new HttpException({ msg: 'No file provided' }, 400);
    }

    const getFile = await this.storage.uploadFile(file);
    return this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path
    );
  }

  @Get('/posts')
  async getPosts(
    @GetOrgFromRequest() org: Organization,
    @Query() query: GetPostsDto
  ) {
    const posts = await this._postsService.getPosts(org.id, query);
    return {
      posts,
    };
  }

  @Post('/posts')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async createPost(
    @GetOrgFromRequest() org: Organization,
    @Body() rawBody: any
  ) {
    const body = await this._postsService.mapTypeToPost(
      rawBody,
      org.id,
      rawBody.type === 'draft'
    );
    body.type = rawBody.type;

    console.log(JSON.stringify(body, null, 2));
    return this._postsService.createPost(org.id, body);
  }

  @Delete('/posts/:id')
  async deletePost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._postsService.deletePost(org.id, id);
  }

  @Get('/is-connected')
  async isConnected(@GetOrgFromRequest() org: Organization) {
    // This method might not exist, let's implement a simple check
    const integrations = await this._integrationService.getIntegrationsList(org.id);
    return { connected: integrations.length > 0 };
  }

  @Get('/integrations')
  async getIntegrations(@GetOrgFromRequest() org: Organization) {
    return this._integrationService.getIntegrationsList(org.id);
  }

  @Post('/generate-video')
  async generateVideo(
    @GetOrgFromRequest() org: Organization,
    @Body() body: any
  ) {
    // This would need to be implemented based on the original controller
    throw new HttpException('Not implemented', 501);
  }

  @Post('/video/function')
  async videoFunction(
    @GetOrgFromRequest() org: Organization,
    @Body() body: any
  ) {
    // This would need to be implemented based on the original controller
    throw new HttpException('Not implemented', 501);
  }
}
