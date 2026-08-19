import { api } from './api';
import type { ShareResourceType } from './shares';
import type { FolderContents } from './folders';

export interface PublicShareInfo {
  resourceType: ShareResourceType;
  resourceId: string;
  name: string;
}

export const getPublicShareInfo = async (token: string) => {
  const { data } = await api.get<PublicShareInfo>(`/public/${token}`);
  return data;
};

export const getPublicContents = async (token: string, folderId?: string) => {
  const { data } = await api.get<FolderContents>(`/public/${token}/contents`, {
    params: folderId ? { folderId } : undefined,
  });
  return data;
};

export const viewPublicFile = async (token: string, fileId: string) => {
  const { data } = await api.get(`/public/${token}/files/${fileId}/content`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data as Blob);
};
