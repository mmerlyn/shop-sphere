import { IsString, IsEmail, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  emailOrUsername: string;

  @IsString()
  password: string;
}
