import { upload } from '@vercel/blob/client';

export interface UploadFileParams {
  file: File;
  dataRoomId: string;
  folderId?: string;
  token: string;
  onProgress: (percentage: number) => void;
}

export const uploadFile = ({ file, dataRoomId, folderId, token, onProgress }: UploadFileParams) => {
  const query = folderId ? `?folderId=${folderId}` : '';

  return upload(file.name, file, {
    access: 'private',
    handleUploadUrl: `${import.meta.env.VITE_API_URL}/data-rooms/${dataRoomId}/files/upload${query}`,
    headers: { Authorization: `Bearer ${token}` },
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });
};
