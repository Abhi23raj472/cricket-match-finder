import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminBroadcasterDto, AdminRightDto, RightsGapDto } from '@cmf/shared';
import { AdminKeyGuard } from './admin-key.guard';
import { AdminService } from './admin.service';
import { CreateBroadcasterDto, UpdateBroadcasterDto } from './dto/broadcaster.dto';
import { CreateRightDto, ListRightsQuery, RightsGapsQuery, UpdateRightDto } from './dto/right.dto';

const uuid = new ParseUUIDPipe();

@Controller('admin')
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('broadcasters')
  listBroadcasters(): Promise<AdminBroadcasterDto[]> {
    return this.admin.listBroadcasters();
  }

  @Post('broadcasters')
  createBroadcaster(@Body() dto: CreateBroadcasterDto): Promise<AdminBroadcasterDto> {
    return this.admin.createBroadcaster(dto);
  }

  @Patch('broadcasters/:id')
  updateBroadcaster(@Param('id', uuid) id: string, @Body() dto: UpdateBroadcasterDto): Promise<AdminBroadcasterDto> {
    return this.admin.updateBroadcaster(id, dto);
  }

  @Delete('broadcasters/:id')
  @HttpCode(204)
  deleteBroadcaster(@Param('id', uuid) id: string): Promise<void> {
    return this.admin.deleteBroadcaster(id);
  }

  @Get('rights')
  listRights(@Query() q: ListRightsQuery): Promise<AdminRightDto[]> {
    return this.admin.listRights(q);
  }

  /** Declared before rights/:id so "gaps" isn't treated as an id. */
  @Get('rights/gaps')
  gaps(@Query() q: RightsGapsQuery): Promise<RightsGapDto[]> {
    return this.admin.rightsGaps(q.days, q.region);
  }

  @Post('rights')
  createRight(@Body() dto: CreateRightDto): Promise<AdminRightDto> {
    return this.admin.createRight(dto);
  }

  @Patch('rights/:id')
  updateRight(@Param('id', uuid) id: string, @Body() dto: UpdateRightDto): Promise<AdminRightDto> {
    return this.admin.updateRight(id, dto);
  }

  @Delete('rights/:id')
  @HttpCode(204)
  deleteRight(@Param('id', uuid) id: string): Promise<void> {
    return this.admin.deleteRight(id);
  }
}
