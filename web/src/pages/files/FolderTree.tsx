import { IFile } from '@/interfaces/database/file-manager';
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
        .filter((file: IFile) => isFolderType(file.type))
        .sort((a: IFile, b: IFile) => a.name.localeCompare(b.name))
        .map((folder: IFile) => ({
          title: folder.name,
          key: folder.id,
          isLeaf: false,
          icon: <FolderOutlined />,
        }));
    }
    return [];
  };

  useEffect(() => {
    const initLoad = async () => {
      const rootFolders = await fetchFolders('');
      setTreeData(rootFolders);
    };

    // 刷新策略：每次都重新加载，但保持展开状态
    if (treeVersion > 0) {
      // 保存当前的展开状态
      const currentExpandedKeys = [...expandedKeys];

      // 清空数据并重新加载
      setTreeData([]);

      // 稍微延迟一下重新加载，确保后端数据已经更新
      setTimeout(async () => {
        await initLoad();
        // 恢复之前的展开状态
        if (currentExpandedKeys.length > 0) {
          setExpandedKeys(currentExpandedKeys);
          // 为每个之前展开的节点重新加载子节点
          for (const key of currentExpandedKeys) {
            const children = await fetchFolders(key as string);
            setTreeData((origin) => updateTreeData(origin, key, children));
          }
        }
      }, 200); // 200ms 延迟
    } else {
      // 初始加载
      initLoad();
    }
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
      <h2 className="text-lg font-semibold mb-4">知识库目录</h2>
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
