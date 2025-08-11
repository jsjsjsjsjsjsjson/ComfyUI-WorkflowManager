// js/workflow_state.js
// 状态管理和工具函数

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

// UI更新函数
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

function updateToolbar() {
    const backBtn = document.querySelector('#backBtn');
    if (backBtn) {
        backBtn.disabled = !managerState.currentPath;
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
    showToast,
    showLoading
}; 