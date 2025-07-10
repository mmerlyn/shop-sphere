import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.transformUser(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? this.transformUser(user) : null;
  }

  async findByUsername(username: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    return user ? this.transformUser(user) : null;
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    return this.transformUser(updatedUser);
  }

  async deactivateAccount(id: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    return { message: 'Account deactivated successfully' };
  }

  async getAllUsers(page = 1, limit = 10): Promise<{ users: UserResponseDto[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      users: users.map(user => this.transformUser(user)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private transformUser(user: User): UserResponseDto {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserResponseDto;
  }
}
