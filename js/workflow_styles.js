// js/workflow_styles.js
// 样式定义和UI组件

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
            background: var(--comfy-input-bg, #2d2d2d);
            color: var(--input-text, #ffffff);
            font-size: 12px;
            position: relative; /* 为了支持拖拽样式 */
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
            display: none;
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
            background: var(--comfy-input-bg, #2d2d2d);
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
            background: var(--comfy-input-bg, #2d2d2d);
            height: 100%;
            min-height: 100%;
        }
        
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--comfy-input-bg, #2d2d2d);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            z-index: 100;
        }
        
        .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
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
            padding: 8px;
            background: var(--comfy-input-bg, #2d2d2d);
        }
        
        .file-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 4px 6px;
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
            font-size: 48px;
            margin-bottom: 6px;
            color: #007acc;
        }
        
        .file-icon.folder {
            color: #ffa500;
        }
        
        .file-icon.workflow {
            color: #28a745;
        }
        
        /* 预览图相关样式 */
        .file-icon-container {
            position: relative;
            width: 32px;
            height: 32px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* 网格视图下的预览图容器样式 */
        .file-grid:not(.list-view) .file-icon-container {
            width: 120px;
            height: 120px;
        }
        
        .file-grid:not(.list-view) .preview-placeholder {
            width: 120px;
            height: 120px;
        }
        
        /* 列表视图下的图标容器样式 - 固定大小，不受预览图影响 */
        .file-grid.list-view .file-icon-container {
            width: 24px !important;
            height: 24px !important;
        }
        
        .file-grid.list-view .preview-placeholder {
            display: none !important;
        }
        
        .file-grid.list-view .file-icon {
            font-size: 20px;
            margin-bottom: 0;
            margin-right: 12px;
        }
        
        .preview-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background: rgba(0, 122, 204, 0.1);
            border: 1px solid rgba(0, 122, 204, 0.3);
            border-radius: 4px;
        }
        
        .preview-loading::after {
            content: '';
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        .preview-error {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            border-radius: 4px;
            color: #dc3545;
            font-size: 10px;
            text-align: center;
        }
        
        /* 优化预览图显示效果 */
        .preview-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 4px;
            overflow: visible; /* 改为visible，让图片可以完整显示 */
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* 确保预览图在容器内居中且完整显示 */
        .preview-placeholder img {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            object-position: center;
            border-radius: 4px;
            transform-origin: center;
        }
        
        .file-name {
            text-align: center;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.3;
            max-width: 100%;
            font-weight: 500;
        }
        
        .file-meta {
            font-size: 11px;
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
            background: var(--comfy-input-bg, #2d2d2d);
        }
        
        .empty-state i {
            font-size: 48px;
            opacity: 0.5;
        }
        
        .empty-hint {
            font-size: 11px;
            color: var(--descrip-text, #666);
            margin: 0;
            text-align: center;
            opacity: 0.8;
        }
        
        /* 空文件夹拖拽区域样式 */
        .empty-state.drop-zone {
            border: 2px dashed #007acc;
            background: rgba(0, 122, 204, 0.1);
            border-radius: 8px;
            position: relative;
        }
        
        .empty-state.drop-zone::after {
            content: "拖拽工作流到此处";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 122, 204, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10;
            white-space: nowrap;
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
        
        .author-btn {
            background: transparent;
            border: none;
            color: var(--descrip-text, #999);
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
            font-size: 10px;
            margin-left: 8px;
            transition: all 0.2s ease;
            opacity: 0.7;
        }
        
        .author-btn:hover {
            background: rgba(0, 122, 204, 0.1);
            color: #007acc;
            opacity: 1;
            transform: scale(1.05);
        }
        
        .status-right {
            display: flex;
            align-items: center;
        }
        
        .context-menu {
            position: fixed;
            background: var(--comfy-menu-bg, #1e1e1e);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            padding: 4px 0;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 150px;
            max-width: 250px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 11px;
            color: var(--input-text, #ffffff);
            min-height: 20px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .menu-item:hover {
            background: var(--comfy-input-bg, #2d2d2d);
        }
        
        .menu-item:active {
            background: rgba(0, 122, 204, 0.2);
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
        
        /* 工作流管理器容器拖拽样式 */
        .workflow-manager.drop-zone {
            border: 2px dashed #007acc !important;
            background: rgba(0, 122, 204, 0.05) !important;
            position: relative;
        }
        
        .workflow-manager.drop-zone::after {
            content: "拖放到当前目录";
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 122, 204, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 11px;
            z-index: 1000;
            pointer-events: none;
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
            gap: 0px;
        }
        
        .file-grid.list-view .file-item {
            flex-direction: row;
            justify-content: flex-start;
            padding: 3px 12px;
            text-align: left;
            min-height: 28px;
        }
        
        .file-grid.list-view .file-name {
            text-align: left;
            flex: 1;
            margin: 0;
            font-size: 14px;
            line-height: 1.2;
            font-weight: 500;
        }
        
        .file-grid.list-view .file-meta {
            margin-top: 0;
            margin-left: auto;
            font-size: 11px;
            line-height: 1.2;
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
        
        /* 文件夹展开/折叠样式 - 完全隐藏 */
        .folder-expand-icon {
            display: none !important;
        }
        
        /* 子项目容器 - 移除T字形状，只保留简单竖线 */
        .folder-children {
            background: transparent;
            border-left: 1px solid var(--border-color, #444);
            margin-left: 12px;
            padding-left: 0;
        }
        
        /* 子项目样式 - 添加左侧竖线指示层级 */
        .file-item.child-item {
            padding-left: 32px;
            background: transparent;
            border: 2px solid transparent; /* 和主目录文件保持一致的边框 */
            border-left: 3px solid var(--border-color, #444); /* 保持层级指示线 */
            margin-left: 16px;
            min-height: 28px;
            position: relative;
            padding-top: 2px;
            padding-bottom: 2px;
        }
        
        /* 子项目选中状态 - 更高优先级 */
        .file-item.child-item.selected {
            border: 2px solid #007acc !important;
            border-left: 3px solid #007acc !important;
            background: rgba(0, 122, 204, 0.15) !important;
            border-radius: 4px;
        }
        
        .file-item.child-item:hover {
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        
        /* 子项目悬停时不覆盖选中状态 */
        .file-item.child-item:hover:not(.selected) {
            background: var(--comfy-menu-bg, #1e1e1e);
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

// 检查是否是子目录
function isSubDirectory(parentPath, childPaths) {
    // 检查是否试图将文件夹拖拽到其子目录
    return childPaths.some(childPath => {
        return parentPath.startsWith(childPath + '/') || parentPath === childPath;
    });
}

// 导出函数
export {
    addManagerStyles,
    createDragImage,
    isSubDirectory
}; 