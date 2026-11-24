import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiClient, ApiError } from '../../api';
import { sessionService } from '../../auth/session';
import { profileService } from './service';

jest.mock('../../api', () => ({
  ...jest.requireActual<typeof import('../../api')>('../../api'),
  apiClient: { request: jest.fn(), post: jest.fn() },
}));
jest.mock('../../auth/session', () => ({
  sessionService: { getAccessToken: jest.fn() },
}));

describe('P16 profile service contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(sessionService.getAccessToken).mockResolvedValue('profile-token');
  });

  it('updates only the current authenticated profile through the verified route', async () => {
    jest.mocked(apiClient.request).mockResolvedValue({
      status: 'success',
      data: { user: { id: 'user-1' } },
    });

    await profileService.updateProfile({
      firstName: 'Ada',
      lastName: 'Lovelace',
      bio: 'Mathematician',
    });

    expect(apiClient.request).toHaveBeenCalledWith('/profile/update', {
      method: 'PATCH',
      body: { firstName: 'Ada', lastName: 'Lovelace', bio: 'Mathematician' },
      token: 'profile-token',
    });
  });

  it('uploads the multipart field expected by the authenticated endpoint', async () => {
    const file = new Blob(['jpeg-data'], { type: 'image/jpeg' }) as File;
    Object.defineProperty(file, 'name', { value: 'profile-photo.jpg' });
    jest.mocked(apiClient.post).mockResolvedValue({
      status: 'success',
      data: { profilePictureUrl: 'https://images.admiino.test/profile.jpg' },
    });

    await expect(profileService.uploadProfilePicture(file)).resolves.toBe(
      'https://images.admiino.test/profile.jpg',
    );
    const [path, body, options] = jest.mocked(apiClient.post).mock.calls[0] ?? [];
    expect(path).toBe('/profile/upload-picture');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('profilePicture')).toBeTruthy();
    expect(options).toEqual({ token: 'profile-token' });
  });

  it('does not report a photo upload as successful without a confirmed URL', async () => {
    const file = new Blob(['jpeg-data'], { type: 'image/jpeg' }) as File;
    Object.defineProperty(file, 'name', { value: 'profile-photo.jpg' });
    jest.mocked(apiClient.post).mockResolvedValue({ status: 'success', data: {} });

    await expect(profileService.uploadProfilePicture(file)).rejects.toBeInstanceOf(ApiError);
  });

  it('requests the existing generic password-reset flow without sending a password', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({ status: 'success' });

    await profileService.requestPasswordReset('ada@example.test');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'ada@example.test',
    });
  });

  it('does not treat a non-success password-reset response as confirmation', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({ status: 'error' });

    await expect(profileService.requestPasswordReset('ada@example.test')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
