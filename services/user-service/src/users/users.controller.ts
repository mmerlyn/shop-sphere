import { 
  Controller, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { UserRole, User } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User): Promise<UserResponseDto> {
    return this.usersService.findById(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.id, updateUserDto);
  }

  @Delete('profile')
  async deactivateAccount(@CurrentUser() user: User): Promise<{ message: string }> {
    return this.usersService.deactivateAccount(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getAllUsers(page, limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(id, updateUserDto);
  }
}

