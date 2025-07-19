import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  IsBoolean, 
  IsEnum, 
  IsMongoId,
  ValidateNested,
  Min
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductVariantDto {
  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}

export class ProductDimensionsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ProductSEODto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @Transform(({ value, obj }) => {
    return obj.slug || obj.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  })
  slug: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comparePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number = 0;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean = false;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean = true;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[] = [];

  @IsMongoId()
  category: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  additionalCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'archived'])
  status?: string = 'draft';

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean = true;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isDigital?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresShipping?: boolean = true;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSEODto)
  seo?: ProductSEODto;

  @IsOptional()
  customAttributes?: Record<string, any>;
}