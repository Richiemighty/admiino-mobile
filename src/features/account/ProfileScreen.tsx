import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ArrowLeft, ImagePlus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { profileService } from './service';

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MAX_DIMENSION = 1600;

interface PreparedPhoto {
  uri: string;
  file: File;
  size: number;
}

function requestError(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'The request timed out. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have permission to update this profile.';
  if (error instanceof ApiError && error.status === 413)
    return 'The photo exceeds the 5 MB upload limit.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  if (error instanceof ApiError && error.status >= 400) return error.message;
  return 'The profile could not be updated. Please try again.';
}

function safeDeletePhoto(photo: PreparedPhoto | null): void {
  if (!photo) return;
  try {
    if (photo.file.exists) photo.file.delete();
  } catch {
    console.warn('Unable to remove the temporary profile image.');
  }
}

function roleLabel(role: string | undefined): string {
  return role
    ? role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not available';
}

function validateProfile(firstName: string, lastName: string, bio: string) {
  return {
    firstName: !firstName.trim()
      ? 'First name is required.'
      : firstName.trim().length > 50
        ? 'First name must be 50 characters or fewer.'
        : null,
    lastName: !lastName.trim()
      ? 'Last name is required.'
      : lastName.trim().length > 50
        ? 'Last name must be 50 characters or fewer.'
        : null,
    bio: bio.length > 1000 ? 'Bio must be 1000 characters or fewer.' : null,
  };
}

