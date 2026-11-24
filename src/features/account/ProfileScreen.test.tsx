import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { ApiNetworkError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ProfileScreen } from './ProfileScreen';
import { profileService } from './service';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'profile-photo-id' }));
jest.mock('./service', () => ({
  profileService: {
    updateProfile: jest.fn(),
    uploadProfilePicture: jest.fn(),
    requestPasswordReset: jest.fn(),
  },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        saveAsync: jest.fn(async () => ({ uri: 'file:///converted-profile.jpg' })),
        release: jest.fn(),
      })),
      release: jest.fn(),
    })),
  },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => {
  class MockFile {
    static sizeForTest = 1200;
    uri: string;
    name: string;
    size = MockFile.sizeForTest;
    type = 'image/jpeg';
    exists = true;
    copy = jest.fn(async () => undefined);
    delete = jest.fn();

    constructor(directoryOrUri: unknown, name?: string) {
      this.name = name ?? String(directoryOrUri).split('/').pop() ?? 'photo.jpg';
      this.uri = name ? `file:///cache/${name}` : String(directoryOrUri);
    }
  }
  return {
    File: MockFile,
    Paths: { cache: 'file:///cache' },
    setMockFileSize: (size: number) => {
      MockFile.sizeForTest = size;
    },
  };
});

const user = {
  id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  role: 'executive',
  profilePictureUrl: 'https://images.admiino.test/ada.jpg',
  bio: 'Mathematician',
};
const workspace = {
  companyId: 'workspace-1',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Alpha Workspace', companyCode: 'ALPHA' },
};
const refreshUser = jest.fn(async () => user);
const applyUserProfileUpdate = jest.fn();
const logout = jest.fn(async () => undefined);

function authState() {
  return {
    status: 'authenticated',
    user,
    activeWorkspace: workspace,
    permissions: { role: 'owner' },
    refreshUser,
    applyUserProfileUpdate,
    logout,
  } as never;
}

describe('P16 profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(authState());
    jest.mocked(profileService.updateProfile).mockResolvedValue();
    jest
      .mocked(profileService.uploadProfilePicture)
      .mockResolvedValue('https://images.admiino.test/ada-updated.jpg');
    jest.mocked(refreshUser).mockResolvedValue(user);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///original.HEIC',
          width: 3000,
          height: 2000,
          fileName: 'original.HEIC',
          mimeType: 'image/heic',
          type: 'image',
          assetId: null,
          fileSize: 6000000,
          exif: null,
          base64: null,
          duration: null,
          pairedVideoAsset: null,
        },
      ],
    });
    (
      jest.requireMock('expo-file-system') as { setMockFileSize: (size: number) => void }
    ).setMockFileSize(1200);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Choose Photo')?.onPress?.();
    });
  });

  it('loads the signed-in user and shows effective workspace role with immutable email', async () => {
    await renderWithProviders(<ProfileScreen />);

    expect(await screen.findByText('ada@example.test')).toBeTruthy();
    expect(screen.getByText('Alpha Workspace')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByLabelText('Ada Lovelace avatar')).toBeTruthy();
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(refreshUser).toHaveBeenCalled();
  });

  it('saves validated supported profile fields and refreshes the shared user state', async () => {
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.changeText(screen.getByLabelText('First name'), '  Augusta  ');
    await fireEvent.changeText(screen.getByLabelText('Bio'), '  Programmer  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));

    await waitFor(() => expect(profileService.updateProfile).toHaveBeenCalledTimes(1));
    expect(profileService.updateProfile).toHaveBeenCalledWith({
      firstName: 'Augusta',
      lastName: 'Lovelace',
      bio: 'Programmer',
    });
    expect(applyUserProfileUpdate).toHaveBeenCalledWith('user-1', {
      firstName: 'Augusta',
      lastName: 'Lovelace',
      bio: 'Programmer',
    });
    expect(refreshUser).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Profile updated.')).toBeTruthy();
  });

  it('prevents invalid required names from being submitted', async () => {
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.changeText(screen.getByLabelText('First name'), ' ');

    expect(screen.getByText('First name is required.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save profile changes' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });

  it('converts an HEIC photo to JPEG, enforces the backend size limit, and updates the avatar', async () => {
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Change profile photo' }));
    expect(await screen.findByLabelText('Selected profile photo preview')).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'] }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Upload profile photo' }));
    await waitFor(() => expect(profileService.uploadProfilePicture).toHaveBeenCalledTimes(1));
    expect(profileService.uploadProfilePicture).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringMatching(/\.jpg$/) }),
    );
    expect(applyUserProfileUpdate).toHaveBeenCalledWith('user-1', {
      profilePictureUrl: 'https://images.admiino.test/ada-updated.jpg',
    });
    expect(await screen.findByText('Profile photo updated.')).toBeTruthy();
  });

  it('keeps the selected photo available and reports an upload failure', async () => {
    jest.mocked(profileService.uploadProfilePicture).mockRejectedValueOnce(new ApiNetworkError());
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Change profile photo' }));
    await screen.findByLabelText('Selected profile photo preview');
    await fireEvent.press(screen.getByRole('button', { name: 'Upload profile photo' }));

    expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
    expect(screen.getByLabelText('Selected profile photo preview')).toBeTruthy();
    expect(screen.queryByText('Profile photo updated.')).toBeNull();
  });

  it('rejects a converted photo that still exceeds five megabytes', async () => {
    (
      jest.requireMock('expo-file-system') as { setMockFileSize: (size: number) => void }
    ).setMockFileSize(5 * 1024 * 1024 + 1);
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Change profile photo' }));

    expect(
      await screen.findByText(
        'The prepared image exceeds the 5 MB upload limit. Choose a smaller photo.',
      ),
    ).toBeTruthy();
    expect(profileService.uploadProfilePicture).not.toHaveBeenCalled();
  });

  it('surfaces a failed profile save without showing success', async () => {
    jest.mocked(profileService.updateProfile).mockRejectedValueOnce(new ApiNetworkError());
    await renderWithProviders(<ProfileScreen />);
    await screen.findByText('ada@example.test');
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Augusta');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));

    expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
    expect(screen.queryByText('Profile updated.')).toBeNull();
  });
});
