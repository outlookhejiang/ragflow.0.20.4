import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/input';
import { Authorization } from '@/constants/authorization';
import { Images } from '@/constants/common';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchPureFileList } from '@/hooks/file-manager-hooks';
import { IFile } from '@/interfaces/database/file-manager';
import {
  INextTestingResult,
  ITestingChunk,
  ITestingDocument,
} from '@/interfaces/database/knowledge';
import { cn } from '@/lib/utils';
import DocxPreviewer from '@/pages/document-viewer/docx';
import ExcelPreviewer from '@/pages/document-viewer/excel';
import ImagePreview from '@/pages/document-viewer/image';
import kbService, { listDataset } from '@/services/knowledge-service';
import { api_host } from '@/utils/api';
import { getAuthorization } from '@/utils/authorization-util';
import { formatDate } from '@/utils/date';
import {
  getExtension,
  isSupportedPreviewDocumentType,
} from '@/utils/document-util';
import { Button, Empty, Modal, Pagination, Spin, Tree } from 'antd';
import type { DataNode, EventDataNode } from 'antd/es/tree';
import { BookOpen, ChevronRight, FileText, Folder } from 'lucide-react';

const { DirectoryTree } = Tree;
const HIDDEN_ROOT_FOLDERS = new Set(['.knowledgebase']);
const TEXT_PREVIEW_EXTENSIONS = new Set(['txt', 'md', 'json', 'csv']);
const NAME_COLLATOR = new Intl.Collator('en', {
  sensitivity: 'base',
  numeric: true,
});

const EXTENSION_MAP: Record<string, string> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'docx',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  json: 'json',
  csv: 'csv',
  xls: 'xls',
  xlsx: 'xlsx',
  ppt: 'ppt',
  pptx: 'pptx',
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  gif: 'gif',
  bmp: 'bmp',
  tif: 'tif',
  tiff: 'tiff',
  webp: 'webp',
};

const SEARCH_PAGE_SIZE = 10;

type FileTreeNode = DataNode & {
  file: IFile;
  isLeaf: boolean;
  children?: FileTreeNode[];
};

type PreviewState =
  | { type: 'empty' }
  | { type: 'loading' }
  | { type: 'text'; content: string }
  | { type: 'pdf'; url: string }
  | { type: 'component'; ext: string; url: string }
  | { type: 'unsupported'; message: string };

