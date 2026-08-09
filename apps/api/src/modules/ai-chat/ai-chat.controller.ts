import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiChatService } from './ai-chat.service';

class CreateConversationDto {
  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@ApiTags('ai-chat')
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly chat: AiChatService) {}

  @Post('conversations')
  @RequirePermissions('ai-chat.read')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateConversationDto) {
    return this.chat.createConversation(user, body);
  }

  @Get('conversations')
  @RequirePermissions('ai-chat.read')
  list(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user);
  }

  @Get('conversations/:id')
  @RequirePermissions('ai-chat.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getConversation(user, id);
  }

  @Delete('conversations/:id')
  @RequirePermissions('ai-chat.read')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.archiveConversation(user, id);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('ai-chat.read')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    return this.chat.sendMessage(user, id, body);
  }
}
