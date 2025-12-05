import { ApiResponse } from '../types/common.types';

export class ResponseUtil {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  static error(error: string, message?: string): ApiResponse<null> {
    return {
      success: false,
      error,
      message,
    };
  }
}
