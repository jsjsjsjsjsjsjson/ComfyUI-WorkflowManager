// js/workflow_operations.js
// 文件操作和拖拽功能

import { api } from "../../../scripts/api.js";
import {
    PLUGIN_NAME,
    managerState,
    formatDate,
    sortItems,
    showToast,
    showLoading,
    clearSelection,
    addSelection,
    WORKFLOW_FILE_ICON_PATH
} from './workflow_state.js';

import { createDragImage, isSubDirectory } from './workflow_styles.js';

// API调用函数 (基础部分，重复使用)
const WorkflowAPI = {
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
    
    async rename(oldPath, newName, syncPreview = true) {
        try {
            const response = await api.fetchApi('/workflow-manager/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    old_path: oldPath, 
                    new_name: newName,
                    sync_preview: syncPreview && oldPath.toLowerCase().endsWith('.json')
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to rename:', error);
            return { success: false, error: error.message };
        }
    },
    
    async delete(path, syncPreview = true) {
        try {
            const response = await api.fetchApi('/workflow-manager/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    path,
                    sync_preview: syncPreview && path.toLowerCase().endsWith('.json')
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to delete:', error);
            return { success: false, error: error.message };
        }
    },
    
    async move(sourcePath, targetDir, syncPreview = true) {
        try {
            const response = await api.fetchApi('/workflow-manager/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    source_path: sourcePath, 
                    target_dir: targetDir,
                    sync_preview: syncPreview && sourcePath.toLowerCase().endsWith('.json')
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to move:', error);
            return { success: false, error: error.message };
        }
    },
    
    async copy(sourcePath, targetDir, syncPreview = true) {
        try {
            const response = await api.fetchApi('/workflow-manager/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    source_path: sourcePath, 
                    target_dir: targetDir,
                    sync_preview: syncPreview && sourcePath.toLowerCase().endsWith('.json')
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to copy:', error);
            return { success: false, error: error.message };
        }
    },

    async browse(path = '') {
        try {
            const response = await api.fetchApi(`/workflow-manager/browse?path=${encodeURIComponent(path)}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to browse:', error);
            return { success: false, error: error.message };
        }
    }
};

// 存储loadDirectory函数引用
let loadDirectoryRef = null;

// 设置loadDirectory函数引用
function setLoadDirectoryRef(loadDirectoryFunc) {
    loadDirectoryRef = loadDirectoryFunc;
}

// 文件操作功能
async function createFolder(name) {
    const result = await WorkflowAPI.createFolder(name, managerState.currentPath);
    
    if (result.success) {
        showToast('文件夹创建成功');
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    } else {
        showToast(`创建失败: ${result.error}`, 'error');
    }
}

function showCreateFolderDialog() {
    const name = prompt('请输入文件夹名称:');
    if (name && name.trim()) {
        createFolder(name.trim());
    }
}

async function renameItem(path, newName) {
    const result = await WorkflowAPI.rename(path, newName);
    
    if (result.success) {
        // 如果是JSON工作流文件，清除相关的预览图片缓存
        if (path.toLowerCase().endsWith('.json') && managerState.imageCache) {
            // 清除旧路径的缓存
            managerState.imageCache.delete(path);
            
            // 清除可能的新路径缓存
            const pathParts = path.split('/');
            pathParts[pathParts.length - 1] = newName + (newName.endsWith('.json') ? '' : '.json');
            const newPath = pathParts.join('/');
            managerState.imageCache.delete(newPath);
        }
        
        showToast('重命名成功');
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    } else {
        showToast(`重命名失败: ${result.error}`, 'error');
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
            
            // 如果是JSON工作流文件，清除相关的预览图片缓存
            if (path.toLowerCase().endsWith('.json') && managerState.imageCache) {
                managerState.imageCache.delete(path);
            }
        } else {
            errorCount++;
            console.error(`Failed to delete ${path}:`, result.error);
        }
    }
    
    if (successCount > 0) {
        showToast(`成功删除 ${successCount} 项${errorCount > 0 ? `，失败 ${errorCount} 项` : ''}`);
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    } else {
        showToast('删除失败', 'error');
    }
}

async function pasteItems() {
    if (!managerState.clipboardItem || managerState.clipboardItem.length === 0) return;
    
    // 确定目标目录：如果有选中的文件夹，粘贴到该文件夹；否则粘贴到当前目录
    let targetDir = managerState.currentPath;
    const selectedPaths = Array.from(managerState.selectedItems);
    
    // 如果只选中了一个项目且是文件夹，则粘贴到该文件夹
    if (selectedPaths.length === 1) {
        const selectedItem = document.querySelector(`[data-path="${selectedPaths[0]}"]`);
        if (selectedItem && selectedItem.dataset.type === 'directory') {
            targetDir = selectedPaths[0];
        }
    }
    
    const operation = managerState.clipboardOperation;
    
    let successCount = 0;
    let errorCount = 0;
    
    // 显示加载状态
    showLoading(true);
    
    try {
        for (const sourcePath of managerState.clipboardItem) {
            let result;
            
            if (operation === 'cut') {
                result = await WorkflowAPI.move(sourcePath, targetDir);
            } else {
                result = await WorkflowAPI.copy(sourcePath, targetDir);
            }
            
            if (result.success) {
                successCount++;
                
                // 如果是JSON工作流文件，清除相关的预览图片缓存
                if (sourcePath.toLowerCase().endsWith('.json') && managerState.imageCache) {
                    // 清除源文件的缓存
                    managerState.imageCache.delete(sourcePath);
                    
                    // 如果是移动操作，还需要清除可能的新路径缓存
                    if (operation === 'cut') {
                        const fileName = sourcePath.split('/').pop();
                        const newPath = targetDir ? `${targetDir}/${fileName}` : fileName;
                        managerState.imageCache.delete(newPath);
                    }
                }
            } else {
                errorCount++;
                console.error(`Failed to ${operation} ${sourcePath}:`, result.error);
            }
        }
        
        if (successCount > 0) {
            const actionText = operation === 'cut' ? '移动' : '复制';
            const targetText = targetDir === managerState.currentPath ? '当前目录' : `文件夹 "${targetDir.split('/').pop()}"`;
            showToast(`成功${actionText} ${successCount} 项到${targetText}${errorCount > 0 ? `，失败 ${errorCount} 项` : ''}`);
            
            // 清空剪贴板（仅剪切操作）
            if (operation === 'cut') {
                managerState.clipboardItem = null;
                managerState.clipboardOperation = null;
            }
            
            // 刷新当前目录
            if (loadDirectoryRef) {
                await loadDirectoryRef(managerState.currentPath);
            }
        } else {
            showToast(`${operation === 'cut' ? '移动' : '复制'}失败`, 'error');
        }
    } catch (error) {
        console.error('Paste operation failed:', error);
        showToast(`粘贴失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 右键菜单操作
function handleContextAction(action) {
    const selectedPaths = Array.from(managerState.selectedItems);
    
    switch (action) {
        case 'open':
            if (selectedPaths.length === 1) {
                const item = document.querySelector(`[data-path="${selectedPaths[0]}"]`);
                const type = item?.dataset.type;
                if (type === 'directory') {
                    if (loadDirectoryRef) {
                        loadDirectoryRef(selectedPaths[0]);
                    }
                } else if (type === 'workflow') {
                    // 使用自定义事件触发工作流加载
                    window.dispatchEvent(new CustomEvent('workflowManager:loadWorkflow', { 
                        detail: { path: selectedPaths[0] } 
                    }));
                }
            }
            break;
            
        case 'refresh-preview':
            if (selectedPaths.length > 0) {
                const workflowPaths = selectedPaths.filter(path => path.toLowerCase().endsWith('.json'));
                if (workflowPaths.length > 0) {
                    showToast(`正在刷新 ${workflowPaths.length} 个工作流预览图...`, 'info');
                    workflowPaths.forEach(path => refreshWorkflowPreview(path));
                } else {
                    showToast('请选择工作流文件', 'warning');
                }
            }
            break;
            
        case 'change-preview':
            if (selectedPaths.length === 1) {
                const selectedPath = selectedPaths[0];
                if (selectedPath.toLowerCase().endsWith('.json')) {
                    changeWorkflowPreview(selectedPath);
                } else {
                    showToast('请选择工作流文件', 'warning');
                }
            } else if (selectedPaths.length > 1) {
                showToast('更换预览图只能选择单个工作流文件', 'warning');
            }
            break;
            
        case 'rename':
            if (selectedPaths.length === 1) {
                showRenameDialog(selectedPaths[0]);
            } else if (selectedPaths.length > 1) {
                showToast('重命名只能选择单个文件或文件夹', 'warning');
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
            } else if (selectedPaths.length > 1) {
                showMultiplePropertiesDialog(selectedPaths);
            }
            break;
            
        case 'new-folder':
            showCreateFolderDialog();
            break;
            
        default:
            showToast(`${action} 功能待实现`, 'info');
    }
}

// 属性对话框
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
                max-height: 80vh;
                overflow-y: auto;
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
            
            .properties-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--border-color, #444);
                border-radius: 4px;
                margin: 10px 0;
            }
            
            .properties-list-item {
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color, #444);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .properties-list-item:last-child {
                border-bottom: none;
            }
            
            .properties-list-item i,
            .properties-list-item .workflow-icon-inline {
                color: var(--descrip-text, #999);
                flex-shrink: 0;
            }
            
            .properties-list-item span {
                color: var(--input-text, #ffffff);
                font-size: 12px;
                word-break: break-all;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(dialog);
}

// 多选属性对话框
function showMultiplePropertiesDialog(paths) {
    const folderCount = paths.filter(path => {
        const item = document.querySelector(`[data-path="${path}"]`);
        return item?.dataset.type === 'directory';
    }).length;
    
    const workflowCount = paths.length - folderCount;
    
    // 创建多选属性对话框
    const dialog = document.createElement('div');
    dialog.className = 'properties-dialog-overlay';
    dialog.innerHTML = `
        <div class="properties-dialog">
            <div class="dialog-header">
                <h3>属性 (${paths.length} 项已选择)</h3>
                <button class="dialog-close" onclick="this.closest('.properties-dialog-overlay').remove()">×</button>
            </div>
            <div class="dialog-content">
                <div class="property-row">
                    <label>已选择:</label>
                    <span>${paths.length} 项</span>
                </div>
                <div class="property-row">
                    <label>文件夹:</label>
                    <span>${folderCount} 个</span>
                </div>
                <div class="property-row">
                    <label>工作流:</label>
                    <span>${workflowCount} 个</span>
                </div>
                <div class="property-row">
                    <label>详细列表:</label>
                </div>
                <div class="properties-list">
                    ${paths.map(path => {
                        const item = document.querySelector(`[data-path="${path}"]`);
                        const name = item?.dataset.name || path;
                        const type = item?.dataset.type || 'workflow';
                        const iconHtml = type === 'directory'
                            ? '<i class="pi pi-folder" aria-hidden="true"></i>'
                            : `<span class="workflow-icon-inline small" aria-hidden="true" style="background-image: url('${WORKFLOW_FILE_ICON_PATH}');"></span>`;
                        return `
                            <div class="properties-list-item">
                                ${iconHtml}
                                <span>${name}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="dialog-footer">
                <button class="btn-primary" onclick="this.closest('.properties-dialog-overlay').remove()">确定</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

// 拖放功能
let draggedItems = [];

function handleDragStart(e) {
    e.stopPropagation(); // 阻止事件冒泡到ComfyUI画布
    e.stopImmediatePropagation(); // 立即阻止事件传播
    
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;
    
    const path = fileItem.dataset.path;
    const type = fileItem.dataset.type;
    
    // 检查文件类型，只允许拖拽.json工作流文件
    if (type === 'workflow' && !path.toLowerCase().endsWith('.json')) {
        e.preventDefault();
        showToast(`只能拖拽.json工作流文件`, 'warning');
        return;
    }
    
    // 如果拖拽的项目不在选中列表中，则清除选择并选中当前项目
    if (!managerState.selectedItems.has(path)) {
        clearSelection();
        addSelection(path);
    }
    
    // 设置拖拽数据
    draggedItems = Array.from(managerState.selectedItems);
    
    // 过滤拖拽项目，只包含.json文件
    if (type === 'workflow') {
        draggedItems = draggedItems.filter(itemPath => itemPath.toLowerCase().endsWith('.json'));
        if (draggedItems.length === 0) {
            e.preventDefault();
            showToast(`没有可拖拽的.json工作流文件`, 'warning');
            return;
        }
    }
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'all';
    
    // 对于工作流文件，添加特殊处理以支持拖拽到画布
    if (type === 'workflow') {
        // 设置特殊的数据类型，表明这是一个工作流文件
        e.dataTransfer.setData('application/comfy-workflow-path', path);
        e.dataTransfer.setData('text/plain', path); // 通用格式作为备用
        
        // 设置拖拽图像为文件图标
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
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
        `;
        dragImage.innerHTML = '';
        const dragIcon = document.createElement('span');
        dragIcon.className = 'workflow-icon-inline';
        dragIcon.style.backgroundImage = `url('${WORKFLOW_FILE_ICON_PATH}')`;
        dragIcon.setAttribute('aria-hidden', 'true');
        dragImage.appendChild(dragIcon);

        const dragLabel = document.createElement('span');
        dragLabel.textContent = fileItem.dataset.name;
        dragImage.appendChild(dragLabel);

        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
        
        // 在短暂延迟后移除拖拽图像
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 100);
    } else {
        // 对于文件夹，使用原来的逻辑
        e.dataTransfer.setData('text/plain', JSON.stringify(draggedItems));
    }
    
    // 添加拖拽样式
    fileItem.classList.add('dragging');
    
    // 如果是多选，显示数量
    if (draggedItems.length > 1) {
        const dragImage = createDragImage(draggedItems.length);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到ComfyUI画布
    e.stopImmediatePropagation(); // 立即阻止事件传播
    
    const fileItem = e.target.closest('.file-item');
    const emptyState = e.target.closest('#emptyState');
    const workflowManager = e.target.closest('.workflow-manager');
    
    // 检查是否在侧边栏标签容器内（这个容器覆盖整个侧边栏）
    const isInSidebar = e.currentTarget && e.currentTarget !== e.target.closest('.file-item');
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    document.querySelectorAll('.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    // 检查是否有外部文件
    const hasFiles = e.dataTransfer.types.includes('Files');
    
    if (hasFiles) {
        // 外部文件拖拽 - 允许拖到文件夹或空白区域
        if (fileItem && fileItem.dataset.type === 'directory') {
            fileItem.classList.add('drop-zone');
        } else if (emptyState || (isInSidebar && !fileItem)) {
            // 拖拽到空状态区域或侧边栏空白区域
            if (emptyState) {
                emptyState.classList.add('drop-zone');
            } else if (isInSidebar) {
                e.currentTarget.classList.add('drop-zone');
            }
        }
        e.dataTransfer.dropEffect = 'copy';
        return;
    }
    
    // 原有的内部文件拖拽逻辑
    if (fileItem && fileItem.dataset.type === 'directory') {
        const itemPath = fileItem.dataset.path;
        
        if (!draggedItems.includes(itemPath) && !isSubDirectory(itemPath, draggedItems)) {
            fileItem.classList.add('drop-zone');
            
            if (e.ctrlKey || e.metaKey) {
                e.dataTransfer.dropEffect = 'copy';
            } else {
                e.dataTransfer.dropEffect = 'move';
            }
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    } else if (emptyState && draggedItems.length > 0) {
        emptyState.classList.add('drop-zone');
        if (e.ctrlKey || e.metaKey) {
            e.dataTransfer.dropEffect = 'copy';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    } else if (isInSidebar && !fileItem && draggedItems.length > 0) {
        // 拖拽到侧边栏空白区域（当前目录）
        e.currentTarget.classList.add('drop-zone');
        if (e.ctrlKey || e.metaKey) {
            e.dataTransfer.dropEffect = 'copy';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
}


function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到ComfyUI画布
    e.stopImmediatePropagation(); // 立即阻止事件传播
    
    const fileItem = e.target.closest('.file-item');
    const emptyState = e.target.closest('#emptyState');
    // 检查是否在侧边栏标签容器内
    const isInSidebar = e.currentTarget && e.currentTarget !== e.target.closest('.file-item');
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    document.querySelectorAll('.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    // 检查是否有外部文件或文件夹拖入
    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;
    
    // 检查是否为外部拖拽：有文件且没有内部拖拽标识
    const isExternalDrag = (items && items.length > 0 || files && files.length > 0) && 
                          !e.dataTransfer.types.includes('application/comfy-workflow-path') &&
                          !e.dataTransfer.types.includes('text/plain');
    
    // 只有确认是外部拖拽时才处理外部文件
    if (isExternalDrag) {
        // 确定目标目录
        let targetDir = '';
        
        if (fileItem && fileItem.dataset.type === 'directory') {
            targetDir = fileItem.dataset.path;
        } else if (emptyState || (isInSidebar && !fileItem)) {
            targetDir = managerState.currentPath;
        }
        
        // 使用 items（支持文件夹）或回退到 files（仅文件）
        const droppedItems = items && items.length > 0 ? Array.from(items) : Array.from(files);
        
        handleExternalFileDrop(droppedItems, targetDir);
        return;
    }
    
    // 原有的内部文件移动/复制逻辑
    if (fileItem && fileItem.dataset.type === 'directory') {
        const targetPath = fileItem.dataset.path;
        const isCopy = e.ctrlKey || e.metaKey;
        
        const validWorkflowItems = draggedItems.filter(itemPath => 
            itemPath.toLowerCase().endsWith('.json')
        );
        
        if (validWorkflowItems.length === 0) {
            showToast(`没有可放置的.json工作流文件`, 'warning');
            return;
        }
        
        if (!validWorkflowItems.includes(targetPath) && !isSubDirectory(targetPath, validWorkflowItems)) {
            performDropOperation(validWorkflowItems, targetPath, isCopy);
        }
    } else if (emptyState && draggedItems.length > 0) {
        // 处理到空文件夹区域的拖放
        const targetPath = managerState.currentPath;
        const isCopy = e.ctrlKey || e.metaKey;
        
        const validWorkflowItems = draggedItems.filter(itemPath => 
            itemPath.toLowerCase().endsWith('.json')
        );
        
        if (validWorkflowItems.length > 0) {
            performDropOperation(validWorkflowItems, targetPath, isCopy);
        }
    } else if (isInSidebar && !fileItem && draggedItems.length > 0) {
        // 处理到侧边栏空白区域的拖放（当前目录）
        const targetPath = managerState.currentPath;
        const isCopy = e.ctrlKey || e.metaKey;
        
        const validWorkflowItems = draggedItems.filter(itemPath => 
            itemPath.toLowerCase().endsWith('.json')
        );
        
        if (validWorkflowItems.length > 0) {
            performDropOperation(validWorkflowItems, targetPath, isCopy);
        } else {
            showToast(`没有可放置的.json工作流文件`, 'warning');
        }
    }
}

function handleDragEnd(e) {
    e.stopPropagation(); // 阻止事件冒泡到ComfyUI画布
    e.stopImmediatePropagation(); // 立即阻止事件传播
    
    const fileItem = e.target.closest('.file-item');
    if (fileItem) {
        fileItem.classList.remove('dragging');
    }
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    document.querySelectorAll('.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    draggedItems = [];
}

async function performDropOperation(sourcePaths, targetPath, isCopy) {
    if (sourcePaths.length === 0) return;
    
    // 最终验证：确保所有源路径都是.json文件
    const validWorkflowPaths = sourcePaths.filter(path => path.toLowerCase().endsWith('.json'));
    
    if (validWorkflowPaths.length === 0) {
        showToast(`没有有效的.json工作流文件可操作`, 'warning');
        return;
    }
    
    if (validWorkflowPaths.length !== sourcePaths.length) {
        showToast(`已过滤掉非.json文件，只操作工作流文件`, 'info');
    }
    
    const operation = isCopy ? 'copy' : 'move';
    const actionText = isCopy ? '复制' : '移动';
    
    let successCount = 0;
    let errorCount = 0;
    
    // 显示加载状态
    showLoading(true);
    
    try {
        for (const sourcePath of validWorkflowPaths) {
            let result;
            
            if (isCopy) {
                result = await WorkflowAPI.copy(sourcePath, targetPath);
            } else {
                result = await WorkflowAPI.move(sourcePath, targetPath);
            }
            
            if (result.success) {
                successCount++;
                
                // 清除相关的预览图片缓存
                if (managerState.imageCache) {
                    // 清除源文件的缓存
                    managerState.imageCache.delete(sourcePath);
                    
                    // 如果是移动操作，还需要清除可能的新路径缓存
                    if (!isCopy) {
                        const fileName = sourcePath.split('/').pop();
                        const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;
                        managerState.imageCache.delete(newPath);
                    }
                }
            } else {
                errorCount++;
                console.error(`Failed to ${operation} ${sourcePath}:`, result.error);
            }
        }
        
        if (successCount > 0) {
            showToast(`成功${actionText} ${successCount} 个工作流文件${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
            
            // 刷新主目录（renderFileGrid会自动恢复展开状态）
            if (loadDirectoryRef) {
                await loadDirectoryRef(managerState.currentPath);
            }
        } else if (errorCount > 0) {
            showToast(`${actionText}失败`, 'error');
        }
    } catch (error) {
        console.error(`Failed to ${operation} items:`, error);
        showToast(`${actionText}失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 处理外部文件拖入（支持文件夹）
async function handleExternalFileDrop(items, targetDir) {
    showLoading(true);
    
    try {
        // 收集所有JSON文件（包括文件夹内的）
        const allJsonFiles = await processDroppedItems(items);
        
        if (allJsonFiles.length === 0) {
            showToast('没有找到有效的JSON工作流文件', 'warning');
            return;
        }
        
        // 验证JSON文件格式
        const validFiles = [];
        const invalidFiles = [];
        
        for (const fileInfo of allJsonFiles) {
            try {
                const text = await fileInfo.file.text();
                JSON.parse(text); // 验证JSON格式
                validFiles.push(fileInfo);
            } catch (error) {
                invalidFiles.push(fileInfo.relativePath || fileInfo.file.name);
            }
        }
        
        if (validFiles.length === 0) {
            showToast('没有有效的JSON工作流文件', 'error');
            return;
        }
        
        // 按目录分组处理文件
        const filesByDirectory = groupFilesByDirectory(validFiles, targetDir);
        
        // 批量上传文件
        let totalUploaded = 0;
        let totalFailed = 0;
        
        for (const [dirPath, dirFiles] of filesByDirectory.entries()) {
            try {
                const result = await uploadFilesToDirectory(dirFiles, dirPath);
                if (result.success) {
                    totalUploaded += result.uploaded || dirFiles.length;
                } else {
                    totalFailed += dirFiles.length;
                }
            } catch (error) {
                console.error(`Failed to upload files to ${dirPath}:`, error);
                totalFailed += dirFiles.length;
            }
        }
        
        if (totalUploaded > 0) {
            showToast(`成功上传 ${totalUploaded} 个工作流文件${totalFailed > 0 ? `，失败 ${totalFailed} 个` : ''}`, 'success');
            
            // 刷新目录显示
            if (loadDirectoryRef) {
                loadDirectoryRef(managerState.currentPath);
            }
        } else {
            showToast('文件上传失败', 'error');
        }
        
    } catch (error) {
        console.error('Failed to process dropped items:', error);
        showToast(`处理失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 处理拖拽的项目（文件或文件夹）
async function processDroppedItems(items) {
    const jsonFiles = [];
    
    // 检查是否是 DataTransfer.items（拖拽事件）还是 FileList（文件输入）
    const hasWebkitEntry = items[0] && typeof items[0].webkitGetAsEntry === 'function';
    
    if (hasWebkitEntry) {
        // 使用 webkitGetAsEntry 处理（支持文件夹）
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.kind === 'file') {
                try {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        await processEntry(entry, '', jsonFiles);
                    }
                } catch (error) {
                    console.error(`${PLUGIN_NAME}: Error processing item ${i}:`, error);
                }
            }
        }
    } else {
        // 回退到传统文件处理（只支持文件，不支持文件夹）
        for (const file of items) {
            if (file && file.name && file.name.toLowerCase().endsWith('.json')) {
                jsonFiles.push({
                    file: file,
                    relativePath: file.name
                });
            }
        }
    }
    
    return jsonFiles;
}

// 递归处理文件系统条目
async function processEntry(entry, basePath, jsonFiles) {
    if (entry.isFile) {
        // 处理文件
        try {
            const file = await getFileFromEntry(entry);
            if (file && file.name.toLowerCase().endsWith('.json')) {
                const relativePath = basePath ? `${basePath}/${file.name}` : file.name;
                jsonFiles.push({
                    file: file,
                    relativePath: relativePath,
                    directoryPath: basePath
                });
            }
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Error getting file from entry:`, entry.name, error);
        }
    } else if (entry.isDirectory) {
        // 处理文件夹
        try {
            const reader = entry.createReader();
            const entries = await readDirectoryEntries(reader);
            
            for (const childEntry of entries) {
                const childPath = basePath ? `${basePath}/${entry.name}` : entry.name;
                await processEntry(childEntry, childPath, jsonFiles);
            }
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Error reading directory:`, entry.name, error);
        }
    }
}

// 从文件系统条目获取文件对象
function getFileFromEntry(entry) {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
}

// 读取目录条目
function readDirectoryEntries(reader) {
    return new Promise((resolve, reject) => {
        const allEntries = [];
        
        function readEntries() {
            reader.readEntries((entries) => {
                if (entries.length === 0) {
                    resolve(allEntries);
                } else {
                    allEntries.push(...entries);
                    readEntries(); // 继续读取
                }
            }, reject);
        }
        
        readEntries();
    });
}

// 按目录分组文件
function groupFilesByDirectory(validFiles, targetDir) {
    const filesByDirectory = new Map();
    
    for (const fileInfo of validFiles) {
        let dirPath = targetDir;
        
        // 如果文件有目录路径，创建相应的子目录
        if (fileInfo.directoryPath) {
            dirPath = targetDir ? `${targetDir}/${fileInfo.directoryPath}` : fileInfo.directoryPath;
        }
        
        if (!filesByDirectory.has(dirPath)) {
            filesByDirectory.set(dirPath, []);
        }
        
        filesByDirectory.get(dirPath).push(fileInfo);
    }
    
    return filesByDirectory;
}

// 上传文件到指定目录
async function uploadFilesToDirectory(fileInfos, dirPath) {
    // 创建FormData
    const formData = new FormData();
    formData.append('target_dir', dirPath);
    formData.append('create_dirs', 'true'); // 告诉后端需要创建目录
    
    fileInfos.forEach(fileInfo => {
        formData.append('workflow_files', fileInfo.file);
    });
    
    // 上传文件
    const response = await api.fetchApi('/workflow-manager/upload-workflow', {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}

// 刷新工作流预览图
async function refreshWorkflowPreview(path) {
    try {
        // 检查当前是否为列表视图，如果是则不显示预览图
        const fileGrid = document.querySelector('#fileGrid');
        const isListView = fileGrid && fileGrid.classList.contains('list-view');
        
        if (isListView) {
            showToast('列表视图下不支持预览图', 'info');
            return;
        }
        
        // 清除图片缓存
        if (managerState.imageCache && managerState.imageCache.has) {
            managerState.imageCache.delete(path);
        }
        
        // 找到对应的文件项
        const fileItem = document.querySelector(`[data-path="${path}"]`);
        if (!fileItem) {
            showToast(`找不到文件项: ${path}`, 'error');
            return;
        }
        
        const iconElement = fileItem.querySelector('.file-icon');
        const previewPlaceholder = fileItem.querySelector('.preview-placeholder');
        
        if (!iconElement || !previewPlaceholder) {
            showToast(`文件项结构不完整`, 'error');
            return;
        }
        
        // 显示加载状态
        showToast(`正在刷新预览图...`, 'info');
        
        // 强制清除现有的预览图
        previewPlaceholder.innerHTML = '';
        
        // 创建新的图片元素，添加强制刷新参数
        const newPreviewImg = document.createElement('img');
        const timestamp = Date.now();
        const previewUrl = `/workflow-manager/preview?path=${encodeURIComponent(path)}&t=${timestamp}`;
        
        newPreviewImg.crossOrigin = 'anonymous';
        newPreviewImg.onload = () => {
            // 隐藏图标，显示预览图
            iconElement.style.display = 'none';
            previewPlaceholder.style.display = 'block';
            previewPlaceholder.appendChild(newPreviewImg);
            
            // 添加预览图样式
            newPreviewImg.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
                object-position: center;
                border-radius: 4px;
                transform: scale(1.0);
                transform-origin: center;
                background: var(--comfy-input-bg, #2d2d2d);
            `;
            
            // 更新缓存
            managerState.imageCache.set(path, newPreviewImg);
            
            showToast(`预览图刷新成功`, 'success');
        };
        
        newPreviewImg.onerror = (error) => {
            console.error(`${PLUGIN_NAME}: Failed to load refreshed preview for ${path}:`, error);
            // 预览图加载失败，恢复图标显示
            iconElement.style.display = 'block';
            previewPlaceholder.style.display = 'none';
            showToast(`预览图刷新失败，已恢复图标显示`, 'warning');
        };
        
        // 设置图片源，强制重新加载
        newPreviewImg.src = previewUrl;
        
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Error refreshing preview for ${path}:`, error);
        showToast(`刷新预览图失败: ${error.message}`, 'error');
    }
}

// 处理更换预览图
async function changeWorkflowPreview(workflowPath) {
    try {
        // 创建文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                showToast('请选择图片文件', 'error');
                return;
            }
            
            // 创建FormData
            const formData = new FormData();
            formData.append('workflow_path', workflowPath);
            formData.append('preview_file', file);
            
            showLoading(true);
            
            try {
                const response = await api.fetchApi('/workflow-manager/upload-preview', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast('预览图更新成功', 'success');
                    
                    // 强制清除所有相关缓存
                    if (managerState.imageCache && managerState.imageCache.has) {
                        // 清除当前文件的缓存
                        managerState.imageCache.delete(workflowPath);
                        
                        // 清除所有可能的缓存键（包括不同格式）
                        const cacheKeys = Array.from(managerState.imageCache.keys());
                        cacheKeys.forEach(key => {
                            if (key === workflowPath || key.replace(/\.json$/i, '') === workflowPath.replace(/\.json$/i, '')) {
                                managerState.imageCache.delete(key);
                            }
                        });
                    }
                    
                    // 刷新预览图显示
                    await refreshWorkflowPreview(workflowPath);
                    
                    // 清除文件输入
                    fileInput.remove();
                } else {
                    showToast(`更新失败: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Failed to upload preview:', error);
                showToast('上传失败，请重试', 'error');
            } finally {
                showLoading(false);
            }
        };
        
        // 触发文件选择
        document.body.appendChild(fileInput);
        fileInput.click();
        
    } catch (error) {
        console.error('Failed to change preview:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 初始化操作事件监听器
function initializeOperationEventListeners() {
    // 监听来自UI模块的操作事件
    window.addEventListener('workflowManager:showRenameDialog', (e) => {
        showRenameDialog(e.detail.path);
    });
    
    window.addEventListener('workflowManager:deleteSelectedItems', () => {
        deleteSelectedItems();
    });
    
    window.addEventListener('workflowManager:contextAction', (e) => {
        handleContextAction(e.detail.action);
    });
    
    window.addEventListener('workflowManager:createFolder', () => {
        showCreateFolderDialog();
    });
}

// 导出所有函数
export {
    WorkflowAPI,
    setLoadDirectoryRef,
    createFolder,
    showCreateFolderDialog,
    renameItem,
    showRenameDialog,
    deleteSelectedItems,
    pasteItems,
    handleContextAction,
    showPropertiesDialog,
    showMultiplePropertiesDialog,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    performDropOperation,
    handleExternalFileDrop,
    refreshWorkflowPreview,
    initializeOperationEventListeners,
    changeWorkflowPreview
}; 