import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductVariant {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  value: string;

  @Prop()
  price?: number;

  @Prop()
  sku?: string;

  @Prop({ default: 0 })
  stock?: number;
}

@Schema({ _id: false })
export class ProductDimensions {
  @Prop()
  length?: number;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  weight?: number;

  @Prop()
  unit?: string;
}

@Schema({ _id: false })
export class ProductSEO {
  @Prop()
  title?: string;

  @Prop()
  description?: string;

  @Prop([String])
  keywords?: string[];
}

@Schema({ 
  timestamps: true,
  collection: 'shopsphere_products'
})
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  shortDescription?: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  comparePrice?: number;

  @Prop()
  costPrice?: number;

  @Prop({ required: true, unique: true })
  sku: string;

  @Prop()
  barcode?: string;

  @Prop({ default: 0 })
  stock: number;

  @Prop({ default: false })
  trackStock: boolean;

  @Prop({ default: true })
  allowBackorder: boolean;

  @Prop([String])
  images: string[];

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Category' }])
  additionalCategories: Types.ObjectId[];

  @Prop([String])
  tags: string[];

  @Prop({ type: [ProductVariant] })
  variants: ProductVariant[];

  @Prop({ type: ProductDimensions })
  dimensions?: ProductDimensions;

  @Prop()
  brand?: string;

  @Prop()
  vendor?: string;

  @Prop({ enum: ['draft', 'active', 'archived'], default: 'draft' })
  status: string;

  @Prop({ default: true })
  isVisible: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isDigital: boolean;

  @Prop({ default: false })
  requiresShipping: boolean;

  @Prop({ type: ProductSEO })
  seo?: ProductSEO;

  @Prop({ type: Object })
  customAttributes?: Record<string, any>;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  salesCount: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  reviewCount: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ isVisible: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ createdAt: -1 });