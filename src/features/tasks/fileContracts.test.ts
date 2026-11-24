import { describe, expect, it } from '@jest/globals';

import { ApiError } from '../../api';
import {
  isImageFile,
  isSupportedTaskFile,
  isTextFile,
  MAX_TASK_FILE_BYTES,
  safeLocalFileName,
  validateTaskFile,
} from './fileContracts';

describe('P15 task file contracts', () => {
  it('accepts verified MIME/extension pairs and identifies safe previews', () => {
    expect(() => validateTaskFile('brief.pdf', 'application/pdf', 1024)).not.toThrow();
    expect(isSupportedTaskFile('photo.png', 'image/png')).toBe(true);
    expect(isImageFile('photo.png', 'image/png')).toBe(true);
    expect(isTextFile('notes.txt', 'text/plain')).toBe(true);
  });

  it('rejects unsupported image formats, MIME mismatches, and oversized files', () => {
    expect(() => validateTaskFile('photo.heic', 'image/heic', 1024)).toThrow(ApiError);
    expect(() => validateTaskFile('brief.pdf', 'image/png', 1024)).toThrow(ApiError);
    expect(() => validateTaskFile('large.pdf', 'application/pdf', MAX_TASK_FILE_BYTES + 1)).toThrow(
      expect.objectContaining({ status: 413 }),
    );
    expect(isSupportedTaskFile('vector.svg', 'image/svg+xml')).toBe(false);
  });

  it('sanitizes downloaded names before writing them into app cache', () => {
    expect(safeLocalFileName('../private/report.pdf')).toBe('_private_report.pdf');
    expect(safeLocalFileName('..')).toBe('attachment');
  });
});
