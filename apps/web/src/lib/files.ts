import { upload } from '@vercel/blob/client';
import { api, authHeader } from './api';

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

export const deleteFile = async (token: string, dataRoomId: string, fileId: string) => {
  await api.delete(`/data-rooms/${dataRoomId}/files/${fileId}`, {
    headers: authHeader(token),
  });
};
