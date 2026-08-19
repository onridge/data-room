import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useAuth } from '../lib/auth-context';
import { uploadFile } from '../lib/files';
import { getContents } from '../lib/folders';
import type { FolderContents } from '../lib/folders';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import type { UploadItem } from '../components/UploadPanel';

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

interface UseFileUploadParams {
  dataRoomId?: string;
  folderId?: string;
  onContentsRefreshed: (contents: FolderContents) => void;
}

export const useFileUpload = ({
  dataRoomId,
  folderId,
  onContentsRefreshed,
}: UseFileUploadParams) => {
  const { accessToken } = useAuth();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The browser's PUT to Blob storage finishing doesn't mean our DB row is
  // READY yet — Vercel's onUploadCompleted callback lands as a separate,
  // slightly-delayed request. Poll briefly instead of refetching once too
  // early and showing a stale list.
  const waitForFileToAppear = async (fileName: string) => {
    if (!accessToken || !dataRoomId) return;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const latest = await getContents(accessToken, dataRoomId, folderId);
        onContentsRefreshed(latest);
        if (latest.files.some((file) => file.name === fileName)) return;
      } catch {
        // A transient error here just means this attempt didn't refresh the
        // list; the next attempt (or the user's own reload) will catch up.
      }
    }
  };

  const uploadOne = async (item: UploadItem) => {
    if (!accessToken || !dataRoomId) return;
    try {
      await uploadFile({
        file: item.file,
        dataRoomId,
        folderId,
        token: accessToken,
        onProgress: (percentage) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, progress: percentage } : u)),
          );
        },
      });
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'done', progress: 100 } : u)),
      );
      await waitForFileToAppear(item.file.name);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed';
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'error', error: message } : u)),
      );
    }
  };

  const startUploads = (files: FileList | File[]) => {
    const rejections: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        rejections.push(`"${file.name}" — only PDF files are supported`);
        continue;
      }
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        rejections.push(
          `"${file.name}" — exceeds the ${formatBytes(MAX_UPLOAD_SIZE_BYTES)} upload limit`,
        );
        continue;
      }
      accepted.push(file);
    }

    setValidationError(rejections.length > 0 ? rejections.join('; ') : null);

    const items: UploadItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      progress: 0,
    }));
    if (items.length === 0) return;
    setUploads((prev) => [...prev, ...items]);
    items.forEach((item) => uploadOne(item));
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) startUploads(event.target.files);
    event.target.value = '';
  };

  const retryUpload = (uploadId: string) => {
    const item = uploads.find((u) => u.id === uploadId);
    if (!item) return;
    setUploads((prev) =>
      prev.map((u) => (u.id === uploadId ? { ...u, status: 'uploading', progress: 0 } : u)),
    );
    uploadOne(item);
  };

  const dragHandlers = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    },
    onDragLeave: () => setIsDragOver(false),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length) startUploads(event.dataTransfer.files);
    },
  };

  return {
    uploads,
    validationError,
    isDragOver,
    fileInputRef,
    dragHandlers,
    handleFileInputChange,
    retryUpload,
    openFilePicker: () => fileInputRef.current?.click(),
    dismissValidationError: () => setValidationError(null),
    dismissUploads: () => setUploads([]),
  };
};
