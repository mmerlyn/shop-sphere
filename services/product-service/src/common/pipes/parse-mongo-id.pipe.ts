import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`Invalid MongoDB ID: ${value}`);
    }
    return value;
  }
}