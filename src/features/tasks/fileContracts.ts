import type { File } from 'expo-file-system';

import { ApiError } from '../../api';

export const MAX_TASK_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_COMMENT_FILES = 10;

export interface LocalTaskFile {
  file: File;
  name: string;
  mimeType: string;
  size: number;
}

const MIME_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  '.csv': ['text/csv', 'text/plain'],
  '.doc': ['application/msword', 'application/x-cfb'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.gif': ['image/gif'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/x-cfb'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.xls': ['application/vnd.ms-excel', 'application/x-cfb'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.webp': ['image/webp'],
};

function extensionOf(name: string): string {
  const separator = name.lastIndexOf('.');
  return separator < 0 ? '' : name.slice(separator).toLowerCase();
}

export function validateTaskFile(name: string, mimeType: string, size: number): void {
  const extension = extensionOf(name);
  const acceptedTypes = MIME_TYPES_BY_EXTENSION[extension];
  if (!name.trim() || !acceptedTypes) {
    throw new ApiError(
      'Choose a PDF, Office document, plain-text/CSV file, or JPEG, PNG, WebP, or GIF image.',
      400,
    );
  }
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new ApiError('The selected file size could not be verified.', 400);
  }
  if (size > MAX_TASK_FILE_BYTES) {
    throw new ApiError('Files must be 20 MB or smaller.', 413);
  }

  const mime = mimeType.trim().toLowerCase().split(';', 1)[0];
  if (mime && mime !== 'application/octet-stream' && !acceptedTypes.includes(mime)) {
    throw new ApiError('The selected file type does not match its file name.', 400);
  }
}

export function isSupportedTaskFile(name: string, mimeType: string): boolean {
  const acceptedTypes = MIME_TYPES_BY_EXTENSION[extensionOf(name)];
  if (!acceptedTypes) return false;
  const mime = mimeType.trim().toLowerCase().split(';', 1)[0];
  return !mime || mime === 'application/octet-stream' || acceptedTypes.includes(mime);
}

export function isImageFile(name: string, mimeType: string): boolean {
  return isSupportedTaskFile(name, mimeType) && /^image\//i.test(mimeType);
}

export function isTextFile(name: string, mimeType: string): boolean {
  return (
    isSupportedTaskFile(name, mimeType) && (mimeType === 'text/plain' || mimeType === 'text/csv')
  );
}

export function safeLocalFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 200);
  return cleaned || 'attachment';
}
