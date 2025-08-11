// js/workflow_ui.js
// UI界面创建、样式定义和事件处理

import { 
    PLUGIN_NAME,
    managerState,
    filterItems,
    clearSelection,
    addSelection,
    toggleSelection,
    selectAll,
    showToast,
    handleBreadcrumbClick,
    handleKeydown
} from './workflow_utils.js';

import {
    loadDirectory,
    loadWorkflow,
    showCreateFolderDialog,
    handleContextAction,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
} from './workflow_api.js';

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
    
    // 简化：界面创建完成
    console.log(`${PLUGIN_NAME}: Interface created successfully`);
}

// 添加管理器样式
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
        
        /* 子文件夹拖拽增强样式 */
        .file-item.child-item.drop-zone {
            border-left: 3px solid #007acc !important;
            background: rgba(0, 122, 204, 0.15) !important;
            transform: translateX(2px);
            transition: all 0.2s ease;
        }
        
        .file-item.child-item.drop-zone::after {
            content: "移动到此文件夹";
            left: 60%;
            font-size: 9px;
        }
        
        /* 列表视图样式 */
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
        
        /* 列表视图下文件夹的特殊样式 */
        .file-grid.list-view .file-item[data-type="directory"] {
            cursor: pointer;
            position: relative;
        }
        
        .file-grid.list-view .file-item[data-type="directory"]:hover {
            background: rgba(0, 122, 204, 0.1);
            border-left: 3px solid #007acc;
        }
        
        .file-grid.list-view .file-item[data-type="directory"]:active {
            background: rgba(0, 122, 204, 0.2);
            transform: translateX(1px);
        }
        
        /* 文件夹展开/折叠样式 */
        .folder-expand-icon {
            font-size: 12px;
            margin-right: 8px;
            cursor: pointer;
            color: var(--descrip-text, #999);
            transition: transform 0.2s ease, color 0.2s ease;
            padding: 2px;
            border-radius: 2px;
        }
        
        .folder-expand-icon:hover {
            color: var(--input-text, #ffffff);
            background: rgba(255, 255, 255, 0.1);
        }
        
        .folder-expand-icon.pi-chevron-down {
            transform: rotate(0deg);
        }
        
        .folder-expand-icon.pi-chevron-right {
            transform: rotate(0deg);
        }
        
        /* 子项目容器 */
        .folder-children {
            background: rgba(0, 0, 0, 0.1);
            border-left: 2px solid var(--border-color, #444);
            margin-left: 20px;
            animation: slideDown 0.2s ease-out;
        }
        
        /* 子项目样式 */
        .file-item.child-item {
            padding-left: 20px;
            background: rgba(0, 0, 0, 0.05);
            border-left: 1px solid var(--border-color, #333);
        }
        
        .file-item.child-item:hover {
            background: rgba(0, 0, 0, 0.1);
        }
        
        .file-item.child-item .folder-expand-icon {
            margin-left: 8px;
        }
        
        /* 展开动画 */
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
                max-height: 0;
            }
            to {
                opacity: 1;
                transform: translateY(0);
                max-height: 1000px;
            }
        }
        
        /* 网格视图下隐藏展开图标 */
        .file-grid:not(.list-view) .folder-expand-icon {
            display: none;
        }
        
        /* 排序菜单样式 */
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
    `;
    document.head.appendChild(style);
}

// 绑定管理器事件
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
            // 确保退格键能正常工作
            console.log(`${PLUGIN_NAME}: Backspace key pressed in search input`);
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
    
    // 确保输入框能获得焦点
    searchInput.addEventListener('focus', (e) => {
        console.log(`${PLUGIN_NAME}: Search input focused`);
    });
    
    searchInput.addEventListener('blur', (e) => {
        console.log(`${PLUGIN_NAME}: Search input blurred`);
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

// 导航返回
function navigateBack() {
    if (!managerState.currentPath) return;
    
    const parts = managerState.currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    
    loadDirectory(parentPath);
}

// 文件网格点击事件处理
function handleFileGridClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) {
        // 点击空白区域，清除选择
        clearSelection();
        return;
    }
    
    const path = fileItem.dataset.path;
    const type = fileItem.dataset.type;
    
    // 如果是文件夹且在列表视图下，点击行时展开/折叠
    if (type === 'directory' && fileItem.closest('.file-grid')?.classList.contains('list-view')) {
        // 检查是否点击的是展开图标
        const isExpandIcon = e.target.closest('.folder-expand-icon');
        
        if (!isExpandIcon) {
            // 点击的是文件夹行（不是展开图标），触发展开/折叠
            // 使用自定义事件来避免循环依赖
            window.dispatchEvent(new CustomEvent('workflowManager:toggleFolder', {
                detail: { path: path }
            }));
            return; // 不执行选择逻辑
        }
    }
    
    if (e.ctrlKey || e.metaKey) {
        // 多选
        toggleSelection(path);
    } else {
        // 单选
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
        loadDirectory(path);
    } else if (type === 'workflow') {
        loadWorkflow(path);
    }
}

// 右键菜单处理
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
    } else {
        // 切换到列表视图
        fileGrid.classList.add('list-view');
        icon.className = 'pi pi-list';
        showToast('切换到列表视图');
        
        // 重新渲染以添加展开图标
        setTimeout(() => {
            loadDirectory(managerState.currentPath);
        }, 10);
    }
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
            
            // 重新渲染（这里需要从API文件导入renderFileGrid函数）
            // 由于循环依赖问题，这里暂时通过事件方式触发重新加载
            loadDirectory(managerState.currentPath);
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

// 导出函数
export {
    createManagerInterface,
    addManagerStyles,
    bindManagerEvents,
    toggleView,
    showSortMenu,
    hideContextMenu
}; 