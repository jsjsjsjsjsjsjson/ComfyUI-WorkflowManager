// js/workflow_utils.js
// 工具函数和状态管理

const PLUGIN_NAME = "WorkflowManager";

// 管理器状态
const managerState = {
    currentPath: '',
    selectedItems: new Set(),
    clipboardItem: null,
    clipboardOperation: 'cut', // 'cut' or 'copy'
    isInitialized: false,
    sortBy: 'name', // 'name', 'modified', 'size', 'type'
    sortOrder: 'asc', // 'asc' or 'desc'
    expandedFolders: new Set() // 已展开的文件夹路径
};

// 防止重复加载的标志
let isLoading = false;
// 用于存储loadDirectory函数的引用，避免循环依赖
let loadDirectoryRef = null;

// 设置loadDirectory函数引用
function setLoadDirectoryRef(loadDirectoryFunc) {
    loadDirectoryRef = loadDirectoryFunc;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 格式化日期
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// 排序项目
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

// 过滤项目
function filterItems(searchTerm) {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const name = item.dataset.name.toLowerCase();
        const matches = name.includes(searchTerm.toLowerCase());
        item.style.display = matches ? 'flex' : 'none';
    });
}

// 选择管理
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

function selectAll() {
    const fileItems = document.querySelectorAll('.file-item');
    
    clearSelection();
    
    fileItems.forEach(item => {
        const path = item.dataset.path;
        addSelection(path);
    });
    
    showToast(`已选择 ${fileItems.length} 项`);
}

// 状态栏更新
function updateStatusBar(itemCount) {
    const itemCountEl = document.querySelector('#itemCount');
    const selectedCountEl = document.querySelector('#selectedCount');
    
    if (itemCountEl) {
        itemCountEl.textContent = `${itemCount} 项目`;
    }
    
    if (selectedCountEl) {
        const selectedCount = managerState.selectedItems.size;
        selectedCountEl.textContent = selectedCount > 0 ? `已选择 ${selectedCount} 项` : '';
    }
}

// 面包屑更新
function updateBreadcrumb(path) {
    const breadcrumb = document.querySelector('#breadcrumb');
    if (!breadcrumb) return;
    
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

// 工具栏更新
function updateToolbar() {
    const backBtn = document.querySelector('#backBtn');
    if (backBtn) {
        backBtn.disabled = !managerState.currentPath;
    }
}

// 导航返回
function navigateBack() {
    if (!managerState.currentPath) return;
    
    const parts = managerState.currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    
    // 使用函数引用避免循环依赖
    if (loadDirectoryRef) {
        loadDirectoryRef(parentPath);
    }
}

// 提示消息
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
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 显示加载状态
function showLoading(show) {
    const loadingOverlay = document.querySelector('#loadingOverlay');
    if (!loadingOverlay) return; // 界面未渲染完成时直接返回，避免报错
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// 面包屑点击处理
function handleBreadcrumbClick(e) {
    const breadcrumbItem = e.target.closest('.breadcrumb-item');
    if (breadcrumbItem) {
        const path = breadcrumbItem.dataset.path;
        // 使用函数引用避免循环依赖
        if (loadDirectoryRef) {
            loadDirectoryRef(path);
        }
    }
}

// 键盘事件处理
function handleKeydown(e) {
    // 只在管理器获得焦点时处理键盘事件
    const workflowManager = document.querySelector('.workflow-manager');
    if (!workflowManager || !workflowManager.contains(e.target)) return;
    
    // 排除搜索输入框，让它自己处理键盘事件
    if (e.target.id === 'searchInput' || e.target.classList.contains('search-input')) {
        return; // 搜索输入框自己处理键盘事件，不要干扰
    }
    
    if (e.key === 'F2' && managerState.selectedItems.size === 1) {
        // F2 重命名
        e.preventDefault();
        const path = Array.from(managerState.selectedItems)[0];
        // 触发自定义事件，让其他模块处理
        window.dispatchEvent(new CustomEvent('workflowManager:rename', { detail: { path } }));
    } else if (e.key === 'Delete' && managerState.selectedItems.size > 0) {
        // Delete 删除
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('workflowManager:delete'));
    } else if (e.key === 'Enter' && managerState.selectedItems.size === 1) {
        // Enter 打开
        e.preventDefault();
        const path = Array.from(managerState.selectedItems)[0];
        const item = document.querySelector(`[data-path="${path}"]`);
        const type = item?.dataset.type;
        
        if (type === 'directory') {
            if (loadDirectoryRef) {
                loadDirectoryRef(path);
            }
        } else if (type === 'workflow') {
            window.dispatchEvent(new CustomEvent('workflowManager:loadWorkflow', { detail: { path } }));
        }
    } else if (e.key === 'Backspace') {
        // Backspace 返回上级 (但不干扰搜索输入框)
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
                    window.dispatchEvent(new CustomEvent('workflowManager:contextAction', { detail: { action: 'copy' } }));
                }
                break;
            case 'x':
                // Ctrl+X 剪切
                if (managerState.selectedItems.size > 0) {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('workflowManager:contextAction', { detail: { action: 'cut' } }));
                }
                break;
            case 'v':
                // Ctrl+V 粘贴
                if (managerState.clipboardItem && managerState.clipboardItem.length > 0) {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('workflowManager:contextAction', { detail: { action: 'paste' } }));
                }
                break;
            case 'n':
                // Ctrl+N 新建文件夹
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('workflowManager:createFolder'));
                break;
        }
    }
}

// 检查是否是子目录
function isSubDirectory(parentPath, childPaths) {
    // 检查是否试图将文件夹拖拽到其子目录
    return childPaths.some(childPath => {
        return parentPath.startsWith(childPath + '/') || parentPath === childPath;
    });
}

// 创建拖拽图像
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

// 导出所有函数和状态
export {
    PLUGIN_NAME,
    managerState,
    isLoading,
    setLoadDirectoryRef,
    formatFileSize,
    formatDate,
    sortItems,
    filterItems,
    clearSelection,
    addSelection,
    toggleSelection,
    selectAll,
    updateStatusBar,
    updateBreadcrumb,
    updateToolbar,
    navigateBack,
    showToast,
    showLoading,
    handleBreadcrumbClick,
    handleKeydown,
    isSubDirectory,
    createDragImage
}; 