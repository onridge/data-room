import { api, authHeader } from './api';

export interface Folder {
  id: string;
  name: string;
  dataRoomId: string;
  parentId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileEntry {
  id: string;
  name: string;
  sizeBytes: string;
  mimeType: string;
  dataRoomId: string;
  folderId: string | null;
  status: 'PENDING' | 'READY';
  createdAt: string;
  updatedAt: string;
}

export interface FolderContents {
  folders: Folder[];
  files: FileEntry[];
}

export interface BreadcrumbEntry {
  id: string;
  name: string;
}

export interface SubtreeSummary {
  subfolderCount: number;
  fileCount: number;
  totalSizeBytes: string;
}

export const getContents = async (token: string, dataRoomId: string, folderId?: string) => {
  const { data } = await api.get<FolderContents>(`/data-rooms/${dataRoomId}/contents`, {
    headers: authHeader(token),
    params: folderId ? { folderId } : undefined,
  });
  return data;
};

export const getFolderPath = async (token: string, dataRoomId: string, folderId: string) => {
  const { data } = await api.get<BreadcrumbEntry[]>(
    `/data-rooms/${dataRoomId}/folders/${folderId}/path`,
    { headers: authHeader(token) },
  );
  return data;
};

export const getFolderSummary = async (token: string, dataRoomId: string, folderId: string) => {
  const { data } = await api.get<SubtreeSummary>(
    `/data-rooms/${dataRoomId}/folders/${folderId}/summary`,
    { headers: authHeader(token) },
  );
  return data;
};

export const createFolder = async (
  token: string,
  dataRoomId: string,
  name: string,
  parentId?: string,
) => {
  const { data } = await api.post<Folder>(
    `/data-rooms/${dataRoomId}/folders`,
    { name, parentId },
    { headers: authHeader(token) },
  );
  return data;
};

export const renameFolder = async (
  token: string,
  dataRoomId: string,
  folderId: string,
  name: string,
) => {
  const { data } = await api.patch<Folder>(
    `/data-rooms/${dataRoomId}/folders/${folderId}`,
    { name },
    { headers: authHeader(token) },
  );
  return data;
};

export const deleteFolder = async (token: string, dataRoomId: string, folderId: string) => {
  await api.delete(`/data-rooms/${dataRoomId}/folders/${folderId}`, {
    headers: authHeader(token),
  });
};
