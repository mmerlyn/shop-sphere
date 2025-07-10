import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, password, firstName, lastName, phone } = registerDto;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already taken');
      }
    }

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
      },
    });

    const tokens = await this.generateTokens(user);

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return this.buildAuthResponse(user, tokens);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { emailOrUsername, password } = loginDto;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user);

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.buildAuthResponse(user, tokens);
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({
          where: { token: refreshToken },
        });
        throw new UnauthorizedException('Refresh token expired');
      }

      const tokens = await this.generateTokens(storedToken.user);

      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      await this.saveRefreshToken(storedToken.user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out from all devices successfully' };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = new Date();

    if (expiresIn.endsWith('d')) {
      const days = parseInt(expiresIn.slice(0, -1));
      expiresAt.setDate(expiresAt.getDate() + days);
    } else if (expiresIn.endsWith('h')) {
      const hours = parseInt(expiresIn.slice(0, -1));
      expiresAt.setHours(expiresAt.getHours() + hours);
    }

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  private buildAuthResponse(user: User, tokens: { accessToken: string; refreshToken: string }): AuthResponseDto {
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }
}