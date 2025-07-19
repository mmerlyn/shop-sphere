import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

export interface PaginatedProducts {
  products: Product[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      const product = new this.productModel(createProductDto);
      return await product.save();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`Product ${field} already exists`);
      }
      throw error;
    }
  }

  async findAll(queryDto: ProductQueryDto): Promise<PaginatedProducts> {
    const {
      search,
      category,
      brand,
      vendor,
      status,
      isFeatured,
      isVisible,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      limit,
    } = queryDto;

    const filter: FilterQuery<ProductDocument> = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.$or = [
        { category },
        { additionalCategories: category }
      ];
    }

    if (brand) {
      filter.brand = brand;
    }

    if (vendor) {
      filter.vendor = vendor;
    }

    if (status) {
      filter.status = status;
    }

    if (typeof isFeatured === 'boolean') {
      filter.isFeatured = isFeatured;
    }

    if (typeof isVisible === 'boolean') {
      filter.isVisible = isVisible;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const sort: any = {};
    if (sortBy && sortOrder) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    if (search) {
      sort.score = { $meta: 'textScore' };
    }

    const skip = (page - 1) * limit;

    const [products, totalCount] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('category', 'name slug')
        .populate('additionalCategories', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      products,
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('category', 'name slug')
      .populate('additionalCategories', 'name slug')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.productModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productModel
      .findOne({ slug })
      .populate('category', 'name slug')
      .populate('additionalCategories', 'name slug')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    await this.productModel.findOneAndUpdate({ slug }, { $inc: { viewCount: 1 } });

    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productModel
      .findOne({ sku })
      .populate('category', 'name slug')
      .populate('additionalCategories', 'name slug')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    try {
      const product = await this.productModel
        .findByIdAndUpdate(id, updateProductDto, { new: true })
        .populate('category', 'name slug')
        .populate('additionalCategories', 'name slug')
        .exec();

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return product;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`Product ${field} already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.productModel
      .findByIdAndUpdate(
        id,
        { $inc: { stock: quantity } },
        { new: true }
      )
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return this.productModel
      .find({ isFeatured: true, isVisible: true, status: 'active' })
      .populate('category', 'name slug')
      .sort({ salesCount: -1, rating: -1 })
      .limit(limit)
      .exec();
  }

  async getRelatedProducts(productId: string, limit: number = 6): Promise<Product[]> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return this.productModel
      .find({
        _id: { $ne: productId },
        $or: [
          { category: product.category },
          { additionalCategories: product.category },
          { brand: product.brand },
          { tags: { $in: product.tags } }
        ],
        isVisible: true,
        status: 'active'
      })
      .populate('category', 'name slug')
      .sort({ rating: -1, salesCount: -1 })
      .limit(limit)
      .exec();
  }

  async getBrands(): Promise<string[]> {
    return this.productModel.distinct('brand').exec();
  }

  async getVendors(): Promise<string[]> {
    return this.productModel.distinct('vendor').exec();
  }

  async updateRating(productId: string, newRating: number, reviewCount: number): Promise<Product> {
    const product = await this.productModel
      .findByIdAndUpdate(
        productId,
        { 
          rating: newRating,
          reviewCount: reviewCount
        },
        { new: true }
      )
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return product;
  }
}