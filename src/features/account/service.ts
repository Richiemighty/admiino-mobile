import { apiClient, ApiError } from '../../api';
import type { MobileUser } from '../../api/types';
import { sessionService } from '../../auth/session';

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  bio: string;
}

interface UpdateProfileResponse {
  status: 'success';
  data: { user: MobileUser };
}

interface UploadProfilePictureResponse {
  status: 'success';
  data: { profilePictureUrl: string };
}

interface PasswordResetResponse {
  status: 'success';
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const profileService = {
  async updateProfile(input: UpdateProfileInput): Promise<void> {
    const token = await sessionService.getAccessToken();
    const response = await apiClient.request<UpdateProfileResponse>('/profile/update', {
      method: 'PATCH',
      body: input,
      token,
    });
    if (
      response.status !== 'success' ||
      !isRecord(response.data) ||
      !isRecord(response.data.user) ||
      typeof response.data.user.id !== 'string'
    ) {
      throw new ApiError('The profile could not be updated because the response was invalid.', 502);
    }
  },

  async uploadProfilePicture(file: Blob & { name?: string }): Promise<string> {
    const formData = new FormData();
    formData.append('profilePicture', file, file.name || 'profile-picture.jpg');
    const token = await sessionService.getAccessToken();
    const response = await apiClient.post<UploadProfilePictureResponse>(
      '/profile/upload-picture',
      formData,
      { token },
    );
    if (
      response.status !== 'success' ||
      !isRecord(response.data) ||
      typeof response.data.profilePictureUrl !== 'string' ||
      !response.data.profilePictureUrl
    ) {
      throw new ApiError('The server did not confirm the profile photo upload.', 502);
    }
    return response.data.profilePictureUrl;
  },

  async requestPasswordReset(email: string): Promise<void> {
    const response = await apiClient.post<PasswordResetResponse>('/auth/forgot-password', {
      email,
    });
    if (!isRecord(response) || response.status !== 'success') {
      throw new ApiError('The password reset request could not be confirmed.', 502);
    }
  },
};
