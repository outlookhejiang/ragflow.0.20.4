interface IProps {
  filePath: string;
}

const Docx = ({ filePath }: IProps) => {
  return (
    <div className="w-full h-full">
      <iframe
        src={filePath}
        className="w-full h-full border-none"
        style={{ minHeight: '500px' }}
        title="Word预览"
      />
    </div>
  );
};

export default Docx;
