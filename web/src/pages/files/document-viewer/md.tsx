import { Spin } from 'antd';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface IProps {
  filePath: string;
}

const Md = ({ filePath }: IProps) => {
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
        console.error('Failed to fetch markdown content:', error);
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
    <div className="prose prose-sm max-w-none p-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default Md;
