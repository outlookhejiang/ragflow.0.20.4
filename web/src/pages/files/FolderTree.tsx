import fileManagerService from '@/services/file-manager-service';
import { FolderOutlined } from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import { Tree, TreeProps } from 'antd';
import React, { useEffect, useState } from 'react';
import { useFileContext } from './FileContext';
import { isFolderType } from './util';

interface FolderTreeProps {
  onSelect: (folderId: string) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ onSelect }) => {
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const { treeVersion } = useFileContext();

  const fetchFolders = async (parentId: string = '') => {
    const { data } = await fileManagerService.listFile({
      parent_id: parentId,
      page_size: 1000, // Assuming a large number to get all folders
      page: 1,
    });
    if (data?.data) {
      return data.data.files
        .filter((file) => isFolderType(file.type))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((folder) => ({
          title: folder.name,
          key: folder.id,
          isLeaf: false,
          icon: <FolderOutlined />,
        }));
    }
    return [];
  };

  useEffect(() => {
    // This effect now handles the refresh
    const initLoad = async () => {
      const rootFolders = await fetchFolders('');
      setTreeData(rootFolders);
    };

    // On the initial load (version 0), just load.
    // On subsequent loads (refreshes), clear everything first to purge the antd Tree's internal cache.
    if (treeVersion > 0) {
      setTreeData([]);
      setExpandedKeys([]);
    }

    initLoad();
  }, [treeVersion]);

  const onLoadData: TreeProps['loadData'] = async ({ key, children }) => {
    if (children) {
      return;
    }
    const newFolders = await fetchFolders(key as string);
    setTreeData((origin) => updateTreeData(origin, key, newFolders));
  };

  const updateTreeData = (
    list: TreeDataNode[],
    key: React.Key,
    children: TreeDataNode[],
  ): TreeDataNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return {
          ...node,
          children,
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }
      return node;
    });
  };

  const handleSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      onSelect(selectedKeys[0] as string);
    }
  };

  const handleExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-4">Folders</h2>
      <Tree
        showIcon
        loadData={onLoadData}
        treeData={treeData}
        onSelect={handleSelect}
        onExpand={handleExpand}
        expandedKeys={expandedKeys}
      />
    </div>
  );
};

export default FolderTree;
