import { api } from './api';
import type { ShareResourceType } from './shares';

export interface PublicShareInfo {
  resourceType: ShareResourceType;
  resourceId: string;
  name: string;
  ownerName: string;
  sharedAt: string;
}

// Narrower than the authenticated FolderContents on purpose — the public
// endpoint only returns what this view renders, and no internal ids.
export interface PublicContents {
  folders: { id: string; name: string }[];
  files: { id: string; name: string; sizeBytes: string }[];
}

export const getPublicShareInfo = async (token: string) => {
  const { data } = await api.get<PublicShareInfo>(`/public/${token}`);
  return data;
};

export const getPublicContents = async (token: string, folderId?: string) => {
  const { data } = await api.get<PublicContents>(`/public/${token}/contents`, {
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
