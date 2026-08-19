import { api, authHeader } from './api';

export type ShareResourceType = 'DATA_ROOM' | 'FOLDER' | 'FILE';
export type ShareMode = 'PUBLIC' | 'PERMISSIONED';

export interface ShareGrant {
  id: string;
  shareId: string;
  userId: string;
  role: 'VIEWER' | 'EDITOR';
  createdAt: string;
  user: { id: string; email: string; name: string };
}

export interface Share {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  mode: ShareMode;
  token: string | null;
  createdById: string;
  createdAt: string;
  revokedAt: string | null;
  grants: ShareGrant[];
}

export const listShares = async (
  token: string,
  resourceType: ShareResourceType,
  resourceId: string,
) => {
  const { data } = await api.get<Share[]>('/shares', {
    headers: authHeader(token),
    params: { resourceType, resourceId },
  });
  return data;
};

export const createShare = async (
  token: string,
  resourceType: ShareResourceType,
  resourceId: string,
  mode: ShareMode,
  emails?: string[],
) => {
  const { data } = await api.post<Share>(
    '/shares',
    { resourceType, resourceId, mode, emails },
    { headers: authHeader(token) },
  );
  return data;
};

export const revokeShare = async (token: string, shareId: string) => {
  await api.delete(`/shares/${shareId}`, { headers: authHeader(token) });
};

export const addGrant = async (token: string, shareId: string, email: string) => {
  const { data } = await api.post<ShareGrant>(
    `/shares/${shareId}/grants`,
    { email },
    { headers: authHeader(token) },
  );
  return data;
};

export const removeGrant = async (token: string, shareId: string, grantId: string) => {
  await api.delete(`/shares/${shareId}/grants/${grantId}`, { headers: authHeader(token) });
};
