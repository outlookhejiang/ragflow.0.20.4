import React, { createContext, useContext, useState } from 'react';

interface IFileContext {
  treeVersion: number;
  refreshTree: () => void;
}

const FileContext = createContext<IFileContext | undefined>(undefined);

export const FileContextProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [treeVersion, setTreeVersion] = useState(0);

  const refreshTree = () => {
    setTreeVersion((v) => v + 1);
  };

  return (
    <FileContext.Provider value={{ treeVersion, refreshTree }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFileContext = () => {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFileContext must be used within a FileContextProvider');
  }
  return context;
};
