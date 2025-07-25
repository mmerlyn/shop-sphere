import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly userServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl = this.configService.get<string>('USER_SERVICE_URL', 'http://user-service:3001');
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      this.logger.debug(`Fetching user with ID: ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/api/v1/users/${userId}`, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId}:`, error.message);
      return null;
    }
  }

  async validateUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.isActive || false;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      this.logger.debug(`Fetching user with email: ${email}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/api/v1/users/email/${email}`, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch user by email ${email}:`, error.message);
      return null;
    }
  }
}