import { useRowSelection } from '@/hooks/logic-hooks/use-row-selection';
import { useFetchFileList } from '@/hooks/use-file-request';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'umi';
import { FileContent } from './FileContent';
import { FileContextProvider } from './FileContext';
import FolderTree from './FolderTree';
import { useBulkOperateFile } from './use-bulk-operate-file';
import { useHandleCreateFolder } from './use-create-folder';
import { useHandleMoveFile } from './use-move-file';
import { useSelectBreadcrumbItems } from './use-navigate-to-folder';
import { useHandleUploadFile } from './use-upload-file';

function FilesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    fileUploadVisible,
    hideFileUploadModal,
    showFileUploadModal,
    fileUploadLoading,
    onFileUploadOk,
  } = useHandleUploadFile();

  const {
    folderCreateModalVisible,
    showFolderCreateModal,
    hideFolderCreateModal,
    folderCreateLoading,
    onFolderCreateOk,
  } = useHandleCreateFolder();

  const {
    pagination,
    files,
    total,
    loading,
    setPagination,
    searchString,
    handleInputChange,
  } = useFetchFileList();

  const {
    rowSelection,
    setRowSelection,
    rowSelectionIsEmpty,
    clearRowSelection,
    selectedCount,
  } = useRowSelection();

  const {
    showMoveFileModal,
    moveFileVisible,
    onMoveFileOk,
    hideMoveFileModal,
    moveFileLoading,
  } = useHandleMoveFile({ clearRowSelection });

  const { list } = useBulkOperateFile({
    files,
    rowSelection,
    showMoveFileModal,
    setRowSelection,
  });

  const breadcrumbItems = useSelectBreadcrumbItems();

  const handleFolderSelect = (folderId: string) => {
    searchParams.set('folderId', folderId);
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  return (
    <section className="flex h-full">
      <div className="w-64 border-r overflow-y-auto">
        <FolderTree onSelect={handleFolderSelect} />
      </div>
      <div className="flex-1">
        <FileContent
          t={t}
          fileUploadVisible={fileUploadVisible}
          hideFileUploadModal={hideFileUploadModal}
          showFileUploadModal={showFileUploadModal}
          fileUploadLoading={fileUploadLoading}
          onFileUploadOk={onFileUploadOk}
          folderCreateModalVisible={folderCreateModalVisible}
          showFolderCreateModal={showFolderCreateModal}
          hideFolderCreateModal={hideFolderCreateModal}
          folderCreateLoading={folderCreateLoading}
          onFolderCreateOk={onFolderCreateOk}
          pagination={pagination}
          files={files}
          total={total}
          loading={loading}
          setPagination={setPagination}
          searchString={searchString}
          handleInputChange={handleInputChange}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          rowSelectionIsEmpty={rowSelectionIsEmpty}
          selectedCount={selectedCount}
          showMoveFileModal={showMoveFileModal}
          moveFileVisible={moveFileVisible}
          onMoveFileOk={onMoveFileOk}
          hideMoveFileModal={hideMoveFileModal}
          moveFileLoading={moveFileLoading}
          bulkOperateList={list}
          breadcrumbItems={breadcrumbItems}
        />
      </div>
    </section>
  );
}

export default function Files() {
  return (
    <FileContextProvider>
      <FilesPage />
    </FileContextProvider>
  );
}
