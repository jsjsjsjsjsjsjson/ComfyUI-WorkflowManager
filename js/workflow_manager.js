// js/workflow_manager.js
import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const PLUGIN_NAME = "WorkflowManager";

// 管理器状态
const managerState = {
    currentPath: '',
    selectedItems: new Set(),
    clipboardItem: null,
    clipboardOperation: 'cut', // 'cut' or 'copy'
    isInitialized: false,
    sortBy: 'name', // 'name', 'modified', 'size', 'type'
    sortOrder: 'asc' // 'asc' or 'desc'
};

// 等待ComfyUI API就绪
function waitForComfyAPI() {
    return new Promise((resolve) => {
        const checkAPI = () => {
            if (app.extensionManager && api && app.graph) {
                resolve();
            } else {
                setTimeout(checkAPI, 100);
            }
        };
        checkAPI();
    });
}

app.registerExtension({
    name: `Comfy.${PLUGIN_NAME}`,
    
    async setup() {
        console.log(`${PLUGIN_NAME}: Setting up...`);
        
        await waitForComfyAPI();
        
        // 延迟创建侧边栏标签
        setTimeout(() => {
            createWorkflowManagerTab();
        }, 1000);
    }
});

function createWorkflowManagerTab() {
    try {
        console.log(`${PLUGIN_NAME}: Creating workflow manager tab...`);
        
        if (!app.extensionManager?.registerSidebarTab) {
            console.error(`${PLUGIN_NAME}: extensionManager not available`);
            return;
        }
        
        app.extensionManager.registerSidebarTab({
            id: "workflow-manager",
            icon: "pi pi-folder-open",
            title: "工作流管理器",
            tooltip: "完整的工作流文件管理",
            type: "custom",
            render: (el) => {
                createManagerInterface(el);
            },
        });
        
        console.log(`${PLUGIN_NAME}: Tab created successfully`);
        
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Failed to create tab:`, error);
    }
}

function createManagerInterface(container) {
    container.innerHTML = `
        <div class="workflow-manager">
            <!-- 顶部工具栏 -->
            <div class="manager-toolbar">
                <div class="toolbar-left">
                    <button id="backBtn" class="toolbar-btn" title="返回上级" disabled>
                        <i class="pi pi-arrow-left"></i>
                    </button>
                    <button id="refreshBtn" class="toolbar-btn" title="刷新">
                        <i class="pi pi-refresh"></i>
                    </button>
                    <button id="homeBtn" class="toolbar-btn" title="根目录">
                        <i class="pi pi-home"></i>
                    </button>
                </div>
                
                <div class="toolbar-center">
                    <div class="breadcrumb" id="breadcrumb">
                        <span class="breadcrumb-item active">根目录</span>
                    </div>
                </div>
                
                <div class="toolbar-right">
                    <button id="newFolderBtn" class="toolbar-btn" title="新建文件夹">
                        <i class="pi pi-folder-plus"></i>
                    </button>
                    <button id="viewToggleBtn" class="toolbar-btn" title="切换视图">
                        <i class="pi pi-th-large"></i>
                    </button>
                    <button id="sortBtn" class="toolbar-btn" title="排序">
                        <i class="pi pi-sort"></i>
                    </button>
                </div>
            </div>
            
            <!-- 搜索栏 -->
            <div class="search-bar">
                <input type="text" id="searchInput" placeholder="搜索工作流..." class="search-input">
                <i class="pi pi-search search-icon"></i>
            </div>
            
            <!-- 主内容区域 -->
            <div class="manager-content" id="managerContent">
                <div class="loading-overlay" id="loadingOverlay">
                    <div class="loading-spinner"></div>
                    <div>加载中...</div>
                </div>
                
                <div class="file-grid" id="fileGrid">
                    <!-- 动态生成文件和文件夹 -->
                </div>
                
                <div class="empty-state" id="emptyState" style="display: none;">
                    <i class="pi pi-folder-open"></i>
                    <p>此文件夹为空</p>
                    <button class="btn-primary" onclick="showCreateFolderDialog()">创建文件夹</button>
                </div>
            </div>
            
            <!-- 状态栏 -->
            <div class="status-bar">
                <div class="status-left">
                    <span id="itemCount">0 项目</span>
                </div>
                <div class="status-right">
                    <span id="selectedCount"></span>
                </div>
            </div>
        </div>
        
        <!-- 右键菜单 -->
        <div class="context-menu" id="contextMenu">
            <div class="menu-item" data-action="open">
                <i class="pi pi-folder-open"></i> 打开
            </div>
            <div class="menu-item" data-action="rename">
                <i class="pi pi-pencil"></i> 重命名
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="cut">
                <i class="pi pi-scissors"></i> 剪切
            </div>
            <div class="menu-item" data-action="copy">
                <i class="pi pi-copy"></i> 复制
            </div>
            <div class="menu-item" data-action="paste">
                <i class="pi pi-clipboard"></i> 粘贴
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="delete" class="danger">
                <i class="pi pi-trash"></i> 删除
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="properties">
                <i class="pi pi-info-circle"></i> 属性
            </div>
        </div>
    `;
    
    // 添加样式
    addManagerStyles();
    
    // 绑定事件
    bindManagerEvents(container);
    
    // 初始化加载
    loadDirectory('');
    
    managerState.isInitialized = true;
}

function addManagerStyles() {
    if (document.querySelector('#workflow-manager-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'workflow-manager-styles';
    style.textContent = `
        .workflow-manager {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--comfy-menu-bg, #1e1e1e);
            color: var(--input-text, #ffffff);
            font-size: 12px;
        }
        
        .manager-toolbar {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--border-color, #444);
            background: var(--comfy-input-bg, #2d2d2d);
            gap: 8px;
        }
        
        .toolbar-left, .toolbar-right {
            display: flex;
            gap: 4px;
        }
        
        .toolbar-center {
            flex: 1;
            display: flex;
            align-items: center;
            min-width: 0;
        }
        
        .toolbar-btn {
            background: transparent;
            border: 1px solid var(--border-color, #555);
            color: var(--input-text, #ffffff);
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            min-width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .toolbar-btn:hover:not(:disabled) {
            background: var(--comfy-menu-bg, #1e1e1e);
            border-color: #007acc;
        }
        
        .toolbar-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 4px;
            overflow: hidden;
            white-space: nowrap;
        }
        
        .breadcrumb-item {
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            color: var(--descrip-text, #999);
            font-size: 11px;
        }
        
        .breadcrumb-item.active {
            color: var(--input-text, #ffffff);
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        
        .breadcrumb-item:hover:not(.active) {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .breadcrumb-separator {
            color: var(--descrip-text, #666);
            margin: 0 2px;
        }
        
        .search-bar {
            position: relative;
            padding: 8px;
            border-bottom: 1px solid var(--border-color, #444);
        }
        
        .search-input {
            width: 100%;
            padding: 6px 32px 6px 12px;
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            background: var(--comfy-input-bg, #2d2d2d);
            color: var(--input-text, #ffffff);
            font-size: 11px;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #007acc;
        }
        
        .search-icon {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--descrip-text, #999);
            font-size: 11px;
        }
        
        .manager-content {
            flex: 1;
            position: relative;
            overflow: auto;
        }
        
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(30, 30, 30, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            z-index: 100;
        }
        
        .loading-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--border-color, #444);
            border-top: 2px solid #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 8px;
            padding: 12px;
        }
        
        .file-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 8px;
            border-radius: 6px;
            cursor: pointer;
            border: 2px solid transparent;
            background: var(--comfy-input-bg, #2d2d2d);
            transition: all 0.2s ease;
            user-select: none;
            position: relative;
        }
        
        .file-item:hover {
            background: var(--comfy-menu-bg, #1e1e1e);
            border-color: var(--border-color, #555);
        }
        
        .file-item.selected {
            border-color: #007acc;
            background: rgba(0, 122, 204, 0.1);
        }
        
        .file-item.dragging {
            opacity: 0.5;
        }
        
        .file-icon {
            font-size: 32px;
            margin-bottom: 8px;
            color: #007acc;
        }
        
        .file-icon.folder {
            color: #ffa500;
        }
        
        .file-icon.workflow {
            color: #28a745;
        }
        
        .file-name {
            text-align: center;
            word-break: break-word;
            font-size: 11px;
            line-height: 1.3;
            max-width: 100%;
        }
        
        .file-meta {
            font-size: 9px;
            color: var(--descrip-text, #666);
            margin-top: 4px;
            text-align: center;
        }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--descrip-text, #999);
            gap: 12px;
        }
        
        .empty-state i {
            font-size: 48px;
            opacity: 0.5;
        }
        
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            border-top: 1px solid var(--border-color, #444);
            background: var(--comfy-input-bg, #2d2d2d);
            font-size: 10px;
            color: var(--descrip-text, #999);
        }
        
        .context-menu {
            position: fixed;
            background: var(--comfy-menu-bg, #1e1e1e);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            padding: 4px 0;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 150px;
        }
        
        .menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 11px;
            color: var(--input-text, #ffffff);
        }
        
        .menu-item:hover {
            background: var(--comfy-input-bg, #2d2d2d);
        }
        
        .menu-item.danger {
            color: #ff6b6b;
        }
        
        .menu-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .menu-separator {
            height: 1px;
            background: var(--border-color, #444);
            margin: 4px 8px;
        }
        
        .btn-primary {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        
        .btn-primary:hover {
            background: #005a9a;
        }
        
        /* 拖放样式 */
        .drop-zone {
            border: 2px dashed #007acc !important;
            background: rgba(0, 122, 204, 0.1) !important;
        }
        
        .drop-zone::after {
            content: "拖放到此处";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 122, 204, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            z-index: 10;
        }
    `;
    document.head.appendChild(style);
}

function bindManagerEvents(container) {
    // 工具栏按钮事件
    container.querySelector('#backBtn').addEventListener('click', navigateBack);
    container.querySelector('#refreshBtn').addEventListener('click', () => loadDirectory(managerState.currentPath));
    container.querySelector('#homeBtn').addEventListener('click', () => loadDirectory(''));
    container.querySelector('#newFolderBtn').addEventListener('click', showCreateFolderDialog);
    container.querySelector('#viewToggleBtn').addEventListener('click', toggleView);
    container.querySelector('#sortBtn').addEventListener('click', showSortMenu);
    
    // 搜索功能
    const searchInput = container.querySelector('#searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterItems(e.target.value);
        }, 300);
    });
    
    // 文件网格点击事件
    const fileGrid = container.querySelector('#fileGrid');
    fileGrid.addEventListener('click', handleFileGridClick);
    fileGrid.addEventListener('dblclick', handleFileGridDoubleClick);
    fileGrid.addEventListener('contextmenu', handleContextMenu);
    
    // 拖放事件
    fileGrid.addEventListener('dragstart', handleDragStart);
    fileGrid.addEventListener('dragover', handleDragOver);
    fileGrid.addEventListener('drop', handleDrop);
    fileGrid.addEventListener('dragend', handleDragEnd);
    
    // 全局事件
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', handleKeydown);
    
    // 面包屑导航事件
    container.querySelector('#breadcrumb').addEventListener('click', handleBreadcrumbClick);
}

// API调用函数
const WorkflowAPI = {
    async browse(path = '') {
        try {
            const response = await api.fetchApi(`/workflow-manager/browse?path=${encodeURIComponent(path)}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to browse directory:', error);
            return { success: false, error: error.message };
        }
    },
    
    async createFolder(name, parentPath = '') {
        try {
            const response = await api.fetchApi('/workflow-manager/create-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, parent_path: parentPath })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to create folder:', error);
            return { success: false, error: error.message };
        }
    },
    
    async rename(oldPath, newName) {
        try {
            const response = await api.fetchApi('/workflow-manager/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_path: oldPath, new_name: newName })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to rename:', error);
            return { success: false, error: error.message };
        }
    },
    
    async delete(path) {
        try {
            const response = await api.fetchApi('/workflow-manager/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to delete:', error);
            return { success: false, error: error.message };
        }
    },
    
    async move(sourcePath, targetDir) {
        try {
            const response = await api.fetchApi('/workflow-manager/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_path: sourcePath, target_dir: targetDir })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to move:', error);
            return { success: false, error: error.message };
        }
    },
    
    async copy(sourcePath, targetDir) {
        try {
            const response = await api.fetchApi('/workflow-manager/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_path: sourcePath, target_dir: targetDir })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to copy:', error);
            return { success: false, error: error.message };
        }
    },
    
    async readWorkflow(path) {
        try {
            const response = await api.fetchApi(`/workflow-manager/read-workflow?path=${encodeURIComponent(path)}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to read workflow:', error);
            return { success: false, error: error.message };
        }
    }
};

// 核心功能函数
async function loadDirectory(path) {
    showLoading(true);
    
    try {
        const result = await WorkflowAPI.browse(path);
        
        if (result.success) {
            managerState.currentPath = path;
            renderFileGrid(result.items);
            updateBreadcrumb(path);
            updateToolbar();
            updateStatusBar(result.items.length);
        } else {
            showToast(`加载失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`加载失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function renderFileGrid(items) {
    const fileGrid = document.querySelector('#fileGrid');
    const emptyState = document.querySelector('#emptyState');
    
    if (items.length === 0) {
        fileGrid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    fileGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    // 排序
    const sortedItems = sortItems(items);
    
    fileGrid.innerHTML = sortedItems.map(item => {
        const isFolder = item.type === 'directory';
        const iconClass = isFolder ? 'folder' : 'workflow';
        const icon = isFolder ? 'pi-folder' : 'pi-file';
        
        const meta = isFolder 
            ? `${item.workflow_count} 个工作流` 
            : `${formatFileSize(item.size)} • ${formatDate(item.modified)}`;
        
        return `
            <div class="file-item" 
                 data-path="${item.path}" 
                 data-name="${item.name}"
                 data-type="${item.type}"
                 draggable="true">
                <i class="file-icon ${iconClass} pi ${icon}"></i>
                <div class="file-name">${item.name}</div>
                <div class="file-meta">${meta}</div>
            </div>
        `;
    }).join('');
}

function updateBreadcrumb(path) {
    const breadcrumb = document.querySelector('#breadcrumb');
    const parts = path ? path.split('/').filter(Boolean) : [];
    
    let breadcrumbHTML = '<span class="breadcrumb-item" data-path="">根目录</span>';
    
    let currentPath = '';
    parts.forEach((part, index) => {
        currentPath += (currentPath ? '/' : '') + part;
        breadcrumbHTML += '<span class="breadcrumb-separator">/</span>';
        breadcrumbHTML += `<span class="breadcrumb-item" data-path="${currentPath}">${part}</span>`;
    });
    
    breadcrumb.innerHTML = breadcrumbHTML;
    
    // 激活最后一个项目
    breadcrumb.querySelectorAll('.breadcrumb-item').forEach((item, index, items) => {
        item.classList.toggle('active', index === items.length - 1);
    });
}

function updateToolbar() {
    const backBtn = document.querySelector('#backBtn');
    backBtn.disabled = !managerState.currentPath;
}

function updateStatusBar(itemCount) {
    const itemCountEl = document.querySelector('#itemCount');
    const selectedCountEl = document.querySelector('#selectedCount');
    
    itemCountEl.textContent = `${itemCount} 项目`;
    
    const selectedCount = managerState.selectedItems.size;
    selectedCountEl.textContent = selectedCount > 0 ? `已选择 ${selectedCount} 项` : '';
}

// 事件处理函数
function navigateBack() {
    if (!managerState.currentPath) return;
    
    const parts = managerState.currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    
    loadDirectory(parentPath);
}

function handleFileGridClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) {
        // 点击空白区域，清除选择
        clearSelection();
        return;
    }
    
    const path = fileItem.dataset.path;
    
    if (e.ctrlKey || e.metaKey) {
        // 多选
        toggleSelection(path);
    } else {
        // 单选
        clearSelection();
        addSelection(path);
    }
}

function handleFileGridDoubleClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;
    
    const path = fileItem.dataset.path;
    const type = fileItem.dataset.type;
    
    if (type === 'directory') {
        loadDirectory(path);
    } else if (type === 'workflow') {
        loadWorkflow(path);
    }
}

function handleContextMenu(e) {
    e.preventDefault();
    
    const fileItem = e.target.closest('.file-item');
    const contextMenu = document.querySelector('#contextMenu');
    
    if (fileItem) {
        const path = fileItem.dataset.path;
        if (!managerState.selectedItems.has(path)) {
            clearSelection();
            addSelection(path);
        }
    }
    
    // 显示右键菜单
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    
    // 绑定菜单项事件
    contextMenu.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = () => {
            const action = item.dataset.action;
            handleContextAction(action);
            hideContextMenu();
        };
    });
}

// 工具函数
function sortItems(items) {
    return items.sort((a, b) => {
        // 文件夹优先
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        
        let comparison = 0;
        
        switch (managerState.sortBy) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'modified':
                comparison = a.modified - b.modified;
                break;
            case 'size':
                comparison = (a.size || 0) - (b.size || 0);
                break;
            default:
                comparison = a.name.localeCompare(b.name);
        }
        
        return managerState.sortOrder === 'desc' ? -comparison : comparison;
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const loadingOverlay = document.querySelector('#loadingOverlay');
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    // 创建提示消息
    const toast = document.createElement('div');
    toast.className = 'workflow-toast';
    toast.textContent = message;
    
    const colors = {
        info: '#007acc',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--comfy-input-bg, #2d2d2d);
        color: var(--input-text, #ffffff);
        padding: 12px 16px;
        border-radius: 4px;
        border-left: 4px solid ${colors[type] || colors.info};
        z-index: 10000;
        font-size: 12px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 占位函数的实际实现
function toggleView() {
    const fileGrid = document.querySelector('#fileGrid');
    const viewToggleBtn = document.querySelector('#viewToggleBtn');
    const icon = viewToggleBtn.querySelector('i');
    
    if (fileGrid.classList.contains('list-view')) {
        // 切换到网格视图
        fileGrid.classList.remove('list-view');
        icon.className = 'pi pi-th-large';
        showToast('切换到网格视图');
    } else {
        // 切换到列表视图
        fileGrid.classList.add('list-view');
        icon.className = 'pi pi-list';
        showToast('切换到列表视图');
    }
}

function showSortMenu() {
    const sortBtn = document.querySelector('#sortBtn');
    const rect = sortBtn.getBoundingClientRect();
    
    // 创建排序菜单
    const sortMenu = document.createElement('div');
    sortMenu.className = 'sort-menu';
    sortMenu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 4}px;
        left: ${rect.left}px;
        background: var(--comfy-menu-bg, #1e1e1e);
        border: 1px solid var(--border-color, #555);
        border-radius: 4px;
        padding: 4px 0;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 120px;
    `;
    
    const sortOptions = [
        { key: 'name', label: '按名称', icon: 'pi-sort-alpha-down' },
        { key: 'modified', label: '按修改时间', icon: 'pi-calendar' },
        { key: 'size', label: '按大小', icon: 'pi-sort-numeric-down' },
        { key: 'type', label: '按类型', icon: 'pi-filter' }
    ];
    
    sortMenu.innerHTML = sortOptions.map(option => `
        <div class="sort-option ${managerState.sortBy === option.key ? 'active' : ''}" data-sort="${option.key}">
            <i class="pi ${option.icon}"></i>
            <span>${option.label}</span>
            ${managerState.sortBy === option.key ? 
                `<i class="pi ${managerState.sortOrder === 'asc' ? 'pi-sort-up' : 'pi-sort-down'}"></i>` 
                : ''
            }
        </div>
        ${option.key === 'name' ? '<div class="menu-separator"></div>' : ''}
    `).join('');
    
    // 添加样式
    if (!document.querySelector('#sort-menu-styles')) {
        const style = document.createElement('style');
        style.id = 'sort-menu-styles';
        style.textContent = `
            .sort-menu {
                font-size: 11px;
            }
            
            .sort-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                cursor: pointer;
                color: var(--input-text, #ffffff);
            }
            
            .sort-option:hover {
                background: var(--comfy-input-bg, #2d2d2d);
            }
            
            .sort-option.active {
                background: rgba(0, 122, 204, 0.1);
                color: #007acc;
            }
            
            .file-grid.list-view {
                grid-template-columns: 1fr;
                gap: 2px;
            }
            
            .file-grid.list-view .file-item {
                flex-direction: row;
                justify-content: flex-start;
                padding: 8px 12px;
                text-align: left;
            }
            
            .file-grid.list-view .file-icon {
                font-size: 16px;
                margin-bottom: 0;
                margin-right: 12px;
            }
            
            .file-grid.list-view .file-name {
                text-align: left;
                flex: 1;
            }
            
            .file-grid.list-view .file-meta {
                margin-top: 0;
                margin-left: auto;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 绑定点击事件
    sortMenu.addEventListener('click', (e) => {
        const sortOption = e.target.closest('.sort-option');
        if (sortOption) {
            const sortKey = sortOption.dataset.sort;
            
            if (managerState.sortBy === sortKey) {
                // 切换排序顺序
                managerState.sortOrder = managerState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // 更改排序字段
                managerState.sortBy = sortKey;
                managerState.sortOrder = 'asc';
            }
            
            // 重新渲染
            const fileGrid = document.querySelector('#fileGrid');
            const items = Array.from(fileGrid.querySelectorAll('.file-item')).map(item => ({
                name: item.dataset.name,
                type: item.dataset.type,
                path: item.dataset.path,
                modified: 0, // 这里需要从实际数据获取
                size: 0 // 这里需要从实际数据获取
            }));
            
            renderFileGrid(items);
            showToast(`按${sortOption.querySelector('span').textContent}排序`);
        }
        
        document.body.removeChild(sortMenu);
    });
    
    // 点击外部关闭菜单
    const closeMenu = (e) => {
        if (!sortMenu.contains(e.target)) {
            document.body.removeChild(sortMenu);
            document.removeEventListener('click', closeMenu);
        }
    };
    
    document.body.appendChild(sortMenu);
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

function filterItems(searchTerm) {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const name = item.dataset.name.toLowerCase();
        const matches = name.includes(searchTerm.toLowerCase());
        item.style.display = matches ? 'flex' : 'none';
    });
}

function clearSelection() {
    managerState.selectedItems.clear();
    document.querySelectorAll('.file-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateStatusBar(document.querySelectorAll('.file-item').length);
}

function addSelection(path) {
    managerState.selectedItems.add(path);
    const item = document.querySelector(`[data-path="${path}"]`);
    if (item) item.classList.add('selected');
    updateStatusBar(document.querySelectorAll('.file-item').length);
}

function toggleSelection(path) {
    if (managerState.selectedItems.has(path)) {
        managerState.selectedItems.delete(path);
        const item = document.querySelector(`[data-path="${path}"]`);
        if (item) item.classList.remove('selected');
    } else {
        addSelection(path);
    }
    updateStatusBar(document.querySelectorAll('.file-item').length);
}

function hideContextMenu() {
    const contextMenu = document.querySelector('#contextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function handleContextAction(action) {
    const selectedPaths = Array.from(managerState.selectedItems);
    
    switch (action) {
        case 'open':
            if (selectedPaths.length === 1) {
                const item = document.querySelector(`[data-path="${selectedPaths[0]}"]`);
                const type = item?.dataset.type;
                if (type === 'directory') {
                    loadDirectory(selectedPaths[0]);
                } else if (type === 'workflow') {
                    loadWorkflow(selectedPaths[0]);
                }
            }
            break;
            
        case 'rename':
            if (selectedPaths.length === 1) {
                showRenameDialog(selectedPaths[0]);
            }
            break;
            
        case 'cut':
            if (selectedPaths.length > 0) {
                managerState.clipboardItem = selectedPaths;
                managerState.clipboardOperation = 'cut';
                showToast(`已剪切 ${selectedPaths.length} 项`);
            }
            break;
            
        case 'copy':
            if (selectedPaths.length > 0) {
                managerState.clipboardItem = selectedPaths;
                managerState.clipboardOperation = 'copy';
                showToast(`已复制 ${selectedPaths.length} 项`);
            }
            break;
            
        case 'paste':
            if (managerState.clipboardItem && managerState.clipboardItem.length > 0) {
                pasteItems();
            }
            break;
            
        case 'delete':
            if (selectedPaths.length > 0) {
                deleteSelectedItems();
            }
            break;
            
        case 'properties':
            if (selectedPaths.length === 1) {
                showPropertiesDialog(selectedPaths[0]);
            }
            break;
            
        default:
            showToast(`${action} 功能待实现`, 'info');
    }
}

function showRenameDialog(path) {
    const item = document.querySelector(`[data-path="${path}"]`);
    const currentName = item?.dataset.name || '';
    
    const newName = prompt('请输入新名称:', currentName);
    if (newName && newName.trim() && newName !== currentName) {
        renameItem(path, newName.trim());
    }
}

async function renameItem(path, newName) {
    const result = await WorkflowAPI.rename(path, newName);
    
    if (result.success) {
        showToast('重命名成功');
        loadDirectory(managerState.currentPath);
    } else {
        showToast(`重命名失败: ${result.error}`, 'error');
    }
}

async function deleteSelectedItems() {
    const selectedPaths = Array.from(managerState.selectedItems);
    if (selectedPaths.length === 0) return;
    
    const confirmMsg = selectedPaths.length === 1 
        ? `确定要删除 "${selectedPaths[0]}" 吗？`
        : `确定要删除选中的 ${selectedPaths.length} 项吗？`;
    
    if (!confirm(confirmMsg)) return;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const path of selectedPaths) {
        const result = await WorkflowAPI.delete(path);
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
            console.error(`Failed to delete ${path}:`, result.error);
        }
    }
    
    if (successCount > 0) {
        showToast(`成功删除 ${successCount} 项${errorCount > 0 ? `，失败 ${errorCount} 项` : ''}`);
        loadDirectory(managerState.currentPath);
    } else {
        showToast('删除失败', 'error');
    }
}

async function pasteItems() {
    if (!managerState.clipboardItem || managerState.clipboardItem.length === 0) return;
    
    const targetDir = managerState.currentPath;
    const operation = managerState.clipboardOperation;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const sourcePath of managerState.clipboardItem) {
        let result;
        
        if (operation === 'cut') {
            result = await WorkflowAPI.move(sourcePath, targetDir);
        } else {
            result = await WorkflowAPI.copy(sourcePath, targetDir);
        }
        
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
            console.error(`Failed to ${operation} ${sourcePath}:`, result.error);
        }
    }
    
    if (successCount > 0) {
        const actionText = operation === 'cut' ? '移动' : '复制';
        showToast(`成功${actionText} ${successCount} 项${errorCount > 0 ? `，失败 ${errorCount} 项` : ''}`);
        
        // 清空剪贴板（仅剪切操作）
        if (operation === 'cut') {
            managerState.clipboardItem = null;
            managerState.clipboardOperation = 'cut';
        }
        
        loadDirectory(managerState.currentPath);
    } else {
        showToast(`${operation === 'cut' ? '移动' : '复制'}失败`, 'error');
    }
}

function showPropertiesDialog(path) {
    const item = document.querySelector(`[data-path="${path}"]`);
    const name = item?.dataset.name || '';
    const type = item?.dataset.type || '';
    
    // 创建属性对话框
    const dialog = document.createElement('div');
    dialog.className = 'properties-dialog-overlay';
    dialog.innerHTML = `
        <div class="properties-dialog">
            <div class="dialog-header">
                <h3>属性</h3>
                <button class="dialog-close" onclick="this.closest('.properties-dialog-overlay').remove()">×</button>
            </div>
            <div class="dialog-content">
                <div class="property-row">
                    <label>名称:</label>
                    <span>${name}</span>
                </div>
                <div class="property-row">
                    <label>类型:</label>
                    <span>${type === 'directory' ? '文件夹' : '工作流'}</span>
                </div>
                <div class="property-row">
                    <label>路径:</label>
                    <span>${path}</span>
                </div>
                <div class="property-row">
                    <label>完整路径:</label>
                    <span>user/default/workflows/${path}</span>
                </div>
            </div>
            <div class="dialog-footer">
                <button class="btn-primary" onclick="this.closest('.properties-dialog-overlay').remove()">确定</button>
            </div>
        </div>
    `;
    
    // 添加对话框样式
    if (!document.querySelector('#properties-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'properties-dialog-styles';
        style.textContent = `
            .properties-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            
            .properties-dialog {
                background: var(--comfy-menu-bg, #1e1e1e);
                border: 1px solid var(--border-color, #555);
                border-radius: 8px;
                min-width: 400px;
                max-width: 600px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            }
            
            .dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-color, #444);
            }
            
            .dialog-header h3 {
                margin: 0;
                color: var(--input-text, #ffffff);
                font-size: 16px;
            }
            
            .dialog-close {
                background: transparent;
                border: none;
                color: var(--descrip-text, #999);
                font-size: 20px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }
            
            .dialog-close:hover {
                background: var(--comfy-input-bg, #2d2d2d);
                color: var(--input-text, #ffffff);
            }
            
            .dialog-content {
                padding: 20px;
            }
            
            .property-row {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                gap: 12px;
            }
            
            .property-row label {
                min-width: 80px;
                color: var(--descrip-text, #999);
                font-size: 12px;
            }
            
            .property-row span {
                color: var(--input-text, #ffffff);
                font-size: 12px;
                word-break: break-all;
            }
            
            .dialog-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--border-color, #444);
                display: flex;
                justify-content: flex-end;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(dialog);
}

function handleBreadcrumbClick(e) {
    const breadcrumbItem = e.target.closest('.breadcrumb-item');
    if (breadcrumbItem) {
        const path = breadcrumbItem.dataset.path;
        loadDirectory(path);
    }
}

function handleKeydown(e) {
    // 只在管理器获得焦点时处理键盘事件
    const workflowManager = document.querySelector('.workflow-manager');
    if (!workflowManager || !workflowManager.contains(e.target)) return;
    
    if (e.key === 'F2' && managerState.selectedItems.size === 1) {
        // F2 重命名
        e.preventDefault();
        const path = Array.from(managerState.selectedItems)[0];
        showRenameDialog(path);
    } else if (e.key === 'Delete' && managerState.selectedItems.size > 0) {
        // Delete 删除
        e.preventDefault();
        deleteSelectedItems();
    } else if (e.key === 'Enter' && managerState.selectedItems.size === 1) {
        // Enter 打开
        e.preventDefault();
        const path = Array.from(managerState.selectedItems)[0];
        const item = document.querySelector(`[data-path="${path}"]`);
        const type = item?.dataset.type;
        
        if (type === 'directory') {
            loadDirectory(path);
        } else if (type === 'workflow') {
            loadWorkflow(path);
        }
    } else if (e.key === 'Backspace') {
        // Backspace 返回上级
        e.preventDefault();
        navigateBack();
    } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd 组合键
        switch (e.key.toLowerCase()) {
            case 'a':
                // Ctrl+A 全选
                e.preventDefault();
                selectAll();
                break;
            case 'c':
                // Ctrl+C 复制
                if (managerState.selectedItems.size > 0) {
                    e.preventDefault();
                    handleContextAction('copy');
                }
                break;
            case 'x':
                // Ctrl+X 剪切
                if (managerState.selectedItems.size > 0) {
                    e.preventDefault();
                    handleContextAction('cut');
                }
                break;
            case 'v':
                // Ctrl+V 粘贴
                if (managerState.clipboardItem && managerState.clipboardItem.length > 0) {
                    e.preventDefault();
                    handleContextAction('paste');
                }
                break;
            case 'n':
                // Ctrl+N 新建文件夹
                e.preventDefault();
                showCreateFolderDialog();
                break;
        }
    }
}

function selectAll() {
    const fileItems = document.querySelectorAll('.file-item');
    
    clearSelection();
    
    fileItems.forEach(item => {
        const path = item.dataset.path;
        addSelection(path);
    });
    
    showToast(`已选择 ${fileItems.length} 项`);
}

function showCreateFolderDialog() {
    const name = prompt('请输入文件夹名称:');
    if (name && name.trim()) {
        createFolder(name.trim());
    }
}

async function createFolder(name) {
    const result = await WorkflowAPI.createFolder(name, managerState.currentPath);
    
    if (result.success) {
        showToast('文件夹创建成功');
        loadDirectory(managerState.currentPath);
    } else {
        showToast(`创建失败: ${result.error}`, 'error');
    }
}

async function loadWorkflow(path) {
    try {
        const result = await WorkflowAPI.readWorkflow(path);
        
        if (result.success) {
            // 加载工作流到ComfyUI
            await app.loadGraphData(result.workflow, true, true);
            showToast('工作流已加载');
        } else {
            showToast(`加载失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`加载失败: ${error.message}`, 'error');
    }
}

// 拖放功能
let draggedItems = [];

function handleDragStart(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;
    
    const path = fileItem.dataset.path;
    
    // 如果拖拽的项目不在选中列表中，则清除选择并选中当前项目
    if (!managerState.selectedItems.has(path)) {
        clearSelection();
        addSelection(path);
    }
    
    // 设置拖拽数据
    draggedItems = Array.from(managerState.selectedItems);
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedItems));
    
    // 添加拖拽样式
    fileItem.classList.add('dragging');
    
    // 如果是多选，显示数量
    if (draggedItems.length > 1) {
        const dragImage = createDragImage(draggedItems.length);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
    }
    
    console.log('Drag start:', draggedItems);
}

function handleDragOver(e) {
    e.preventDefault();
    
    const fileItem = e.target.closest('.file-item');
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    if (fileItem && fileItem.dataset.type === 'directory') {
        const itemPath = fileItem.dataset.path;
        
        // 检查是否是有效的放置目标（不能拖拽到自己或子目录）
        if (!draggedItems.includes(itemPath) && !isSubDirectory(itemPath, draggedItems)) {
            fileItem.classList.add('drop-zone');
            
            // 设置拖拽效果（根据是否按下Ctrl键）
            if (e.ctrlKey || e.metaKey) {
                e.dataTransfer.dropEffect = 'copy';
            } else {
                e.dataTransfer.dropEffect = 'move';
            }
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const fileItem = e.target.closest('.file-item');
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    if (fileItem && fileItem.dataset.type === 'directory') {
        const targetPath = fileItem.dataset.path;
        const isCopy = e.ctrlKey || e.metaKey;
        
        // 检查是否是有效的放置目标
        if (!draggedItems.includes(targetPath) && !isSubDirectory(targetPath, draggedItems)) {
            performDropOperation(draggedItems, targetPath, isCopy);
        }
    }
}

function handleDragEnd(e) {
    const fileItem = e.target.closest('.file-item');
    if (fileItem) {
        fileItem.classList.remove('dragging');
    }
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    draggedItems = [];
}

function createDragImage(count) {
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background: var(--comfy-input-bg, #2d2d2d);
        color: var(--input-text, #ffffff);
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--border-color, #555);
        font-size: 11px;
        z-index: 1000;
    `;
    dragImage.textContent = `${count} 项`;
    
    document.body.appendChild(dragImage);
    
    // 在短暂延迟后移除
    setTimeout(() => {
        if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
        }
    }, 100);
    
    return dragImage;
}

function isSubDirectory(parentPath, childPaths) {
    // 检查是否试图将文件夹拖拽到其子目录
    return childPaths.some(childPath => {
        return parentPath.startsWith(childPath + '/') || parentPath === childPath;
    });
}

async function performDropOperation(sourcePaths, targetPath, isCopy) {
    if (sourcePaths.length === 0) return;
    
    const operation = isCopy ? 'copy' : 'move';
    const actionText = isCopy ? '复制' : '移动';
    
    let successCount = 0;
    let errorCount = 0;
    
    // 显示加载状态
    showLoading(true);
    
    try {
        for (const sourcePath of sourcePaths) {
            let result;
            
            if (isCopy) {
                result = await WorkflowAPI.copy(sourcePath, targetPath);
            } else {
                result = await WorkflowAPI.move(sourcePath, targetPath);
            }
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                console.error(`Failed to ${operation} ${sourcePath}:`, result.error);
            }
        }
        
        if (successCount > 0) {
            showToast(`成功${actionText} ${successCount} 项${errorCount > 0 ? `，失败 ${errorCount} 项` : ''}`);
            loadDirectory(managerState.currentPath);
        } else {
            showToast(`${actionText}失败`, 'error');
        }
        
    } catch (error) {
        showToast(`${actionText}失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
} 