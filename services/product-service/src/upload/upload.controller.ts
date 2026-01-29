import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Param,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadImage(file);
    return {
      success: true,
      data: result,
    };
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleImages(
    @UploadedFiles()
    files: Express.Multer.File[],
  ) {
    const results = await this.uploadService.uploadMultipleImages(files);
    return {
      success: true,
      data: results,
    };
  }

  @Delete(':publicId')
  async deleteImage(@Param('publicId') publicId: string) {
    // Decode the publicId (it may contain slashes encoded as %2F)
    const decodedPublicId = decodeURIComponent(publicId);
    await this.uploadService.deleteImage(decodedPublicId);
    return {
      success: true,
      message: 'Image deleted successfully',
    };
  }
}
