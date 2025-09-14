import { Spin } from 'antd';
import { useEffect, useState } from 'react';

interface IProps {
  filePath: string;
}

const Text = ({ filePath }: IProps) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(filePath);
        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Failed to fetch text content:', error);
        setContent('预览失败');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <pre className="whitespace-pre-wrap text-sm font-mono">{content}</pre>
    </div>
  );
};

export default Text;
