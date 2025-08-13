// js/workflow_operations.js
// 文件操作和拖拽功能

import { api } from "../../../scripts/api.js";
import { 
    PLUGIN_NAME, 
    managerState, 
    formatFileSize, 
    formatDate, 
    sortItems,
    showToast, 
    showLoading,
    clearSelection,
    addSelection
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
        
        if (loadDirectoryRef) {
            loadDirectoryRef(managerState.currentPath);
        }
    } else {
        showToast(`${operation === 'cut' ? '移动' : '复制'}失败`, 'error');
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
            if (selectedPaths.length === 1) {
                refreshWorkflowPreview(selectedPaths[0]);
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

// 拖放功能
let draggedItems = [];

function handleDragStart(e) {
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
        dragImage.innerHTML = `<i class="pi pi-file" style="color: #28a745;"></i>${fileItem.dataset.name}`;
        
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
    
    const fileItem = e.target.closest('.file-item');
    
    // 移除所有drop-zone样式
    document.querySelectorAll('.file-item.drop-zone').forEach(item => {
        item.classList.remove('drop-zone');
    });
    
    if (fileItem && fileItem.dataset.type === 'directory') {
        const itemPath = fileItem.dataset.path;
        
        // 检查是否是有效的放置目标（不能拖拽到自己或子目录）
        // 扩展：支持拖拽到任何展开的文件夹（包括子文件夹）
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
        
        // 过滤拖拽项目，只包含.json文件
        const validWorkflowItems = draggedItems.filter(itemPath => 
            itemPath.toLowerCase().endsWith('.json')
        );
        
        if (validWorkflowItems.length === 0) {
            showToast(`没有可放置的.json工作流文件`, 'warning');
            return;
        }
        
        // 检查是否是有效的放置目标
        if (!validWorkflowItems.includes(targetPath) && !isSubDirectory(targetPath, validWorkflowItems)) {
            performDropOperation(validWorkflowItems, targetPath, isCopy);
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
            } else {
                errorCount++;
                console.error(`Failed to ${operation} ${sourcePath}:`, result.error);
            }
        }
        
        if (successCount > 0) {
            showToast(`成功${actionText} ${successCount} 个工作流文件${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
            
            // 刷新主目录
            if (loadDirectoryRef) {
                loadDirectoryRef(managerState.currentPath);
            }
            
            // 如果目标文件夹已展开，刷新其内容
            if (managerState.expandedFolders.has(targetPath)) {
                setTimeout(async () => {
                    const targetContainer = document.querySelector(`[data-parent-path="${targetPath}"]`);
                    if (targetContainer) {
                        // 重新获取目标文件夹内容并更新
                        try {
                            const result = await WorkflowAPI.browse(targetPath);
                            if (result.success) {
                                const sortedItems = sortItems(result.items || []);
                                targetContainer.innerHTML = sortedItems.map(item => {
                                    const isFolder = item.type === 'directory';
                                    const iconClass = isFolder ? 'folder' : 'workflow';
                                    const icon = isFolder ? 'pi-folder' : 'pi-file';
                                    
                                    const meta = isFolder 
                                        ? `${item.workflow_count} 个工作流` 
                                        : `${formatFileSize(item.size)} • ${formatDate(item.modified)}`;
                                    
                                    const expandIcon = isFolder 
                                        ? `<i class="folder-expand-icon pi pi-chevron-right" data-path="${item.path}" title="展开文件夹"></i>` 
                                        : '';
                                    
                                    return `
                                        <div class="file-item child-item" 
                                             data-path="${item.path}" 
                                             data-name="${item.name}"
                                             data-type="${item.type}"
                                             draggable="true">
                                            ${expandIcon}
                                            <i class="file-icon ${iconClass} pi ${icon}"></i>
                                            <div class="file-name">${item.name}</div>
                                            <div class="file-meta">${meta}</div>
                                        </div>
                                    `;
                                }).join('');
                                
                                // 通知重新绑定事件
                                window.dispatchEvent(new CustomEvent('workflowManager:rebindEvents'));
                            }
                        } catch (error) {
                            console.error('Failed to refresh expanded folder:', error);
                        }
                    }
                }, 100);
            }
        } else {
            showToast(`${actionText}失败`, 'error');
        }
    } catch (error) {
        console.error(`Failed to ${operation} items:`, error);
        showToast(`${actionText}失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
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
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    performDropOperation,
    refreshWorkflowPreview,
    initializeOperationEventListeners,
    changeWorkflowPreview
}; 