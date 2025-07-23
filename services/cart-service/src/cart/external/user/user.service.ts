import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../../../config/config.service';
import { firstValueFrom } from 'rxjs';

export interface UserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  preferences?: Record<string, any>;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.userServiceUrl;
  }

  async getUser(userId: string, token: string): Promise<UserInfo | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/v1/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
      
      return this.transformUserResponse(response.data.data);
    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId}:`, error.message);
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('User service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async validateToken(token: string): Promise<UserInfo | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/v1/auth/validate`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
      
      return this.transformUserResponse(response.data.data.user);
    } catch (error) {
      this.logger.error(`Failed to validate token:`, error.message);
      return null;
    }
  }

  private transformUserResponse(userData: any): UserInfo {
    return {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      preferences: userData.preferences || {},
    };
  }
}