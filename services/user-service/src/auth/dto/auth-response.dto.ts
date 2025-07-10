export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    role: string;
    isVerified: boolean;
    createdAt: Date;
  };
  
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

