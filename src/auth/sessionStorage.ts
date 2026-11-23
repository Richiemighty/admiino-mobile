import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'admiino.mobile.access-token';
const WORKSPACE_ID_KEY = 'admiino.mobile.active-workspace-id';

export interface SecureSessionStorage {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string): Promise<void>;
  clearAccessToken(): Promise<void>;
  getActiveWorkspaceId(): Promise<string | null>;
  setActiveWorkspaceId(workspaceId: string): Promise<void>;
  clearActiveWorkspaceId(): Promise<void>;
  clearSession(): Promise<void>;
}

export class ExpoSecureSessionStorage implements SecureSessionStorage {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }
  async setAccessToken(token: string) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  }
  async clearAccessToken() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
  async getActiveWorkspaceId() {
    return SecureStore.getItemAsync(WORKSPACE_ID_KEY);
  }
  async setActiveWorkspaceId(workspaceId: string) {
    await SecureStore.setItemAsync(WORKSPACE_ID_KEY, workspaceId);
  }
  async clearActiveWorkspaceId() {
    await SecureStore.deleteItemAsync(WORKSPACE_ID_KEY);
  }
  async clearSession() {
    await Promise.all([this.clearAccessToken(), this.clearActiveWorkspaceId()]);
  }
}

export const secureSessionStorage = new ExpoSecureSessionStorage();