type PreviewRenderOptions = {
  badge?: string;
  keyword?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  previewId?: string;
  contentRef?: React.MutableRefObject<HTMLDivElement | null>;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const escapeHtml = (value: string | undefined | null) => {
  if (!value) {
    return '';
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const highlightText = (text: string | undefined | null, keyword: string) => {
  if (!text) {
    return '';
  }

  const trimmedKeyword = keyword?.trim() || '';
  if (!trimmedKeyword) {
    return escapeHtml(text);
  }

  // 支持多个关键词搜索（用空格分隔）
  const keywords = trimmedKeyword.split(/\s+/).filter((k) => k.length > 0);
  let result = escapeHtml(text);

  keywords.forEach((kw) => {
    const reg = new RegExp(`(${escapeRegExp(kw)})`, 'gi');
    result = result.replace(
      reg,
      `<mark class="bg-yellow-200 text-yellow-900 px-1 rounded font-semibold shadow-sm border border-yellow-300 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-600">$1</mark>`,
    );
  });

  return result;
};

// 处理后端返回的高亮内容，将 <em> 标签替换为自定义高亮样式
const processBackendHighlight = (
  highlightContent: string | undefined | null,
): string => {
  if (!highlightContent) {
    return '';
  }

  // 将后端返回的 <em> 标签替换为我们的高亮样式
  return highlightContent.replace(
    /<em>([^<]*)<\/em>/gi,
    '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded font-semibold shadow-sm border border-yellow-300 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-600">$1</mark>',
  );
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const mapFilesToTreeNodes = (files: IFile[]): FileTreeNode[] => {
  return [...files]
    .sort((a, b) => {
      const aFolder = a.type === 'folder' ? 0 : 1;
      const bFolder = b.type === 'folder' ? 0 : 1;
      if (aFolder !== bFolder) {
        return aFolder - bFolder;
      }
      const compareResult = NAME_COLLATOR.compare(
        a.name.toLowerCase(),
        b.name.toLowerCase(),
      );
      if (compareResult !== 0) {
        return compareResult;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    })
    .map((file) => ({
      key: file.id,
      title: file.name,
      file,
      isLeaf: file.type !== 'folder',
      selectable: true,
    }));
};

const updateTreeData = (
  list: FileTreeNode[],
  key: React.Key,
  children: FileTreeNode[],
): FileTreeNode[] =>
  list.map((node) => {
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

const filterTreeData = (
  nodes: FileTreeNode[],
  keyword: string,
): FileTreeNode[] => {
  if (!keyword.trim()) {
    return nodes;
  }
  const lowerKeyword = keyword.trim().toLowerCase();

  const travel = (nodeList: FileTreeNode[]): FileTreeNode[] => {
    const filtered: FileTreeNode[] = [];
    nodeList.forEach((node) => {
      const title = String(node.title ?? '').toLowerCase();
      const match = title.includes(lowerKeyword);
      const children = node.children ? travel(node.children) : [];

      if (match || children.length) {
        filtered.push({
          ...node,
          children,
        });
      }
    });
    return filtered;
  };

  return travel(nodes);
};

const collectAllKeys = (nodes: FileTreeNode[]): string[] => {
  const keys: string[] = [];
  const loop = (list: FileTreeNode[]) => {
    list.forEach((node) => {
      keys.push(String(node.key));
      if (node.children?.length) {
        loop(node.children);
      }
    });
  };
  loop(nodes);
  return keys;
};

const findNodeById = (
  nodes: FileTreeNode[],
  id: string,
): FileTreeNode | null => {
  for (const node of nodes) {
    if (String(node.key) === id) {
      return node;
    }
    if (node.children?.length) {
      const result = findNodeById(node.children, id);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const inferExtensionFromDoc = (chunk: ITestingChunk): string => {
  // 优先使用 docnm_kwd 字段，再尝试 doc_name
  const docName = chunk.docnm_kwd || chunk.doc_name || '';
  const extFromName = getExtension(docName);
  if (extFromName) {
    return extFromName.toLowerCase();
  }
  const type = chunk.doc_type_kwd?.toLowerCase().trim() ?? '';
  if (type) {
    if (EXTENSION_MAP[type]) {
      return EXTENSION_MAP[type];
    }
    const normalized = type.replace(/[^a-z0-9]/g, '');
    if (EXTENSION_MAP[normalized]) {
      return EXTENSION_MAP[normalized];
    }
    if (type.includes('pdf')) {
      return 'pdf';
    }
    if (type.includes('docx')) {
      return 'docx';
    }
    if (type.includes('doc')) {
      return 'doc';
    }
    if (type.includes('pptx')) {
      return 'pptx';
    }
    if (type.includes('ppt')) {
      return 'ppt';
    }
    if (type.includes('xls')) {
      return 'xlsx';
    }
    if (type.includes('txt')) {
      return 'txt';
    }
  }
  return '';
};

const AllInOneQueryPage = () => {
  const { t } = useTranslate('allInOneQuery');
  const { fetchList } = useFetchPureFileList();

  const [treeData, setTreeData] = useState<FileTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState<boolean>(false);
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [contentKeyword, setContentKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<IFile | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>({
    type: 'empty',
  });
  const [globalSearchValue, setGlobalSearchValue] = useState('');
  const [globalSearchKeyword, setGlobalSearchKeyword] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] =
    useState<INextTestingResult | null>(null);
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(
    null,
  );
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>([]);
  const [knowledgeIdsLoading, setKnowledgeIdsLoading] =
    useState<boolean>(false);
  const [modalPreviewVisible, setModalPreviewVisible] = useState(false);
  const [modalPreviewFile, setModalPreviewFile] = useState<IFile | null>(null);
  const [modalPreviewState, setModalPreviewState] = useState<PreviewState>({
    type: 'empty',
  });
  const [modalPreviewContext, setModalPreviewContext] = useState<{
    keyword?: string;
    chunk?: ITestingChunk;
  } | null>(null);
  const [searchPage, setSearchPage] = useState(1);

  // 文件搜索相关状态
  const [fileSearchLoading, setFileSearchLoading] = useState(false);
  const [fileSearchResults, setFileSearchResults] = useState<IFile[]>([]);
  const [isFileSearchMode, setIsFileSearchMode] = useState(false);

  const previewCleanupRef = useRef<(() => void) | null>(null);
  const modalPreviewCleanupRef = useRef<(() => void) | null>(null);
  const modalPreviewScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const modalPreviewFocusCleanupRef = useRef<(() => void) | null>(null);

  const isSearchMode = globalSearchLoading || !!globalSearchKeyword;

  // 递归搜索所有文件
  const searchAllFiles = useCallback(
    async (keyword: string, parentId: string = ''): Promise<IFile[]> => {
      const results: IFile[] = [];
      try {
        const ret = await fetchList(parentId);
        if (ret.code === 0 && ret.data.files) {
          const files = ret.data.files as IFile[];

          for (const file of files) {
            if (HIDDEN_ROOT_FOLDERS.has(file.name)) {
              continue;
            }

            // 模糊匹配文件名
            if (file.name.toLowerCase().includes(keyword.toLowerCase())) {
              results.push(file);
            }

            // 如果是文件夹，递归搜索
            if (file.type === 'folder') {
              const subResults = await searchAllFiles(keyword, file.id);
              results.push(...subResults);
            }
          }
        }
      } catch (error) {
        console.warn('搜索文件失败:', error);
      }

      // 按文件夹优先原则排序
      return results.sort((a, b) => {
        // 文件夹优先
        const aFolder = a.type === 'folder' ? 0 : 1;
        const bFolder = b.type === 'folder' ? 0 : 1;
        if (aFolder !== bFolder) {
          return aFolder - bFolder;
        }
        // 同类型按名称排序
        return NAME_COLLATOR.compare(
          a.name.toLowerCase(),
          b.name.toLowerCase(),
        );
      });
    },
    [fetchList],
  );

  // 处理文件搜索
  const handleFileSearch = useCallback(async () => {
    const keyword = materialKeyword.trim();
    if (!keyword) {
      setFileSearchResults([]);
      setIsFileSearchMode(false);
      return;
    }

    setFileSearchLoading(true);
    setIsFileSearchMode(true);
    try {
      const results = await searchAllFiles(keyword);
      setFileSearchResults(results);
    } catch (error) {
      console.error('文件搜索错误:', error);
      setFileSearchResults([]);
    } finally {
      setFileSearchLoading(false);
    }
  }, [materialKeyword, searchAllFiles]);

  // 清除文件搜索
  const handleClearFileSearch = useCallback(() => {
    setMaterialKeyword('');
    setFileSearchResults([]);
    setIsFileSearchMode(false);
  }, []);

  // 处理文件搜索的键盘事件
  const handleFileSearchKeyDown: React.KeyboardEventHandler<
    HTMLInputElement
  > = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleFileSearch();
    }
  };

  const runPreview = useCallback(
    async (
      file: IFile | null,
      setState: (state: PreviewState) => void,
      cleanupRef: React.MutableRefObject<(() => void) | null>,
    ) => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      if (!file || file.type === 'folder') {
        setState({ type: 'empty' });
        return;
      }

      setState({ type: 'loading' });

      const ext = getExtension(file.name) || (file as any).ext || '';
      const knowledgeSource =
        typeof file.source_type === 'string'
          ? file.source_type.toLowerCase()
          : '';
      const knowledgeId =
        (file as any).kb_id ||
        file.parent_id ||
        file.kbs_info?.[0]?.kb_id ||
        '';

      const isKnowledgeFile = [
        'knowledge',
        'knowledgebase',
        'kb',
        'dataset',
      ].includes(knowledgeSource);

      const url = isKnowledgeFile
        ? `${api_host}/document/get/${file.id}${knowledgeId ? `?kb_id=${knowledgeId}` : ''}`
        : `${api_host}/file/get/${file.id}`;

      const toUnsupported = (message: string) =>
        setState({
          type: 'unsupported',
          message,
        });

      try {
        if (ext === 'pdf') {
          const response = await fetch(url, {
            headers: {
              [Authorization]: getAuthorization(),
            },
          });
          if (!response.ok) {
            throw new Error('Failed to fetch file');
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          setState({ type: 'pdf', url: objectUrl });
          cleanupRef.current = () => URL.revokeObjectURL(objectUrl);
          return;
        }

        if (TEXT_PREVIEW_EXTENSIONS.has(ext)) {
          const response = await fetch(url, {
            headers: {
              [Authorization]: getAuthorization(),
            },
          });
          if (!response.ok) {
            throw new Error('Failed to fetch file');
          }
          const text = await response.text();
          setState({ type: 'text', content: text });
          return;
        }

        if (isSupportedPreviewDocumentType(ext)) {
          setState({ type: 'component', ext, url });
          return;
        }

        toUnsupported(t('previewNotAvailable'));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('previewLoadFailed');
        toUnsupported(message || t('previewLoadFailed'));
      }
    },
    [t],
  );

  const handleGlobalSearch = useCallback(async () => {
    const keyword = globalSearchValue.trim();
    if (!keyword) {
      setGlobalSearchKeyword('');
      setGlobalSearchResult(null);
      setGlobalSearchError(null);
      return;
    }

    if (knowledgeIdsLoading) {
      return;
    }

    if (knowledgeIds.length === 0) {
      setGlobalSearchKeyword(keyword);
      setGlobalSearchError(t('globalSearchNoKb'));
      setGlobalSearchResult(null);
      return;
    }

    setSearchPage(1);
    setGlobalSearchLoading(true);
    setGlobalSearchError(null);
    setGlobalSearchResult(null);
    setGlobalSearchKeyword(keyword);
    try {
      const { data } = await kbService.retrieval_test({
        question: keyword,
        similarity_threshold: 0.2,
        vector_similarity_weight: 0,
        highlight: true,
        top_k: 10,
        doc_ids: [],
        kb_id: knowledgeIds,
      });
      setGlobalSearchResult(data?.data ?? null);
    } catch (error) {
      setGlobalSearchResult(null);
      setGlobalSearchError(
        error instanceof Error ? error.message : String(error ?? ''),
      );
    } finally {
      setGlobalSearchLoading(false);
    }
  }, [globalSearchValue, knowledgeIdsLoading, knowledgeIds, t]);

  const handleGlobalSearchKeyDown: React.KeyboardEventHandler<
    HTMLInputElement
  > = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleGlobalSearch();
    }
  };

  const handleClearGlobalSearch = useCallback(() => {
    setGlobalSearchValue('');
    setGlobalSearchKeyword('');
    setGlobalSearchResult(null);
    setGlobalSearchError(null);
    setSearchPage(1);
  }, []);

  useEffect(() => {
    const loadRoot = async () => {
      setTreeLoading(true);
      const ret = await fetchList('');
      if (ret.code === 0) {
        const files = (ret.data.files || []).filter(
          (file: IFile) => !HIDDEN_ROOT_FOLDERS.has(file.name),
        );
        const nodes = mapFilesToTreeNodes(files);
        setTreeData(nodes);
        if (nodes.length > 0) {
          const firstNode = nodes[0];
          setExpandedKeys((keys) =>
            Array.from(new Set([...keys, firstNode.key as string])),
          );
          setSelectedKeys([firstNode.key as string]);
          setSelectedFile(firstNode.file);
          setPreviewState(
            firstNode.file.type === 'folder'
              ? { type: 'empty' }
              : { type: 'loading' },
          );
        } else {
          setSelectedKeys([]);
          setSelectedFile(null);
          setPreviewState({ type: 'empty' });
        }
      }
      setTreeLoading(false);
    };

    loadRoot();
  }, [fetchList, t]);

  useEffect(() => {
    const fetchKnowledgeIds = async () => {
      setKnowledgeIdsLoading(true);
      try {
        const { data } = await listDataset({
          page: 1,
          page_size: 1000,
        });
        const ids =
          data?.data?.kbs
            ?.map((item: { id?: string }) => item.id)
            .filter((id: string | undefined): id is string => Boolean(id)) ??
          [];
        setKnowledgeIds(ids);
      } catch (error) {
        console.warn('Failed to fetch knowledge ids', error);
        setKnowledgeIds([]);
      } finally {
        setKnowledgeIdsLoading(false);
      }
    };

    fetchKnowledgeIds();
  }, []);

  useEffect(() => {
    if (isSearchMode) {
      return;
    }

    if (!selectedFile) {
      setPreviewState({ type: 'empty' });
      return;
    }

    runPreview(selectedFile, setPreviewState, previewCleanupRef);
  }, [selectedFile, isSearchMode, runPreview]);

  useEffect(() => {
    return () => {
      previewCleanupRef.current?.();
      modalPreviewCleanupRef.current?.();
    };
  }, []);

  const handleLoadData = async (node: EventDataNode<FileTreeNode>) => {
    const file = node.file;
    if (!file || file.type !== 'folder') {
      return;
    }
    if (node.children && node.children.length > 0) {
      return;
    }
    const ret = await fetchList(file.id);
    if (ret.code === 0) {
      const children = mapFilesToTreeNodes(ret.data.files || []);
      setTreeData((origin) => updateTreeData(origin, node.key, children));
    }
  };

  const filteredTreeData = useMemo(
    () => (isFileSearchMode ? [] : filterTreeData(treeData, materialKeyword)),
    [treeData, materialKeyword, isFileSearchMode],
  );

  const treeExpandedKeys = useMemo(() => {
    if (isFileSearchMode) {
      return [];
    }
    if (materialKeyword.trim()) {
      return collectAllKeys(filteredTreeData);
    }
    return expandedKeys;
  }, [expandedKeys, filteredTreeData, materialKeyword, isFileSearchMode]);

  const handleTreeExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys.map(String));
  };

  const handleTreeSelect = async (
    keys: React.Key[],
    info: {
      node: EventDataNode<FileTreeNode>;
    },
  ) => {
    if (isSearchMode) {
      handleClearGlobalSearch();
    }
    if (isFileSearchMode) {
      handleClearFileSearch();
    }
    setSelectedKeys(keys.map(String));
    const file = info.node.file;
    setSelectedFile(file ?? null);
    if (!file || file.type === 'folder') {
      setPreviewState({ type: 'empty' });
    } else {
      setPreviewState({ type: 'loading' });
    }
  };

  const handlePreviewSearchResult = useCallback(
    (chunk: ITestingChunk) => {
      if (!chunk?.doc_id) {
        return;
      }

      const existingNode = findNodeById(treeData, chunk.doc_id);
      const docMeta: ITestingDocument | undefined =
        globalSearchResult?.doc_aggs?.find(
          (doc) => String(doc.doc_id) === String(chunk.doc_id),
        );

      const ext = inferExtensionFromDoc(chunk);

      const inferredName = (() => {
        const docName =
          docMeta?.doc_name ||
          chunk.docnm_kwd ||
          chunk.doc_name ||
          existingNode?.file?.name;
        if (!docName) {
          return ext ? `preview.${ext}` : 'preview';
        }
        if (getExtension(docName)) {
          return docName;
        }
        return ext ? `${docName}.${ext}` : docName;
      })();

      const targetFile: IFile = existingNode?.file
        ? {
            ...existingNode.file,
            name: inferredName || existingNode.file.name,
            source_type: existingNode.file.source_type || 'knowledge',
            parent_id: existingNode.file.parent_id || chunk.kb_id,
          }
        : {
            id: chunk.doc_id,
            name: inferredName,
            type: 'file',
            location: '',
            parent_id: chunk.kb_id,
            create_date: '',
            create_time: 0,
            created_by: '',
            size: 0,
            tenant_id: '',
            update_date: '',
            update_time: 0,
            source_type: 'knowledge',
            kbs_info: [],
          };

      (targetFile as any).kb_id = chunk.kb_id;
      if (!(targetFile as any).ext) {
        (targetFile as any).ext = ext;
      }

      setModalPreviewContext({
        keyword: globalSearchKeyword,
        chunk,
      });
      modalPreviewFocusCleanupRef.current?.();
      modalPreviewFocusCleanupRef.current = null;
      setModalPreviewFile(targetFile);
      setModalPreviewState({ type: 'loading' });
      setModalPreviewVisible(true);
      runPreview(targetFile, setModalPreviewState, modalPreviewCleanupRef);
    },
    [globalSearchResult?.doc_aggs, globalSearchKeyword, runPreview, treeData],
  );

  useEffect(() => {
    if (previewState.type !== 'text' && contentKeyword) {
      setContentKeyword('');
    }
  }, [previewState.type, contentKeyword]);

  useEffect(() => {
    if (!modalPreviewVisible) {
      modalPreviewFocusCleanupRef.current?.();
      modalPreviewFocusCleanupRef.current = null;
      return;
    }

    if (modalPreviewState.type !== 'text') {
      modalPreviewFocusCleanupRef.current?.();
      modalPreviewFocusCleanupRef.current = null;
      return;
    }

    const chunk = modalPreviewContext?.chunk;
    if (!chunk) {
      return;
    }

    const container = modalPreviewScrollContainerRef.current;
    if (!container) {
      return;
    }

    const focusTarget = () => {
      modalPreviewFocusCleanupRef.current?.();
      modalPreviewFocusCleanupRef.current = null;

      let targetElement: HTMLElement | null = null;

      const positions = Array.isArray(chunk.positions) ? chunk.positions : [];
      const [range] = positions;
      if (Array.isArray(range) && range.length > 0) {
        const startIndex = Number(range[0]);
        if (!Number.isNaN(startIndex) && startIndex >= 0) {
          const safeStart = Math.min(
            startIndex,
            modalPreviewState.content.length,
          );
          const before = modalPreviewState.content.slice(0, safeStart);
          const lineIndex = Math.max(before.split(/\r?\n/).length - 1, 0);
          targetElement = container.querySelector<HTMLElement>(
            `[data-line-index="${lineIndex}"]`,
          );
        }
      }

      if (!targetElement) {
        const highlightPlain = (chunk.highlight || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        if (highlightPlain) {
          targetElement =
            Array.from(
              container.querySelectorAll<HTMLElement>('[data-line-index]'),
            ).find((paragraph) => {
              const normalized = (paragraph.textContent || '')
                .replace(/\s+/g, ' ')
                .toLowerCase();
              return normalized.includes(highlightPlain);
            }) ?? null;
        }
      }

      if (!targetElement) {
        const markElement = container.querySelector('mark');
        if (markElement) {
          targetElement =
            (markElement.closest('[data-line-index]') as HTMLElement) ??
            (markElement.parentElement as HTMLElement);
        }
      }

      if (targetElement) {
        const targetTop = Math.max(
          targetElement.offsetTop - container.clientHeight / 2,
          0,
        );
        container.scrollTo({ top: targetTop, behavior: 'smooth' });

        const originalBg = targetElement.style.backgroundColor;
        const originalTransition = targetElement.style.transition;
        targetElement.style.transition = 'background-color 0.6s ease';
        targetElement.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
        const timeoutId = window.setTimeout(() => {
          targetElement.style.backgroundColor = originalBg;
          targetElement.style.transition = originalTransition;
        }, 2000);

        modalPreviewFocusCleanupRef.current = () => {
          window.clearTimeout(timeoutId);
          targetElement.style.backgroundColor = originalBg;
          targetElement.style.transition = originalTransition;
        };
      }
    };

    const frameId = window.requestAnimationFrame(focusTarget);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [modalPreviewVisible, modalPreviewState, modalPreviewContext]);

  useEffect(() => {
    const total = globalSearchResult?.chunks?.length ?? 0;
    if (total === 0) {
      if (searchPage !== 1) {
        setSearchPage(1);
      }
      return;
    }

    const maxPage = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
    if (searchPage > maxPage) {
      setSearchPage(maxPage);
    }
  }, [globalSearchResult, searchPage]);

  const totalChunks = globalSearchResult?.chunks?.length ?? 0;
  const paginatedChunks = useMemo(() => {
    if (!globalSearchResult?.chunks?.length) {
      return [];
    }
    const start = (searchPage - 1) * SEARCH_PAGE_SIZE;
    return globalSearchResult.chunks.slice(start, start + SEARCH_PAGE_SIZE);
  }, [globalSearchResult, searchPage]);

  const renderPreviewContent = (
    state: PreviewState,
    options: PreviewRenderOptions = {},
  ) => {
    const {
      badge,
      keyword,
      emptyTitle,
      emptyDescription,
      previewId,
      contentRef,
    } = options;

    if (state.type === 'loading') {
      return (
        <div className="flex h-full items-center justify-center text-text-tertiary">
          <Spin />
        </div>
      );
    }

    if (state.type === 'pdf') {
      return (
        <div className="h-full w-full overflow-auto">
          <iframe
            src={state.url}
            title="pdf-preview"
            className="h-full w-full"
            style={{ border: 'none' }}
          />
        </div>
      );
    }

    if (state.type === 'component') {
      return (
        <div className="h-full w-full overflow-auto">
          {(() => {
            const { ext, url } = state;
            if (ext === 'xlsx' || ext === 'xls') {
              return <ExcelPreviewer filePath={url} />;
            }
            if (ext === 'docx') {
              return <DocxPreviewer filePath={url} />;
            }
            if (Images.includes(ext)) {
              return (
                <div className="flex min-h-full min-w-full items-center justify-center">
                  <ImagePreview src={url} preview={false} />
                </div>
              );
            }
            return (
              <div className="flex h-full flex-col items-center justify-center text-center text-text-tertiary">
                <BookOpen className="mb-3 size-10" />
                <p className="text-base font-medium">
                  {t('previewNotAvailable')}
                </p>
              </div>
            );
          })()}
        </div>
      );
    }

    if (state.type === 'text') {
      return (
        <div className="h-full w-full overflow-auto" ref={contentRef}>
          <article className="prose prose-invert max-w-none space-y-5">
            {badge && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <BookOpen className="size-4" />
                {badge}
              </div>
            )}
            {state.content.split(/\r?\n/).map((paragraph, index) => {
              const dataAttributes: Record<string, string> = {
                'data-line-index': String(index),
              };
              if (previewId) {
                dataAttributes['data-preview-source'] = previewId;
              }
              return (
                <p
                  key={index}
                  className="leading-7 whitespace-pre"
                  {...dataAttributes}
                  dangerouslySetInnerHTML={{
                    __html: highlightText(paragraph, keyword ?? ''),
                  }}
                />
              );
            })}
          </article>
        </div>
      );
    }

    if (state.type === 'unsupported') {
      return (
        <div className="flex h-full flex-col items-center justify-center text-center text-text-tertiary">
          <BookOpen className="mb-3 size-10" />
          <p className="text-base font-medium">{state.message}</p>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-text-tertiary">
        <BookOpen className="mb-3 size-10" />
        <p className="text-base font-medium">
          {emptyTitle ?? t('emptyStateTitle')}
        </p>
        {emptyDescription && <p className="text-sm">{emptyDescription}</p>}
      </div>
    );
  };

  const badgeLabel = useMemo(() => {
    if (!selectedFile) {
      return '';
    }
    if (selectedFile.type === 'folder') {
      return t('folderBadge');
    }
    return t('fileBadge');
  }, [selectedFile, t]);

  const createdAt = selectedFile?.create_time
    ? formatDate(selectedFile.create_time)
    : selectedFile?.create_date;
  const updatedAt = selectedFile?.update_time
    ? formatDate(selectedFile.update_time)
    : selectedFile?.update_date;

  return (
    <div className="flex h-full flex-col bg-bg-base text-foreground">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-bg-card px-8 py-4">
        <div className="text-sm text-text-secondary">
          {t('globalSearchDescription')}
        </div>
        <div className="flex w-full max-w-xl items-center gap-2">
          <SearchInput
            placeholder={t('globalSearchPlaceholder')}
            value={globalSearchValue}
            onChange={(event) => setGlobalSearchValue(event.target.value)}
            onKeyDown={handleGlobalSearchKeyDown}
            disabled={treeLoading}
          />
          <Button
            type="primary"
            loading={globalSearchLoading || knowledgeIdsLoading}
            onClick={handleGlobalSearch}
            disabled={knowledgeIdsLoading}
          >
            {t('globalSearchAction')}
          </Button>
          <Button
            onClick={handleClearGlobalSearch}
            disabled={!globalSearchKeyword && !globalSearchValue}
          >
            {t('globalSearchClear')}
          </Button>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="w-[320px] border-r border-border bg-bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-text-secondary mb-3">
              文件搜索
            </h2>
            <div className="flex gap-2">
              <SearchInput
                placeholder="输入文件名进行搜索..."
                value={materialKeyword}
                onChange={(event) => setMaterialKeyword(event.target.value)}
                onKeyDown={handleFileSearchKeyDown}
                disabled={fileSearchLoading}
              />
              <Button
                size="small"
                type="primary"
                loading={fileSearchLoading}
                onClick={handleFileSearch}
                disabled={!materialKeyword.trim()}
              >
                搜索
              </Button>
            </div>
            {isFileSearchMode && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  找到 {fileSearchResults.length} 个结果
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={handleClearFileSearch}
                  className="text-xs p-0 h-auto"
                >
                  清除
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {fileSearchLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spin />
              </div>
            ) : isFileSearchMode ? (
              <div className="h-full overflow-auto px-2 py-3">
                {fileSearchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-text-tertiary">
                    <FileText className="size-8 mb-2" />
                    <p className="text-sm">未找到匹配的文件</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {fileSearchResults.map((file) => {
                      const Icon = file.type === 'folder' ? Folder : FileText;
                      const isSelected = selectedKeys.includes(file.id);
                      return (
                        <div
                          key={file.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer hover:bg-primary/5',
                            {
                              'bg-primary/10 text-primary shadow-sm':
                                isSelected,
                            },
                          )}
                          onClick={() => {
                            if (isSearchMode) {
                              handleClearGlobalSearch();
                            }
                            setSelectedKeys([file.id]);
                            setSelectedFile(file);
                            if (file.type === 'folder') {
                              setPreviewState({ type: 'empty' });
                            } else {
                              setPreviewState({ type: 'loading' });
                            }
                          }}
                        >
                          <Icon className="size-4 text-text-tertiary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate" title={file.name}>
                              {file.name}
                            </div>
                            {file.location && (
                              <div
                                className="text-xs text-text-tertiary truncate mt-0.5"
                                title={file.location}
                              >
                                {file.location}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full overflow-auto px-2 py-3">
                <DirectoryTree<FileTreeNode>
                  multiple={false}
                  treeData={filteredTreeData}
                  loadData={handleLoadData}
                  onExpand={handleTreeExpand}
                  onSelect={handleTreeSelect}
                  expandedKeys={treeExpandedKeys}
                  selectedKeys={selectedKeys}
                  showIcon={false}
                  switcherIcon={
                    <ChevronRight className="size-4 text-text-tertiary" />
                  }
                  titleRender={(nodeData) => {
                    const node = nodeData as FileTreeNode;
                    const Icon =
                      node.file?.type === 'folder' ? Folder : FileText;
                    const title = String(node.title ?? '');
                    const label = materialKeyword.trim()
                      ? highlightText(title, materialKeyword)
                      : title;
                    return (
                      <span
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
                          {
                            'bg-primary/10 text-primary shadow-sm':
                              selectedKeys.includes(String(node.key)),
                          },
                        )}
                      >
                        <Icon className="size-4 text-text-tertiary" />
                        <span
                          className="truncate"
                          title={title}
                          dangerouslySetInnerHTML={{ __html: label }}
                        />
                      </span>
                    );
                  }}
                />
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-h-0">
          {isSearchMode ? (
            <div className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
                {globalSearchLoading ? (
                  <div className="flex h-full items-center justify-center text-text-tertiary">
                    <Spin />
                  </div>
                ) : globalSearchError ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-destructive">
                    <BookOpen className="mb-3 size-10" />
                    <p className="text-base font-medium">
                      {t('globalSearchError', { message: globalSearchError })}
                    </p>
                  </div>
                ) : paginatedChunks.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-text-tertiary">
                    <Empty description={t('globalSearchEmpty')} />
                  </div>
                ) : (
                  <>
                    {/* 搜索结果统计信息 */}
                    <div className="mb-4 flex items-center justify-between px-2">
                      <span className="text-sm text-text-secondary">
                        {t('globalSearchResultCount', {
                          count: totalChunks,
                        })}
                      </span>
                      {totalChunks > SEARCH_PAGE_SIZE && (
                        <span className="text-xs text-text-tertiary">
                          {t('globalSearchCurrentPage', {
                            current: (searchPage - 1) * SEARCH_PAGE_SIZE + 1,
                            end: Math.min(
                              searchPage * SEARCH_PAGE_SIZE,
                              totalChunks,
                            ),
                          })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-4 pb-6">
                      {paginatedChunks.map((chunk) => (
                        <article
                          key={`${chunk.doc_id}-${chunk.chunk_id}`}
                          className="rounded-lg border border-border bg-bg-card p-4 shadow-sm hover:shadow-md transition-shadow duration-200 hover:border-primary/30"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <h3
                              className="text-base font-semibold text-text-secondary"
                              dangerouslySetInnerHTML={{
                                __html: highlightText(
                                  chunk.docnm_kwd ||
                                    chunk.doc_name ||
                                    '未命名文档',
                                  globalSearchKeyword,
                                ),
                              }}
                            />
                            <span className="text-xs text-text-tertiary">
                              {t('globalSearchSimilarity', {
                                value: chunk.similarity?.toFixed(3) ?? 0,
                              })}
                            </span>
                          </div>
                          <div className="mb-3">
                            <Button
                              size="small"
                              type="link"
                              onClick={() => handlePreviewSearchResult(chunk)}
                            >
                              {t('globalSearchPreviewButton')}
                            </Button>
                          </div>
                          <div
                            className="mt-3 text-sm leading-7 text-text-secondary bg-gray-50 dark:bg-gray-800 p-3 rounded border-l-4 border-primary/30"
                            dangerouslySetInnerHTML={{
                              __html: chunk.highlight
                                ? processBackendHighlight(chunk.highlight)
                                : highlightText(
                                    chunk.content_with_weight || '',
                                    globalSearchKeyword,
                                  ),
                            }}
                          />
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* 将分页组件移出滚动容器，固定在底部 */}
              {totalChunks > 0 && (
                <div className="flex-shrink-0 border-t border-border bg-bg-secondary px-8 py-4">
                  <div className="flex justify-center">
                    <Pagination
                      current={searchPage}
                      pageSize={SEARCH_PAGE_SIZE}
                      total={totalChunks}
                      showSizeChanger={false}
                      showQuickJumper={totalChunks > SEARCH_PAGE_SIZE}
                      showTotal={(total, range) =>
                        `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                      }
                      onChange={(page) => setSearchPage(page)}
                    />
                  </div>
                </div>
              )}
              {/* 正常分页组件 - 修复高度问题 */}
              {totalChunks > 0 && (
                <div
                  className="flex-shrink-0 bg-white border-t border-gray-200"
                  style={{ minHeight: '100px', height: '100px' }}
                >
                  <div className="flex justify-center items-center h-full px-8 py-2">
                    <Pagination
                      current={searchPage}
                      pageSize={SEARCH_PAGE_SIZE}
                      total={totalChunks}
                      showSizeChanger={false}
                      showQuickJumper={false}
                      showTotal={(total, range) =>
                        `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                      }
                      onChange={(page) => setSearchPage(page)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : isFileSearchMode && !selectedFile ? (
            <div className="flex flex-1 flex-col min-h-0">
              <header className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold">文件搜索结果</h1>
                  <p className="text-sm text-text-tertiary">
                    关键词："{materialKeyword}" - 共找到{' '}
                    {fileSearchResults.length} 个文件
                  </p>
                  <p className="text-sm text-text-secondary">
                    请在左侧列表中点击文件查看预览
                  </p>
                </div>
              </header>
              <section className="flex-1 px-8 py-6 overflow-auto">
                <div className="flex h-full flex-col items-center justify-center text-center text-text-tertiary">
                  <FileText className="mb-3 size-10" />
                  <p className="text-base font-medium">选择一个文件查看预览</p>
                  <p className="text-sm">
                    点击左侧列表中的任意文件即可在此处查看内容
                  </p>
                </div>
              </section>
            </div>
          ) : (
            <>
              <header className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
                <div className="space-y-2">
                  {selectedFile && badgeLabel && (
                    <Badge variant="secondary">{badgeLabel}</Badge>
                  )}
                  <h1 className="text-2xl font-semibold">
                    {selectedFile?.name ?? t('emptyStateTitle')}
                  </h1>
                  {selectedFile?.location && (
                    <p className="text-sm text-text-tertiary max-w-2xl">
                      {selectedFile.location}
                    </p>
                  )}
                  {selectedFile && (
                    <div className="flex items-center gap-3 text-xs text-text-tertiary">
                      {createdAt && <span>{createdAt}</span>}
                      {createdAt && updatedAt && (
                        <span className="size-1 rounded-full bg-text-tertiary" />
                      )}
                      {updatedAt && <span>{updatedAt}</span>}
                    </div>
                  )}
                </div>
                {previewState.type === 'text' && !isFileSearchMode && (
                  <div className="w-72">
                    <h3 className="text-sm font-medium text-text-secondary mb-2">
                      {t('contentSearchLabel')}
                    </h3>
                    <SearchInput
                      placeholder={t('contentSearchPlaceholder')}
                      value={contentKeyword}
                      onChange={(event) =>
                        setContentKeyword(event.target.value)
                      }
                    />
                  </div>
                )}
              </header>
              <section className="flex-1 px-8 py-6 overflow-hidden">
                {renderPreviewContent(previewState, {
                  badge: badgeLabel,
                  keyword: isFileSearchMode ? '' : contentKeyword,
                  emptyTitle: selectedFile
                    ? t('emptyPreviewTitle')
                    : t('emptyStateTitle'),
                  emptyDescription: selectedFile
                    ? t('emptyPreviewDescription')
                    : t('emptyStateDescription'),
                })}
              </section>
            </>
          )}
        </main>
      </div>
      <Modal
        open={modalPreviewVisible}
        maskClosable={false}
        title={modalPreviewFile?.name || t('previewModalTitle')}
        onCancel={() => {
          modalPreviewCleanupRef.current?.();
          modalPreviewCleanupRef.current = null;
          modalPreviewFocusCleanupRef.current?.();
          modalPreviewFocusCleanupRef.current = null;
          setModalPreviewVisible(false);
          setModalPreviewFile(null);
          setModalPreviewState({ type: 'empty' });
          setModalPreviewContext(null);
        }}
        footer={null}
        width="80vw"
        bodyStyle={{ height: '70vh', padding: 0 }}
        destroyOnClose
      >
        {renderPreviewContent(modalPreviewState, {
          badge: modalPreviewFile
            ? modalPreviewFile.type === 'folder'
              ? t('folderBadge')
              : t('fileBadge')
            : undefined,
          keyword: modalPreviewContext?.keyword ?? globalSearchKeyword,
          emptyTitle: t('emptyPreviewTitle'),
          emptyDescription: t('emptyPreviewDescription'),
          previewId: 'modal-preview',
          contentRef: modalPreviewScrollContainerRef,
        })}
      </Modal>
    </div>
  );
};

export default AllInOneQueryPage;
