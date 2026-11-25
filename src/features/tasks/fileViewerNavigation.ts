export interface FileViewerCollectionItem {
  id: string;
  fileName: string;
  fileType: string;
  source?: string;
}

export function getNextFileViewerSelection(
  collection: FileViewerCollectionItem[],
  currentIndex: number,
  offset: number,
  isProjectFile: boolean,
): { item: FileViewerCollectionItem; attachmentId: string; projectFileId?: string } | null {
  const item = collection[currentIndex + offset];
  if (!item) return null;
  return {
    item,
    attachmentId: item.id,
    ...(isProjectFile ? { projectFileId: item.id } : {}),
  };
}
