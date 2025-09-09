import { BulkOperateBar } from '@/components/bulk-operate-bar';
import { FileUploadDialog } from '@/components/file-upload-dialog';
import ListFilterBar from '@/components/list-filter-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IFile } from '@/interfaces/database/file-manager';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { Upload } from 'lucide-react';
import { CreateFolderDialog } from './create-folder-dialog';
import { FileBreadcrumb } from './file-breadcrumb';
import { FilesTable } from './files-table';
import { MoveDialog } from './move-dialog';

export const FileContent = ({
  t,
  fileUploadVisible,
  hideFileUploadModal,
  showFileUploadModal,
  fileUploadLoading,
  onFileUploadOk,
  folderCreateModalVisible,
  showFolderCreateModal,
  hideFolderCreateModal,
  folderCreateLoading,
  onFolderCreateOk,
  pagination,
  files,
  total,
  loading,
  setPagination,
  searchString,
  handleInputChange,
  rowSelection,
  setRowSelection,
  rowSelectionIsEmpty,
  selectedCount,
  showMoveFileModal,
  moveFileVisible,
  onMoveFileOk,
  hideMoveFileModal,
  moveFileLoading,
  bulkOperateList,
  breadcrumbItems,
}: {
  t: any;
  fileUploadVisible: boolean;
  hideFileUploadModal: () => void;
  showFileUploadModal: () => void;
  fileUploadLoading: boolean;
  onFileUploadOk: () => void;
  folderCreateModalVisible: boolean;
  showFolderCreateModal: () => void;
  hideFolderCreateModal: () => void;
  folderCreateLoading: boolean;
  onFolderCreateOk: (name: string) => void;
  pagination: any;
  files: IFile[];
  total: number;
  loading: boolean;
  setPagination: (pagination: any) => void;
  searchString: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rowSelection: RowSelectionState;
  setRowSelection: OnChangeFn<RowSelectionState>;
  rowSelectionIsEmpty: boolean;
  selectedCount: number;
  showMoveFileModal: (fileIds: string[], isBulk: boolean) => void;
  moveFileVisible: boolean;
  onMoveFileOk: (destination: string) => void;
  hideMoveFileModal: () => void;
  moveFileLoading: boolean;
  bulkOperateList: any[];
  breadcrumbItems: any[];
}) => {
  const leftPanel = (
    <div>
      {breadcrumbItems.length > 0 ? (
        <FileBreadcrumb></FileBreadcrumb>
      ) : (
        t('fileManager.files')
      )}
    </div>
  );

  return (
    <section className="p-8 h-full flex flex-col">
      <ListFilterBar
        leftPanel={leftPanel}
        searchString={searchString}
        onSearchChange={handleInputChange}
        showFilter={false}
        icon={'file'}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Upload />
              {t('knowledgeDetails.addFile')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem onClick={showFileUploadModal}>
              {t('fileManager.uploadFile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={showFolderCreateModal}>
              {t('fileManager.newFolder')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ListFilterBar>
      {!rowSelectionIsEmpty && (
        <BulkOperateBar
          list={bulkOperateList}
          count={selectedCount}
        ></BulkOperateBar>
      )}
      <div className="flex-1">
        <FilesTable
          files={files}
          total={total}
          pagination={pagination}
          setPagination={setPagination}
          loading={loading}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          showMoveFileModal={showMoveFileModal}
        ></FilesTable>
      </div>
      {fileUploadVisible && (
        <FileUploadDialog
          hideModal={hideFileUploadModal}
          onOk={onFileUploadOk}
          loading={fileUploadLoading}
        ></FileUploadDialog>
      )}
      {folderCreateModalVisible && (
        <CreateFolderDialog
          loading={folderCreateLoading}
          visible={folderCreateModalVisible}
          hideModal={hideFolderCreateModal}
          onOk={onFolderCreateOk}
        ></CreateFolderDialog>
      )}
      {moveFileVisible && (
        <MoveDialog
          hideModal={hideMoveFileModal}
          onOk={onMoveFileOk}
          loading={moveFileLoading}
        ></MoveDialog>
      )}
    </section>
  );
};
