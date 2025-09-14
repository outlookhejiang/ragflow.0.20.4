import { useState } from 'react';

export interface FilePreviewState {
  visible: boolean;
  fileName: string;
  fileId: string;
}

export const useFilePreview = () => {
  const [previewState, setPreviewState] = useState<FilePreviewState>({
    visible: false,
    fileName: '',
    fileId: '',
  });

  const showFilePreview = (fileId: string, fileName: string) => {
    setPreviewState({
      visible: true,
      fileName,
      fileId,
    });
  };

  const hideFilePreview = () => {
    setPreviewState({
      visible: false,
      fileName: '',
      fileId: '',
    });
  };

  return {
    previewState,
    showFilePreview,
    hideFilePreview,
  };
};
