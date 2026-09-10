import { PROBLEM_PHOTO_MAX, uploadProblemPhotos } from '../components/ProblemPhotoBar';

describe('uploadProblemPhotos', () => {
  it('uploads each local uri as BLOCKER_PHOTO and returns document ids', async () => {
    const uploadFile = jest.fn(async ({ fileName }: { fileName: string }) => ({
      document: { id: `doc-${fileName}` },
    }));
    const ids = await uploadProblemPhotos({
      uris: ['file://a.jpg', 'file://b.jpg'],
      taskId: 'task-1',
      uploadFile,
    });
    expect(ids).toEqual([
      'doc-blocker-photo-task-1-1.jpg',
      'doc-blocker-photo-task-1-2.jpg',
    ]);
    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'BLOCKER_PHOTO:task-1',
        mimeType: 'image/jpeg',
        taskId: 'task-1',
      }),
    );
  });

  it('caps the picker at 8 photos', () => {
    expect(PROBLEM_PHOTO_MAX).toBe(8);
  });
});
