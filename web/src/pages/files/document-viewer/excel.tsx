interface IProps {
  filePath: string;
}

const Excel = ({ filePath }: IProps) => {
  return (
    <div className="w-full h-full">
      <iframe
        src={filePath}
        className="w-full h-full border-none"
        style={{ minHeight: '500px' }}
        title="Excel预览"
      />
    </div>
  );
};

export default Excel;
