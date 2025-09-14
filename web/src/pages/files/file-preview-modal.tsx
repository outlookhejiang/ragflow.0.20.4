import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Images } from '@/constants/common';
import { IModalProps } from '@/interfaces/common';
import { api_host } from '@/utils/api';
import { getExtension } from '@/utils/document-util';
import { Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import Docx from '../document-viewer/docx';
import Excel from '../document-viewer/excel';
import Image from '../document-viewer/image';
import Md from '../document-viewer/md';
import Pdf from '../document-viewer/pdf';
import Text from '../document-viewer/text';

interface IProps extends IModalProps<any> {
  fileName: string;
  fileId: string;
}

export const FilePreviewModal = ({
  visible = false,
  hideModal,
  fileName,
  fileId,
}: IProps) => {
  const { t } = useTranslation();
  const extension = getExtension(fileName);
  const api = `${api_host}/file/get/${fileId}`;

  const renderContent = () => {
    if (Images.includes(extension!)) {
      return (
        <Flex className="h-full" align="center" justify="center">
          <Image src={api} preview={false} />
        </Flex>
      );
    }
    if (extension === 'md') return <Md filePath={api} />;
    if (extension === 'txt') return <Text filePath={api} />;
    if (extension === 'pdf') return <Pdf url={api} />;
    if (extension === 'xlsx' || extension === 'xls')
      return <Excel filePath={api} />;
    if (extension === 'docx') return <Docx filePath={api} />;

    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>该文件类型不支持预览</p>
      </div>
    );
  };

  return (
    <Dialog open={visible} onOpenChange={hideModal}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{t('common.preview')}</span>
            <span className="text-sm text-muted-foreground">- {fileName}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto h-[80vh]">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
};
