// js/workflow_ui.js
// UI界面创建和基础事件处理

import { 
    PLUGIN_NAME,
    managerState,
    filterItems,
    clearSelection,
    addSelection,
    toggleSelection,
    selectAll,
    showToast
} from './workflow_state.js';

import { addManagerStyles } from './workflow_styles.js';

import { 
    showCreateFolderDialog,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleContextAction
} from './workflow_operations.js';

// 存储loadDirectory函数引用
let loadDirectoryRef = null;

// 设置loadDirectory函数引用
function setLoadDirectoryRef(loadDirectoryFunc) {
    loadDirectoryRef = loadDirectoryFunc;
}

// 创建管理器界面
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
                        <i class="pi pi-list"></i>
                    </button>
                    <button id="previewToggleBtn" class="toolbar-btn" title="预览图模式">
                        <i class="pi pi-image"></i>
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
                
                <div class="file-grid list-view" id="fileGrid">
                    <!-- 动态生成文件和文件夹 -->
                </div>
                
                <div class="empty-state" id="emptyState" style="display: none;">
                    <i class="pi pi-folder-open"></i>
                    <p>此文件夹为空</p>
                    <p class="empty-hint">右键点击空白处可以粘贴工作流</p>
                </div>
            </div>
            
            <!-- 状态栏 -->
            <div class="status-bar">
                <div class="status-left">
                    <span id="itemCount">0 项目</span>
                </div>
                <div class="status-right">
                    <span id="selectedCount"></span>
                    <button id="authorBtn" class="author-btn" title="关于作者">
                        <i class="pi pi-info-circle"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- 右键菜单 -->
        <div class="context-menu" id="contextMenu">
            <div class="menu-item" data-action="open">
                <i class="pi pi-folder-open"></i> 打开
            </div>
            <div class="menu-item" data-action="refresh-preview" style="display: none;">
                <i class="pi pi-refresh"></i> 刷新预览图
            </div>
            <div class="menu-item" data-action="change-preview" style="display: none;">
                <i class="pi pi-image"></i> 更换预览图
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
}

// 绑定管理器事件
function bindManagerEvents(container) {
    // 工具栏按钮事件
    container.querySelector('#backBtn').addEventListener('click', navigateBack);
    container.querySelector('#refreshBtn').addEventListener('click', () => {
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    });
    container.querySelector('#homeBtn').addEventListener('click', () => {
        if (loadDirectoryRef) {
            loadDirectoryRef('');
        }
    });
    container.querySelector('#newFolderBtn').addEventListener('click', showCreateFolderDialog);
    container.querySelector('#viewToggleBtn').addEventListener('click', toggleView);
    container.querySelector('#previewToggleBtn').addEventListener('click', togglePreviewMode);
    container.querySelector('#sortBtn').addEventListener('click', showSortMenu);
    
    // 搜索功能
    const searchInput = container.querySelector('#searchInput');
    let searchTimeout;
    
    // 输入事件处理
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterItems(e.target.value);
        }, 300);
    });
    
    // 键盘事件处理 - 确保退格键等按键能正常工作
    searchInput.addEventListener('keydown', (e) => {
        // 允许所有标准键盘操作
        e.stopPropagation(); // 防止事件被其他处理器拦截
        
        // 特别处理退格键
        if (e.key === 'Backspace') {
            // console.log(`${PLUGIN_NAME}: Backspace key pressed in search input`);
        }
        
        // 处理Enter键 - 立即执行搜索
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            filterItems(e.target.value);
        }
        
        // 处理Escape键 - 清空搜索
        if (e.key === 'Escape') {
            e.target.value = '';
            filterItems('');
        }
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
    
    // 面包屑导航事件
    container.querySelector('#breadcrumb').addEventListener('click', handleBreadcrumbClick);
    
    // 作者信息按钮事件
    container.querySelector('#authorBtn').addEventListener('click', showAuthorInfo);
    
    // 添加滚动事件监听，实现预览图懒加载
    const managerContent = container.querySelector('#managerContent');
    if (managerContent) {
        let scrollTimeout;
        managerContent.addEventListener('scroll', () => {
            // 防抖处理
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (managerState.previewMode) {
                    // 动态导入懒加载函数
                    import('./workflow_state.js').then(({ loadVisiblePreviews, preloadNearbyPreviews }) => {
                        loadVisiblePreviews();
                        preloadNearbyPreviews();
                    });
                }
            }, 100);
        });
    }

    // 空文件夹区域右键菜单事件
    const emptyState = container.querySelector('#emptyState');
    if (emptyState) {
        emptyState.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const contextMenu = document.querySelector('#contextMenu');
            if (contextMenu) {
                contextMenu.style.display = 'block';
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
                contextMenu.querySelectorAll('.menu-item').forEach(item => {
                    item.onclick = () => {
                        const action = item.dataset.action;
                        handleContextAction(action);
                        hideContextMenu();
                    };
                });
            }
        });
        
        // 为空文件夹区域添加拖拽支持
        emptyState.addEventListener('dragover', (e) => {
            e.preventDefault();
            emptyState.classList.add('drop-zone');
            e.dataTransfer.dropEffect = 'copy';
        });
        
        emptyState.addEventListener('dragleave', (e) => {
            e.preventDefault();
            emptyState.classList.remove('drop-zone');
        });
        
        emptyState.addEventListener('drop', (e) => {
            e.preventDefault();
            emptyState.classList.remove('drop-zone');
            
            // 处理拖拽的工作流文件
            const draggedItems = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
            if (draggedItems.length > 0) {
                // 触发粘贴操作
                window.dispatchEvent(new CustomEvent('workflowManager:contextAction', { 
                    detail: { action: 'paste' } 
                }));
            }
        });
    }
}

