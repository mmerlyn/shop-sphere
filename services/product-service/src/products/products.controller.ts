import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Put,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('featured')
  getFeaturedProducts(@Query('limit') limit?: number) {
    return this.productsService.getFeaturedProducts(limit);
  }

  @Get('brands')
  getBrands() {
    return this.productsService.getBrands();
  }

  @Get('vendors')
  getVendors() {
    return this.productsService.getVendors();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/related')
  getRelatedProducts(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.productsService.getRelatedProducts(id, limit);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Put(':id/stock')
  updateStock(
    @Param('id') id: string, 
    @Body() body: { quantity: number }
  ) {
    return this.productsService.updateStock(id, body.quantity);
  }

  @Put(':id/rating')
  updateRating(
    @Param('id') id: string,
    @Body() body: { rating: number; reviewCount: number }
  ) {
    return this.productsService.updateRating(id, body.rating, body.reviewCount);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}