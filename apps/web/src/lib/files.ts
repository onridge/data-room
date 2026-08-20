import { upload } from '@vercel/blob/client';
import { api, authHeader } from './api';
import type { FileEntry } from './folders';

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

// Carries the ancestor folder chain because search spans the whole data
// room — without it a result is just a name with no indication of where it
// lives, and two files can legitimately share a name in different folders.
export interface FileSearchResult {
  id: string;
  name: string;
  sizeBytes: string;
  folderId: string | null;
  path: { id: string; name: string }[];
}

export const searchFiles = async (token: string, dataRoomId: string, query: string) => {
  const { data } = await api.get<FileSearchResult[]>(`/data-rooms/${dataRoomId}/files/search`, {
    headers: authHeader(token),
    params: { q: query },
  });
  return data;
};

export const deleteFile = async (token: string, dataRoomId: string, fileId: string) => {
  await api.delete(`/data-rooms/${dataRoomId}/files/${fileId}`, {
    headers: authHeader(token),
  });
};

export const renameFile = async (
  token: string,
  dataRoomId: string,
  fileId: string,
  name: string,
) => {
  const { data } = await api.patch<FileEntry>(
    `/data-rooms/${dataRoomId}/files/${fileId}`,
    { name },
    { headers: authHeader(token) },
  );
  return data;
};

export const moveFile = async (
  token: string,
  dataRoomId: string,
  fileId: string,
  folderId: string | undefined,
) => {
  const { data } = await api.patch<FileEntry>(
    `/data-rooms/${dataRoomId}/files/${fileId}/move`,
    { folderId },
    { headers: authHeader(token) },
  );
  return data;
};

export interface FileVersion {
  id: string;
  versionNumber: number;
  sizeBytes: string;
  createdAt: string;
  uploadedBy: string;
  isCurrent: boolean;
}

export const getFileVersions = async (token: string, dataRoomId: string, fileId: string) => {
  const { data } = await api.get<FileVersion[]>(
    `/data-rooms/${dataRoomId}/files/${fileId}/versions`,
    { headers: authHeader(token) },
  );
  return data;
};

// Blob access is private, so the file has to be fetched through our own
// auth rather than opened by URL directly — the object URL below is what
// actually gets opened/embedded.
// versionId opens a specific revision; omitting it gets whatever is current.
export const viewFile = async (
  token: string,
  dataRoomId: string,
  fileId: string,
  versionId?: string,
) => {
  const { data } = await api.get(`/data-rooms/${dataRoomId}/files/${fileId}/content`, {
    headers: authHeader(token),
    responseType: 'blob',
    params: versionId ? { version: versionId } : undefined,
  });
  return URL.createObjectURL(data as Blob);
};