export function ProfileScreen() {
  const { activeWorkspace, applyUserProfileUpdate, logout, permissions, refreshUser, user } =
    useAuth();
  const { colors } = useAppTheme();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PreparedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const saveInProgress = useRef(false);
  const uploadInProgress = useRef(false);
  const photoRef = useRef<PreparedPhoto | null>(null);

  const photo = selectedPhoto;
  const validation = validateProfile(firstName, lastName, bio);
  const hasChanges =
    firstName.trim() !== (user?.firstName ?? '') ||
    lastName.trim() !== (user?.lastName ?? '') ||
    bio !== (user?.bio ?? '');
  const hasValidationErrors = Object.values(validation).some(Boolean);

  const setPreparedPhoto = (next: PreparedPhoto | null) => {
    if (photoRef.current?.uri !== next?.uri) safeDeletePhoto(photoRef.current);
    photoRef.current = next;
    setSelectedPhoto(next);
  };

  const loadProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const freshUser = await refreshUser(signal);
        if (signal?.aborted) return;
        setFirstName(freshUser.firstName ?? '');
        setLastName(freshUser.lastName ?? '');
        setBio(freshUser.bio ?? '');
      } catch (loadError) {
        if (signal?.aborted) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          try {
            await logout();
            router.replace('/sign-in');
          } catch {
            setError('Your session could not be cleared safely. Please try again.');
          }
        } else {
          setError(requestError(loadError));
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [logout, refreshUser, user?.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void loadProfile(controller.signal);
    });
    return () => controller.abort();
  }, [loadProfile]);

  useEffect(
    () => () => {
      safeDeletePhoto(photoRef.current);
      photoRef.current = null;
    },
    [],
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/more');
  };

  const back = () => {
    if (hasChanges || photo) {
      Alert.alert('Discard unsaved changes?', 'Your profile changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: goBack },
      ]);
      return;
    }
    goBack();
  };

  const saveProfile = async () => {
    if (!user || saveInProgress.current || hasValidationErrors || !hasChanges) return;
    saveInProgress.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const updates = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio.trim(),
    };
    try {
      await profileService.updateProfile(updates);
      applyUserProfileUpdate(user.id, updates);
      setFirstName(updates.firstName);
      setLastName(updates.lastName);
      setBio(updates.bio);
      setSuccess('Profile updated.');
      try {
        await refreshUser();
      } catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          await logout();
          router.replace('/sign-in');
          return;
        }
        setError('Your changes were saved, but the latest profile could not be refreshed.');
      }
    } catch (saveError) {
      setError(requestError(saveError));
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const choosePhoto = async () => {
    if (preparingPhoto || uploadInProgress.current) return;
    setError(null);
    setSuccess(null);
    setPreparingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        exif: false,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('No image was selected.');

      const manipulator = ImageManipulator.ImageManipulator.manipulate(asset.uri);
      let prepared: PreparedPhoto | null = null;
      try {
        const largestDimension = Math.max(asset.width, asset.height);
        if (largestDimension > PROFILE_PHOTO_MAX_DIMENSION) {
          const ratio = PROFILE_PHOTO_MAX_DIMENSION / largestDimension;
          manipulator.resize({ width: Math.round(asset.width * ratio), height: null });
        }
        const image = await manipulator.renderAsync();
        try {
          const converted = await image.saveAsync({
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.82,
          });
          const file = new File(Paths.cache, `admiino-profile-${randomUUID()}.jpg`);
          await file.copy(new File(converted.uri));
          prepared = { uri: file.uri, file, size: file.size };
        } finally {
          image.release();
        }
      } finally {
        manipulator.release();
      }

      if (!prepared) throw new Error('The image could not be prepared.');
      if (prepared.size > PROFILE_PHOTO_MAX_BYTES) {
        safeDeletePhoto(prepared);
        throw new Error(
          'The prepared image exceeds the 5 MB upload limit. Choose a smaller photo.',
        );
      }
      setPreparedPhoto(prepared);
    } catch (pickError) {
      setError(
        pickError instanceof Error && pickError.message
          ? pickError.message
          : 'The photo could not be prepared. Choose a JPEG, PNG, WebP, or GIF image.',
      );
    } finally {
      setPreparingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile photo', 'Choose a photo from your library.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose Photo', onPress: () => void choosePhoto() },
    ]);
  };

  const uploadPhoto = async () => {
    if (!user || !photo || uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploadingPhoto(true);
    setError(null);
    setSuccess(null);
    try {
      const profilePictureUrl = await profileService.uploadProfilePicture(photo.file);
      applyUserProfileUpdate(user.id, { profilePictureUrl });
      setPreparedPhoto(null);
      setSuccess('Profile photo updated.');
      try {
        await refreshUser();
      } catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          await logout();
          router.replace('/sign-in');
          return;
        }
        setError('Your photo was saved, but the latest profile could not be refreshed.');
      }
    } catch (uploadError) {
      setError(requestError(uploadError));
    } finally {
      uploadInProgress.current = false;
      setUploadingPhoto(false);
    }
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  return (
    <AppScreen scrollable keyboardAvoiding padding="md">
      <View
        style={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          gap: themeTokens.spacing.md,
          paddingBottom: themeTokens.spacing.lg,
        }}
      >
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton
            accessibilityLabel="Back"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={back}
          />
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            My Profile
          </AppText>
        </View>

        {loading && !user ? <LoadingState label="Loading your profile" /> : null}
        {error ? <InlineError message={error} onRetry={() => void loadProfile()} /> : null}
        {success ? (
          <AppText accessibilityRole="alert" tone="success">
            {success}
          </AppText>
        ) : null}

        {user ? (
          <>
            <AppCard padding="md" style={{ gap: themeTokens.spacing.md }}>
              <View
                style={{
                  alignItems: 'center',
                  gap: themeTokens.spacing.sm,
                  paddingVertical: themeTokens.spacing.xs,
                }}
              >
                <Pressable
                  accessibilityLabel="Change profile photo"
                  accessibilityRole="button"
                  disabled={preparingPhoto || uploadingPhoto}
                  onPress={showPhotoOptions}
                  style={{ borderRadius: 56 }}
                >
                  {photo ? (
                    <Image
                      accessibilityLabel="Selected profile photo preview"
                      source={{ uri: photo.uri }}
                      style={{
                        width: 104,
                        height: 104,
                        borderRadius: 52,
                        backgroundColor: colors.surfaceSubtle,
                      }}
                    />
                  ) : (
                    <UserAvatar imageUrl={user.profilePictureUrl} name={displayName} size={104} />
                  )}
                </Pressable>
                <AppText variant="heading">{displayName || 'Admiino user'}</AppText>
                <AppText tone="secondary" variant="caption">
                  {photo
                    ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB · JPEG preview`
                    : 'Tap your photo to change it'}
                </AppText>
              </View>

              {photo ? (
                <View style={{ gap: themeTokens.spacing.sm }}>
                  <AppButton
                    accessibilityLabel="Upload profile photo"
                    loading={uploadingPhoto}
                    onPress={() => void uploadPhoto()}
                  >
                    {uploadingPhoto ? 'Uploading photo' : 'Save profile photo'}
                  </AppButton>
                  <AppButton
                    accessibilityLabel="Discard selected profile photo"
                    disabled={uploadingPhoto}
                    onPress={() => {
                      setPreparedPhoto(null);
                      setError(null);
                    }}
                    variant="ghost"
                  >
                    Discard photo
                  </AppButton>
                </View>
              ) : (
                <AppButton
                  accessibilityLabel="Choose profile photo"
                  disabled={preparingPhoto || uploadingPhoto}
                  loading={preparingPhoto}
                  onPress={showPhotoOptions}
                  variant="outline"
                  icon={<ImagePlus color={colors.primaryAction} size={18} />}
                >
                  {preparingPhoto ? 'Preparing photo' : 'Change photo'}
                </AppButton>
              )}
            </AppCard>

            <AppCard padding="md" style={{ gap: themeTokens.spacing.md }}>
              <AppText variant="label">Personal information</AppText>
              <AppInput
                autoCapitalize="words"
                error={validation.firstName ?? undefined}
                label="First name"
                maxLength={50}
                onChangeText={(value) => {
                  setFirstName(value);
                  setError(null);
                  setSuccess(null);
                }}
                textContentType="givenName"
                value={firstName}
              />
              <AppInput
                autoCapitalize="words"
                error={validation.lastName ?? undefined}
                label="Last name"
                maxLength={50}
                onChangeText={(value) => {
                  setLastName(value);
                  setError(null);
                  setSuccess(null);
                }}
                textContentType="familyName"
                value={lastName}
              />
              <AppInput
                error={validation.bio ?? undefined}
                label="Bio"
                maxLength={1000}
                multiline
                onChangeText={(value) => {
                  setBio(value);
                  setError(null);
                  setSuccess(null);
                }}
                placeholder="Add a short bio"
                textAlignVertical="top"
                value={bio}
                inputStyle={{ minHeight: 96, paddingTop: themeTokens.spacing.sm }}
              />
              <AppText variant="label">Email address</AppText>
              <AppText accessibilityLabel={`Email address ${user.email}`} selectable>
                {user.email}
              </AppText>
              <AppText tone="secondary" variant="caption">
                Email changes are not available in the mobile profile.
              </AppText>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <AppText variant="label">Current workspace</AppText>
                <AppText>{activeWorkspace?.company.name ?? 'No active workspace'}</AppText>
                <AppText tone="secondary" variant="caption">
                  {roleLabel(permissions?.role)}
                </AppText>
              </View>
              <AppButton
                accessibilityLabel="Save profile changes"
                disabled={!hasChanges || hasValidationErrors}
                loading={saving}
                onPress={() => void saveProfile()}
              >
                Save changes
              </AppButton>
            </AppCard>
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}
