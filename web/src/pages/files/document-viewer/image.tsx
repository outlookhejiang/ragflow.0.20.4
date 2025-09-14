import { Image as AntImage } from 'antd';

interface IProps {
  src: string;
  preview?: boolean;
}

const Image = ({ src, preview = true }: IProps) => {
  return (
    <AntImage
      src={src}
      preview={preview}
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    />
  );
};

export default Image;
