import { describe, expect, it } from '@jest/globals';

import { getNextFileViewerSelection } from './fileViewerNavigation';

const collection = [
  { id: 'project-file-a', fileName: 'a.png', fileType: 'image/png' },
  { id: 'project-file-b', fileName: 'b.png', fileType: 'image/png' },
  { id: 'project-file-c', fileName: 'c.png', fileType: 'image/png' },
];

describe('file viewer collection navigation', () => {
  it('uses the selected project file ID for each gallery step', () => {
    expect(getNextFileViewerSelection(collection, 0, 1, true)).toMatchObject({
      attachmentId: 'project-file-b',
      projectFileId: 'project-file-b',
    });
    expect(getNextFileViewerSelection(collection, 1, -1, true)).toMatchObject({
      attachmentId: 'project-file-a',
      projectFileId: 'project-file-a',
    });
  });

  it('keeps task attachments on attachment IDs without a project file ID', () => {
    const next = getNextFileViewerSelection(collection, 0, 1, false);
    expect(next).toMatchObject({ attachmentId: 'project-file-b' });
    expect(next?.projectFileId).toBeUndefined();
  });

  it('returns no selection at gallery boundaries', () => {
    expect(getNextFileViewerSelection(collection, 0, -1, true)).toBeNull();
    expect(getNextFileViewerSelection(collection, 2, 1, true)).toBeNull();
  });
});
