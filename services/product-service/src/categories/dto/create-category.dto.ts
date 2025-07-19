import { IsString, IsOptional, IsBoolean, IsNumber, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @Transform(({ value, obj }) => {
    return obj.slug || obj.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  })
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsMongoId()
  parentCategory?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsNumber()
  sortOrder?: number = 0;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;
}