// 导航返回
function navigateBack() {
    if (!managerState.currentPath) return;
    
    const parts = managerState.currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    
    if (loadDirectoryRef) {
        loadDirectoryRef(parentPath);
    }
}

// 面包屑点击处理
function handleBreadcrumbClick(e) {
    const breadcrumbItem = e.target.closest('.breadcrumb-item');
    if (breadcrumbItem && loadDirectoryRef) {
        const path = breadcrumbItem.dataset.path;
        loadDirectoryRef(path);
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

// 文件网格点击事件处理
function handleFileGridClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) {
        clearSelection();
        return;
    }
    
    const path = fileItem.dataset.path;
    const type = fileItem.dataset.type;
    
    // 如果是文件夹且在列表视图下，点击行时展开/折叠
    if (type === 'directory' && fileItem.closest('.file-grid')?.classList.contains('list-view')) {
        const isExpandIcon = e.target.closest('.folder-expand-icon');
        
        if (!isExpandIcon) {
            // 点击的是文件夹行（不是展开图标），触发展开/折叠
            window.dispatchEvent(new CustomEvent('workflowManager:toggleFolder', {
                detail: { path: path }
            }));
            return; // 不执行选择逻辑
        }
    }
    
    if (e.ctrlKey || e.metaKey) {
        toggleSelection(path);
    } else {
        clearSelection();
        addSelection(path);
    }
}

// 文件网格双击事件处理
function handleFileGridDoubleClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;
    
    const path = fileItem.dataset.path;
    const type = fileItem.dataset.type;
    
    if (type === 'directory') {
        if (loadDirectoryRef) {
            loadDirectoryRef(path);
        }
    } else if (type === 'workflow') {
        // 只允许双击.json文件
        if (path.toLowerCase().endsWith('.json')) {
            window.dispatchEvent(new CustomEvent('workflowManager:loadWorkflow', { detail: { path } }));
        } else {
            showToast('只能双击.json文件来加载工作流', 'warning');
        }
    }
}

