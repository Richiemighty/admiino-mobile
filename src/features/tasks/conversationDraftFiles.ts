import { File } from 'expo-file-system';

import type { PickedConversationFile } from './conversationDraft';

export function deleteTemporaryConversationFiles(files: PickedConversationFile[]): void {
  for (const item of files) {
    try {
      const file = new File(item.uri);
      if (file.exists) file.delete();
    } catch {
      console.warn('Unable to remove a temporary conversation file.');
    }
  }
}
