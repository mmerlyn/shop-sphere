export class UserResponseDto {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}