// 右键菜单处理
function handleContextMenu(e) {
    e.preventDefault();
    
    const fileItem = e.target.closest('.file-item');
    const emptyState = e.target.closest('#emptyState');
    const contextMenu = document.querySelector('#contextMenu');
    const fileGrid = document.querySelector('#fileGrid'); // 获取文件网格元素
    
    if (fileItem) {
        const path = fileItem.dataset.path;
        const type = fileItem.dataset.type;
        
        if (!managerState.selectedItems.has(path)) {
            clearSelection();
            addSelection(path);
        }
        
        // 根据文件类型调整右键菜单
        const openMenuItem = contextMenu.querySelector('[data-action="open"]');
        const refreshPreviewMenuItem = contextMenu.querySelector('[data-action="refresh-preview"]');
        const changePreviewMenuItem = contextMenu.querySelector('[data-action="change-preview"]');
        
        if (openMenuItem) {
            if (type === 'directory') {
                openMenuItem.innerHTML = '<i class="pi pi-folder-open"></i> 打开';
                openMenuItem.style.display = 'block';
            } else if (type === 'workflow' && path.toLowerCase().endsWith('.json')) {
                openMenuItem.innerHTML = '<i class="pi pi-folder-open"></i> 打开';
                openMenuItem.style.display = 'block';
            } else {
                // 非.json文件不显示"打开"选项
                openMenuItem.style.display = 'none';
            }
        }
        
        // 刷新预览图选项 - 只对工作流文件且在预览模式下显示
        if (refreshPreviewMenuItem) {
            if (type === 'workflow' && path.toLowerCase().endsWith('.json') && managerState.previewMode && !fileGrid.classList.contains('list-view')) {
                refreshPreviewMenuItem.style.display = 'block';
            } else {
                refreshPreviewMenuItem.style.display = 'none';
            }
        }
        
        // 更换预览图选项 - 只对工作流文件且在预览模式下显示
        if (changePreviewMenuItem) {
            if (type === 'workflow' && path.toLowerCase().endsWith('.json') && managerState.previewMode && !fileGrid.classList.contains('list-view')) {
                changePreviewMenuItem.style.display = 'block';
            } else {
                changePreviewMenuItem.style.display = 'none';
            }
        }
        
        // 显示所有菜单项
        contextMenu.querySelectorAll('.menu-item').forEach(item => {
            item.style.display = 'block';
        });
        
    } else if (emptyState) {
        // 空文件夹区域右键菜单
        clearSelection();
        
        // 只显示相关选项
        const openMenuItem = contextMenu.querySelector('[data-action="open"]');
        const refreshPreviewMenuItem = contextMenu.querySelector('[data-action="refresh-preview"]');
        const changePreviewMenuItem = contextMenu.querySelector('[data-action="change-preview"]');
        const renameMenuItem = contextMenu.querySelector('[data-action="rename"]');
        const cutMenuItem = contextMenu.querySelector('[data-action="cut"]');
        const copyMenuItem = contextMenu.querySelector('[data-action="copy"]');
        const deleteMenuItem = contextMenu.querySelector('[data-action="delete"]');
        const propertiesMenuItem = contextMenu.querySelector('[data-action="properties"]');
        
        // 隐藏不相关的选项
        if (openMenuItem) openMenuItem.style.display = 'none';
        if (refreshPreviewMenuItem) refreshPreviewMenuItem.style.display = 'none';
        if (changePreviewMenuItem) refreshPreviewMenuItem.style.display = 'none';
        if (renameMenuItem) renameMenuItem.style.display = 'none';
        if (cutMenuItem) cutMenuItem.style.display = 'none';
        if (copyMenuItem) copyMenuItem.style.display = 'none';
        if (deleteMenuItem) deleteMenuItem.style.display = 'none';
        if (propertiesMenuItem) propertiesMenuItem.style.display = 'none';
        
        // 只显示粘贴选项
        const pasteMenuItem = contextMenu.querySelector('[data-action="paste"]');
        if (pasteMenuItem) {
            pasteMenuItem.style.display = 'block';
            pasteMenuItem.innerHTML = '<i class="pi pi-clipboard"></i> 粘贴工作流';
        }
        
        // 添加新建文件夹选项
        const newFolderMenuItem = contextMenu.querySelector('[data-action="new-folder"]');
        if (!newFolderMenuItem) {
            const separator = document.createElement('div');
            separator.className = 'menu-separator';
            contextMenu.insertBefore(separator, contextMenu.firstChild);
            
            const newFolderItem = document.createElement('div');
            newFolderItem.className = 'menu-item';
            newFolderItem.dataset.action = 'new-folder';
            newFolderItem.innerHTML = '<i class="pi pi-folder-plus"></i> 新建文件夹';
            contextMenu.insertBefore(newFolderItem, separator.nextSibling);
        }
        
    } else {
        // 其他区域，隐藏所有菜单项
        contextMenu.querySelectorAll('.menu-item').forEach(item => {
            item.style.display = 'none';
        });
        return;
    }
    
    // 智能定位右键菜单，确保完全可见
    const menuPosition = calculateMenuPosition(e.pageX, e.pageY, contextMenu);
    
    // 显示右键菜单
    contextMenu.style.display = 'block';
    contextMenu.style.left = menuPosition.x + 'px';
    contextMenu.style.top = menuPosition.y + 'px';
    
    // 绑定菜单项事件
    contextMenu.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = () => {
            const action = item.dataset.action;
            handleContextAction(action);
            hideContextMenu();
        };
    });
}

