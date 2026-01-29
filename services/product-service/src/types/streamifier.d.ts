declare module 'streamifier' {
  import { Readable } from 'stream';
  export function createReadStream(object: Buffer | string): Readable;
}
