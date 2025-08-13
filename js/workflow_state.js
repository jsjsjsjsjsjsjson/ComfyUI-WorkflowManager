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
    expandedFolders: new Set(), // 已展开的文件夹路径
    previewMode: false, // 预览图模式开关
    imageCache: new Map() // 图片缓存
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

// 预览图相关函数
async function loadWorkflowPreview(path) {
    // 检查缓存
    if (managerState.imageCache.has(path)) {
        return managerState.imageCache.get(path);
    }
    
    try {
        // 首先测试API是否正常工作
        const apiWorking = await testPreviewAPI(path);
        if (!apiWorking) {
            console.error(`${PLUGIN_NAME}: Preview API is not working for: ${path}`);
            return null;
        }
        
        // 构建预览图URL - 使用时间戳避免缓存
        const timestamp = Date.now();
        const previewUrl = `/workflow-manager/preview?path=${encodeURIComponent(path)}&t=${timestamp}`;
        
        // 创建图片对象
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                // 缓存成功加载的图片
                managerState.imageCache.set(path, img);
                resolve(img);
            };
            
            img.onerror = (error) => {
                // 加载失败时返回null，降级到默认图标
                console.error(`${PLUGIN_NAME}: Preview load failed for: ${path}`);
                console.error(`${PLUGIN_NAME}: Error details:`, error);
                console.error(`${PLUGIN_NAME}: Image src: ${img.src}`);
                console.error(`${PLUGIN_NAME}: Image naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}`);
                resolve(null);
            };
            
            // 设置跨域属性
            img.crossOrigin = 'anonymous';
            
            // 设置图片源
            img.src = previewUrl;
            
            // 设置超时处理
            setTimeout(() => {
                if (!img.complete) {
                    console.warn(`${PLUGIN_NAME}: Preview load timeout for: ${path}`);
                    resolve(null);
                }
            }, 5000); // 5秒超时
        });
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Error loading preview for ${path}:`, error);
        return null;
    }
}

// 懒加载预览图（只加载可视区域内的图片）
function loadVisiblePreviews() {
    if (!managerState.previewMode) return;
    
    const workflowItems = document.querySelectorAll('.file-item[data-type="workflow"]');
    const viewportHeight = window.innerHeight;
    
    workflowItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const isVisible = rect.top < viewportHeight && rect.bottom > 0;
        
        if (isVisible) {
            const path = item.dataset.path;
            const previewPlaceholder = item.querySelector('.preview-placeholder');
            const iconElement = item.querySelector('.file-icon');
            
            if (previewPlaceholder && iconElement && !previewPlaceholder.hasChildNodes()) {
                loadWorkflowPreview(path).then(previewImg => {
                    if (previewImg) {
                        iconElement.style.display = 'none';
                        previewPlaceholder.style.display = 'block';
                        previewPlaceholder.innerHTML = '';
                        previewPlaceholder.appendChild(previewImg);
                        
                        // 添加预览图样式
                        previewImg.style.cssText = `
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                            border-radius: 4px;
                            background: var(--comfy-input-bg, #2d2d2d);
                        `;
                    }
                });
            }
        }
    });
}

// 预加载附近的预览图
function preloadNearbyPreviews() {
    if (!managerState.previewMode) return;
    
    const workflowItems = document.querySelectorAll('.file-item[data-type="workflow"]');
    const viewportHeight = window.innerHeight;
    const preloadDistance = viewportHeight * 2; // 预加载2倍视口高度的内容
    
    workflowItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const isNearby = rect.top < preloadDistance && rect.bottom > -preloadDistance;
        
        if (isNearby) {
            const path = item.dataset.path;
            if (!managerState.imageCache.has(path)) {
                // 预加载但不显示
                loadWorkflowPreview(path);
            }
        }
    });
}

// 清除图片缓存
function clearImageCache() {
    managerState.imageCache.clear();
}

// 获取预览图路径
function getPreviewPath(workflowPath) {
    // 将.json替换为.webp
    return workflowPath.replace(/\.json$/i, '.webp');
}

// 测试预览图API是否正常工作
async function testPreviewAPI(path) {
    try {
        const timestamp = Date.now();
        const previewUrl = `/workflow-manager/preview?path=${encodeURIComponent(path)}&t=${timestamp}`;
        
        const response = await fetch(previewUrl);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.startsWith('image/')) {
                return true;
            } else {
                console.error(`${PLUGIN_NAME}: ❌ API returned wrong content type:`, contentType);
                return false;
            }
        } else {
            console.error(`${PLUGIN_NAME}: ❌ API returned error status:`, response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error(`${PLUGIN_NAME}: ❌ Preview API test failed:`, error);
        return false;
    }
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
    showLoading,
    loadWorkflowPreview,
    loadVisiblePreviews,
    preloadNearbyPreviews,
    clearImageCache,
    getPreviewPath,
    testPreviewAPI
}; 