// 智能计算菜单位置，确保菜单完全可见
function calculateMenuPosition(mouseX, mouseY, contextMenu) {
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = mouseX;
    let y = mouseY;
    
    // 检查右边界
    if (x + menuRect.width > viewportWidth) {
        x = viewportWidth - menuRect.width - 10; // 留10px边距
    }
    
    // 检查下边界
    if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 10; // 留10px边距
    }
    
    // 检查左边界
    if (x < 10) {
        x = 10;
    }
    
    // 检查上边界
    if (y < 10) {
        y = 10;
    }
    
    return { x, y };
}

// 隐藏右键菜单
function hideContextMenu() {
    const contextMenu = document.querySelector('#contextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

// 切换视图
function toggleView() {
    const fileGrid = document.querySelector('#fileGrid');
    const viewToggleBtn = document.querySelector('#viewToggleBtn');
    const icon = viewToggleBtn.querySelector('i');
    
    if (fileGrid.classList.contains('list-view')) {
        // 切换到网格视图
        fileGrid.classList.remove('list-view');
        icon.className = 'pi pi-th-large';
        showToast('切换到网格视图');
        
        // 清理展开状态
        clearExpandedState();
        
        // 如果开启了预览模式，重新加载预览图
        if (managerState.previewMode) {
            setTimeout(() => {
                if (loadDirectoryRef) {
                    loadDirectoryRef(managerState.currentPath);
                }
            }, 100);
        }
    } else {
        // 切换到列表视图
        fileGrid.classList.add('list-view');
        icon.className = 'pi pi-list';
        showToast('切换到列表视图');
        
        // 在列表模式下隐藏预览图，显示图标，并恢复列表视图样式
            const previewPlaceholders = document.querySelectorAll('.preview-placeholder');
            const fileIcons = document.querySelectorAll('.file-icon');
        const fileIconContainers = document.querySelectorAll('.file-icon-container');
            
            previewPlaceholders.forEach(placeholder => {
                placeholder.style.display = 'none';
            });
            
            fileIcons.forEach(icon => {
                icon.style.display = 'block';
            });
        
        // 恢复列表视图下的图标容器大小
        fileIconContainers.forEach(container => {
            container.style.width = '32px';
            container.style.height = '32px';
        });
        
        // 重新渲染以添加展开图标
        setTimeout(() => {
            if (loadDirectoryRef) {
                loadDirectoryRef(managerState.currentPath);
            }
        }, 10);
    }
}

// 切换预览模式
function togglePreviewMode() {
    const icon = document.querySelector('#previewToggleBtn i');
    const fileGrid = document.querySelector('#fileGrid');
    const isListView = fileGrid && fileGrid.classList.contains('list-view');
    
    if (managerState.previewMode) {
        // 关闭预览图模式
        managerState.previewMode = false;
        icon.className = 'pi pi-image';
        icon.style.color = '';
        showToast('已关闭预览图模式');
        
        // 清除所有预览图，恢复默认图标
        clearPreviews();
    } else {
        // 开启预览图模式
        if (isListView) {
            showToast('列表视图下不支持预览图，请先切换到网格视图', 'warning');
            return;
        }
        
        managerState.previewMode = true;
        icon.className = 'pi pi-image';
        icon.style.color = '#007acc';
        showToast('已开启预览图模式');
        
        // 重新渲染为预览图模式
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    }
}

// 清除所有预览图，恢复默认图标
function clearPreviews() {
    const previewPlaceholders = document.querySelectorAll('.preview-placeholder');
    const fileIcons = document.querySelectorAll('.file-icon');
    
    previewPlaceholders.forEach(placeholder => {
        placeholder.style.display = 'none';
        placeholder.innerHTML = '';
    });
    
    fileIcons.forEach(icon => {
        icon.style.display = 'block';
    });
}

// 清理展开状态
function clearExpandedState() {
    managerState.expandedFolders.clear();
    
    // 移除所有展开的子内容
    const childrenContainers = document.querySelectorAll('.folder-children');
    childrenContainers.forEach(container => container.remove());
}

// 显示排序菜单
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
            if (loadDirectoryRef) {
                loadDirectoryRef(managerState.currentPath);
            }
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

// 显示作者信息
function showAuthorInfo() {
    // 创建对话框覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'author-dialog-overlay';
    overlay.innerHTML = `
        <div class="author-dialog">
            <div class="author-header">
                <h3>关于作者</h3>
                <button class="dialog-close" onclick="this.closest('.author-dialog-overlay').remove()">×</button>
            </div>
            <div class="author-content">
                <div class="author-info">
                    <div class="author-avatar">
                        <i class="pi pi-user" style="font-size: 48px; color: #007acc;"></i>
                    </div>
                    <div class="author-details">
                        <h4>yicheng / 亦诚</h4>
                        <p class="author-desc">ComfyUI-WorkflowManager 工作流管理器插件开发者</p>
                        <div class="author-links">
                            <a href="https://github.com/yichengup/ComfyUI-WorkflowManager" target="_blank" class="github-link">
                                <i class="pi pi-github"></i>
                                GitHub 仓库
                            </a>
                        </div>
                    </div>
                </div>
                <div class="plugin-info">
                    <p>该插件提供了完整的工作流文件管理功能，包括文件浏览、创建、重命名、删除、移动、复制等操作。</p>
                    <p>支持拖拽操作和文件夹展开/折叠，让您的工作流管理更加便捷高效。</p>
                </div>
            </div>
            <div class="author-footer">
                <button class="btn-primary" onclick="this.closest('.author-dialog-overlay').remove()">关闭</button>
            </div>
        </div>
    `;
    
    // 添加样式
    if (!document.querySelector('#author-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'author-dialog-styles';
        style.textContent = `
            .author-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                animation: fadeIn 0.2s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .author-dialog {
                background: var(--comfy-menu-bg, #1e1e1e);
                border: 1px solid var(--border-color, #555);
                border-radius: 12px;
                min-width: 420px;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                animation: slideIn 0.3s ease-out;
            }
            
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .author-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px 16px;
                border-bottom: 1px solid var(--border-color, #444);
            }
            
            .author-header h3 {
                margin: 0;
                color: var(--input-text, #ffffff);
                font-size: 18px;
                font-weight: 600;
            }
            
            .author-content {
                padding: 24px;
            }
            
            .author-info {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .author-avatar {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 80px;
                height: 80px;
                background: rgba(0, 122, 204, 0.1);
                border-radius: 50%;
                border: 2px solid rgba(0, 122, 204, 0.3);
            }
            
            .author-details h4 {
                margin: 0 0 8px 0;
                color: var(--input-text, #ffffff);
                font-size: 16px;
                font-weight: 600;
            }
            
            .author-desc {
                margin: 0 0 16px 0;
                color: var(--descrip-text, #999);
                font-size: 12px;
                line-height: 1.4;
            }
            
            .author-links {
                display: flex;
                gap: 12px;
            }
            
            .github-link {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #24292e;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-size: 12px;
                transition: background 0.2s ease;
            }
            
            .github-link:hover {
                background: #34404a;
                text-decoration: none;
            }
            
            .plugin-info {
                padding: 16px;
                background: rgba(0, 122, 204, 0.05);
                border-radius: 8px;
                border-left: 3px solid #007acc;
            }
            
            .plugin-info p {
                margin: 0 0 8px 0;
                color: var(--input-text, #ffffff);
                font-size: 12px;
                line-height: 1.5;
            }
            
            .plugin-info p:last-child {
                margin-bottom: 0;
            }
            
            .author-footer {
                padding: 16px 24px 20px;
                display: flex;
                justify-content: flex-end;
            }
            
            .dialog-close {
                background: transparent;
                border: none;
                color: var(--descrip-text, #999);
                font-size: 20px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .dialog-close:hover {
                background: var(--comfy-input-bg, #2d2d2d);
                color: var(--input-text, #ffffff);
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
    
    // 点击覆盖层关闭对话框
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

// 初始化UI事件监听器
function initializeUIEventListeners() {
    // 添加全局键盘事件监听
    document.addEventListener('keydown', handleKeydown);
    
    // 监听来自其他模块的事件
    window.addEventListener('workflowManager:rename', (e) => {
        // 转发到operations模块
        window.dispatchEvent(new CustomEvent('workflowManager:showRenameDialog', { detail: e.detail }));
    });
    
    window.addEventListener('workflowManager:delete', () => {
        // 转发到operations模块
        window.dispatchEvent(new CustomEvent('workflowManager:deleteSelectedItems'));
    });
    
    window.addEventListener('workflowManager:contextAction', (e) => {
        handleContextAction(e.detail.action);
    });
    
    window.addEventListener('workflowManager:createFolder', () => {
        showCreateFolderDialog();
    });
}

// 导出函数
export {
    createManagerInterface,
    bindManagerEvents,
    setLoadDirectoryRef,
    toggleView,
    showSortMenu,
    hideContextMenu,
    handleKeydown,
    initializeUIEventListeners
}; 