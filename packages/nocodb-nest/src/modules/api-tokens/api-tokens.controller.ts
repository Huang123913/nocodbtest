import {
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
  Param,
} from '@nestjs/common';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ApiTokensService } from './api-tokens.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Get('/api/v1/db/meta/projects/:projectId/api-tokens')
  @Acl('apiTokenList')
  async apiTokenList(@Request() req) {
    return new PagedResponseImpl(
      await this.apiTokensService.apiTokenList({ userId: req['user'].id }),
    );
  }

  @Post('/api/v1/db/meta/projects/:projectId/api-tokens')
  @Acl('apiTokenCreate')
  async apiTokenCreate(@Request() req, @Body() body) {
    return await this.apiTokensService.apiTokenCreate({
      tokenBody: body,
      userId: req['user'].id,
    });
  }

  @Delete('/api/v1/db/meta/projects/:projectId/api-tokens/:token')
  @Acl('apiTokenDelete')
  async apiTokenDelete(@Request() req, @Param('token') token: string) {
    return await this.apiTokensService.apiTokenDelete({
      token,
      user: req['user'],
    });
  }
}
