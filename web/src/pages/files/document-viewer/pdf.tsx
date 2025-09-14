import { useEffect, useRef } from 'react';

interface IProps {
  url: string;
}

const Pdf = ({ url }: IProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // 清空容器内容
      containerRef.current.innerHTML = '';

      // 创建 iframe 来显示 PDF
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';

      containerRef.current.appendChild(iframe);
    }
  }, [url]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '500px' }}
    />
  );
};

export default Pdf;
