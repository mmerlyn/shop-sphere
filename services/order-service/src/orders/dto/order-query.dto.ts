import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsOptional, 
  IsString, 
  IsNumber, 
  IsEmail, 
  Min, 
  Max 
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '../enums';

export class OrderQueryDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Order status filter', enum: OrderStatus })
  @IsOptional()
  @IsString()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Payment status filter', enum: PaymentStatus })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'User ID filter' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Customer email filter' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ description: 'Order number search' })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({ description: 'Date from (ISO string)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to (ISO string)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

