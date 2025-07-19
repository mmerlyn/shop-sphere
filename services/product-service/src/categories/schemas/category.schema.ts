import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ 
  timestamps: true,
  collection: 'shopsphere_categories'
})
export class Category {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop()
  image?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  parentCategory?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Category' }])
  subCategories: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop()
  metaTitle?: string;

  @Prop()
  metaDescription?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Indexes for better performance
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentCategory: 1 });
CategorySchema.index({ isActive: 1 });