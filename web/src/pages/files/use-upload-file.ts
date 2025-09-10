import { UploadFormSchemaType } from '@/components/file-upload-dialog';
import { useSetModalState } from '@/hooks/common-hooks';
import { useUploadFile } from '@/hooks/use-file-request';
import { useCallback } from 'react';
import { useFileContext } from './FileContext';
import { useGetFolderId } from './hooks';

export const useHandleUploadFile = () => {
  const {
    visible: fileUploadVisible,
    hideModal: hideFileUploadModal,
    showModal: showFileUploadModal,
  } = useSetModalState();
  const { uploadFile, loading } = useUploadFile();
  const id = useGetFolderId();
  const { refreshTree } = useFileContext();

  const onFileUploadOk = useCallback(
    async ({ fileList }: UploadFormSchemaType): Promise<number | undefined> => {
      if (fileList.length > 0) {
        const ret: number = await uploadFile({ fileList, parentId: id });
        if (ret === 0) {
          hideFileUploadModal();
          // 刷新目录树（以防上传的文件包含文件夹结构）
          refreshTree();
        }
        return ret;
      }
    },
    [uploadFile, hideFileUploadModal, id, refreshTree],
  );

  return {
    fileUploadLoading: loading,
    onFileUploadOk,
    fileUploadVisible,
    hideFileUploadModal,
    showFileUploadModal,
  };
};
