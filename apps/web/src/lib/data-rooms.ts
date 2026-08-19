import { api, authHeader } from './api';

export interface DataRoom {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export const listDataRooms = async (token: string) => {
  const { data } = await api.get<DataRoom[]>('/data-rooms', { headers: authHeader(token) });
  return data;
};

export const getDataRoom = async (token: string, id: string) => {
  const { data } = await api.get<DataRoom>(`/data-rooms/${id}`, { headers: authHeader(token) });
  return data;
};

export const createDataRoom = async (token: string, name: string) => {
  const { data } = await api.post<DataRoom>(
    '/data-rooms',
    { name },
    { headers: authHeader(token) },
  );
  return data;
};

export const renameDataRoom = async (token: string, id: string, name: string) => {
  const { data } = await api.patch<DataRoom>(
    `/data-rooms/${id}`,
    { name },
    { headers: authHeader(token) },
  );
  return data;
};

export const deleteDataRoom = async (token: string, id: string) => {
  await api.delete(`/data-rooms/${id}`, { headers: authHeader(token) });
};

export interface DataRoomSummary {
  folderCount: number;
  fileCount: number;
  totalSizeBytes: string;
  activeShareCount: number;
}

export const getDataRoomSummary = async (token: string, id: string) => {
  const { data } = await api.get<DataRoomSummary>(`/data-rooms/${id}/summary`, {
    headers: authHeader(token),
  });
  return data;
};
