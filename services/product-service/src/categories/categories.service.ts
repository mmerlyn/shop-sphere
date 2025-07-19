import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const category = new this.categoryModel(createCategoryDto);
      return await category.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Category name or slug already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Category[]> {
    return this.categoryModel
      .find()
      .populate('parentCategory', 'name slug')
      .populate('subCategories', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findActive(): Promise<Category[]> {
    return this.categoryModel
      .find({ isActive: true })
      .populate('parentCategory', 'name slug')
      .populate('subCategories', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryModel
      .findById(id)
      .populate('parentCategory', 'name slug')
      .populate('subCategories', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryModel
      .findOne({ slug })
      .populate('parentCategory', 'name slug')
      .populate('subCategories', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    try {
      const category = await this.categoryModel
        .findByIdAndUpdate(id, updateCategoryDto, { new: true })
        .populate('parentCategory', 'name slug')
        .populate('subCategories', 'name slug')
        .exec();

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Category name or slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  async getHierarchy(): Promise<Category[]> {
    const categories = await this.categoryModel
      .find({ parentCategory: { $exists: false } })
      .populate({
        path: 'subCategories',
        populate: {
          path: 'subCategories',
          model: 'Category'
        }
      })
      .sort({ sortOrder: 1, name: 1 })
      .exec();

    return categories;
  }
}