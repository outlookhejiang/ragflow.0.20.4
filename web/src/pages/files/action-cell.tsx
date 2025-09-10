import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import NewDocumentLink from '@/components/new-document-link';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDownloadFile } from '@/hooks/file-manager-hooks';
import { IFile } from '@/interfaces/database/file-manager';
import {
  getExtension,
  isSupportedPreviewDocumentType,
} from '@/utils/document-util';
import { CellContext } from '@tanstack/react-table';
import {
  ArrowDownToLine,
  Eye,
  FolderInput,
  FolderPen,
  Link2,
  Trash2,
} from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UseHandleConnectToKnowledgeReturnType,
  UseRenameCurrentFileReturnType,
} from './hooks';
import { useHandleDeleteFile } from './use-delete-file';
import { UseMoveDocumentShowType } from './use-move-file';
import { isFolderType, isKnowledgeBaseType } from './util';

type IProps = Pick<CellContext<IFile, unknown>, 'row'> &
  Pick<UseHandleConnectToKnowledgeReturnType, 'showConnectToKnowledgeModal'> &
  Pick<UseRenameCurrentFileReturnType, 'showFileRenameModal'> &
  UseMoveDocumentShowType;

export function ActionCell({
  row,
  showConnectToKnowledgeModal,
  showFileRenameModal,
  showMoveFileModal,
}: IProps) {
  const record = row.original;
  const documentId = record.id;
  const { downloadFile } = useDownloadFile();
  const isFolder = isFolderType(record.type);
  const extension = getExtension(record.name);
  const isKnowledgeBase = isKnowledgeBaseType(record.source_type);
  const { t } = useTranslation();

  const handleShowConnectToKnowledgeModal = useCallback(() => {
    showConnectToKnowledgeModal(record);
  }, [record, showConnectToKnowledgeModal]);

  const onDownloadDocument = useCallback(() => {
    downloadFile({
      id: documentId,
      filename: record.name,
    });
  }, [documentId, downloadFile, record.name]);

  const handleShowFileRenameModal = useCallback(() => {
    showFileRenameModal(record);
  }, [record, showFileRenameModal]);

  const handleShowMoveFileModal = useCallback(() => {
    showMoveFileModal([record.id]);
  }, [record, showMoveFileModal]);

  const { handleRemoveFile } = useHandleDeleteFile();

  const onRemoveFile = useCallback(() => {
    handleRemoveFile([documentId]);
  }, [handleRemoveFile, documentId]);

  return (
    <section className="flex gap-4 items-center text-text-sub-title-invert opacity-0 group-hover:opacity-100 transition-opacity">
      {isKnowledgeBase || (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="transparent"
              className="border-none hover:bg-bg-card text-text-primary"
              size={'sm'}
              onClick={handleShowConnectToKnowledgeModal}
            >
              <Link2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>链接到知识库</p>
          </TooltipContent>
        </Tooltip>
      )}
      {isKnowledgeBase || (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="transparent"
              className="border-none hover:bg-bg-card text-text-primary"
              size={'sm'}
              onClick={handleShowMoveFileModal}
            >
              <FolderInput />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>移动</p>
          </TooltipContent>
        </Tooltip>
      )}
      {isKnowledgeBase || (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="transparent"
              className="border-none hover:bg-bg-card text-text-primary"
              size={'sm'}
              onClick={handleShowFileRenameModal}
            >
              <FolderPen />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>重命名</p>
          </TooltipContent>
        </Tooltip>
      )}
      {isFolder || (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="transparent"
              className="border-none hover:bg-bg-card text-text-primary"
              size={'sm'}
              onClick={onDownloadDocument}
            >
              <ArrowDownToLine />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>下载</p>
          </TooltipContent>
        </Tooltip>
      )}

      {isSupportedPreviewDocumentType(extension) && (
        <NewDocumentLink
          documentId={documentId}
          documentName={record.name}
          className="text-text-sub-title-invert"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="transparent"
                className="border-none hover:bg-bg-card text-text-primary"
                size={'sm'}
              >
                <Eye />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>预览</p>
            </TooltipContent>
          </Tooltip>
        </NewDocumentLink>
      )}

      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="transparent"
        className="border-none" size={'sm'}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleShowMoveFileModal}>
            {t('common.move')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleShowFileRenameModal}>
            {t('common.rename')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isFolder || (
            <DropdownMenuItem onClick={onDownloadDocument}>
              {t('common.download')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu> */}
      {isKnowledgeBase || (
        <ConfirmDeleteDialog onOk={onRemoveFile}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="transparent"
                className="border-none hover:bg-bg-card text-text-primary"
                size={'sm'}
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>删除</p>
            </TooltipContent>
          </Tooltip>
        </ConfirmDeleteDialog>
      )}
    </section>
  );
}
