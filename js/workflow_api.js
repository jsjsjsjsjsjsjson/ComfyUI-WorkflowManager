// js/workflow_api.js
// API调用和核心业务逻辑

import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { 
    PLUGIN_NAME, 
    managerState, 
    // isLoading, // 移除导入，使用本地变量
    formatFileSize, 
    formatDate, 
    sortItems,
    showToast, 
    showLoading,
    updateBreadcrumb,
    updateToolbar,
    updateStatusBar,
    clearSelection,
    addSelection,
    isSubDirectory,
    createDragImage,
    setLoadDirectoryRef
} from './workflow_utils.js';

// 本地isLoading变量
let isLoading = false;

// API调用函数
const WorkflowAPI = {
    async browse(path = '') {
        try {
            console.log(`${PLUGIN_NAME}: API browse request for path:`, path);
            
            // 检查API是否可用
            if (!api || !api.fetchApi) {
                throw new Error('ComfyUI API not available');
            }
            
            const url = `/workflow-manager/browse?path=${encodeURIComponent(path)}`;
            console.log(`${PLUGIN_NAME}: Fetching URL:`, url);
            
            const response = await api.fetchApi(url);
            console.log(`${PLUGIN_NAME}: Response status:`, response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`${PLUGIN_NAME}: API response:`, result);
            return result;
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Failed to browse directory:`, error);
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

// 核心目录加载函数
async function loadDirectory(path) {
    console.log(`${PLUGIN_NAME}: ===== LOADING DIRECTORY =====`);
    console.log(`${PLUGIN_NAME}: Path requested:`, path);
    console.log(`${PLUGIN_NAME}: API available:`, !!api);
    
    // 防止重复调用
    if (isLoading) {
        console.log(`${PLUGIN_NAME}: Already loading, skipping duplicate request`);
        return;
    }
    
    // 使用模块级变量而不是导入的变量
    window.workflowManagerIsLoading = true;
    showLoading(true);
    
    try {
        // 确保API可用
        if (!api || !api.fetchApi) {
            throw new Error('ComfyUI API not ready');
        }
        
        console.log(`${PLUGIN_NAME}: Calling WorkflowAPI.browse...`);
        const result = await WorkflowAPI.browse(path);
        console.log(`${PLUGIN_NAME}: API Result:`, result);
        
        if (result.success) {
            managerState.currentPath = path;
            console.log(`${PLUGIN_NAME}: Updated currentPath to:`, managerState.currentPath);
            renderFileGrid(result.items || []);
            updateBreadcrumb(path);
            updateToolbar();
            updateStatusBar((result.items || []).length);
            console.log(`${PLUGIN_NAME}: ===== LOADING SUCCESS =====`);
        } else {
            console.error(`${PLUGIN_NAME}: Browse failed:`, result.error);
            showToast(`加载失败: ${result.error}`, 'error');
            renderFileGrid([]);
        }
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Load directory error:`, error);
        showToast(`加载失败: ${error.message}`, 'error');
        renderFileGrid([]);
    } finally {
        showLoading(false);
        window.workflowManagerIsLoading = false;
        console.log(`${PLUGIN_NAME}: ===== LOADING FINISHED =====`);
    }
}

// 渲染文件网格
function renderFileGrid(items) {
    const fileGrid = document.querySelector('#fileGrid');
    const emptyState = document.querySelector('#emptyState');
    
    if (items.length === 0) {
        if (fileGrid) fileGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    if (fileGrid) fileGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    if (!fileGrid) return;
    
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

// 加载工作流
async function loadWorkflow(path) {
    try {
        console.log(`${PLUGIN_NAME}: Loading workflow from path:`, path);
        
        const result = await WorkflowAPI.readWorkflow(path);
        
        if (result.success) {
            // 从路径中提取文件名（不包含扩展名）
            const fileName = path.split('/').pop().replace(/\.json$/i, '');
            
            // 尝试使用app.handleFile方法，这可能会正确设置文件路径关联
            if (app.handleFile && typeof app.handleFile === 'function') {
                console.log(`${PLUGIN_NAME}: Using app.handleFile for workflow loading`);
                
                // 创建一个模拟的File对象
                const workflowBlob = new Blob([JSON.stringify(result.workflow)], { type: 'application/json' });
                const file = new File([workflowBlob], `${fileName}.json`, { type: 'application/json' });
                
                // 添加路径信息到文件对象（如果可能）
                try {
                    Object.defineProperty(file, 'fullPath', {
                        value: `workflows/${path}`,
                        writable: false
                    });
                } catch (e) {
                    console.log(`${PLUGIN_NAME}: Could not set fullPath property:`, e.message);
                }
                
                await app.handleFile(file);
                showToast(`工作流"${fileName}"已加载`);
            } else {
                // 回退到原来的方法
                console.log(`${PLUGIN_NAME}: Falling back to app.loadGraphData`);
                await app.loadGraphData(result.workflow, true, true, fileName);
                showToast(`工作流"${fileName}"已加载`);
            }
        } else {
            showToast(`加载失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Error loading workflow:`, error);
        showToast(`加载失败: ${error.message}`, 'error');
    }
}

// 文件操作功能
async function createFolder(name) {
    const result = await WorkflowAPI.createFolder(name, managerState.currentPath);
    
    if (result.success) {
        showToast('文件夹创建成功');
        loadDirectory(managerState.currentPath);
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
        loadDirectory(managerState.currentPath);
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

// 右键菜单操作
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
    
    // 如果拖拽的项目不在选中列表中，则清除选择并选中当前项目
    if (!managerState.selectedItems.has(path)) {
        clearSelection();
        addSelection(path);
    }
    
    // 设置拖拽数据
    draggedItems = Array.from(managerState.selectedItems);
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'all';
    
    // 对于工作流文件，添加特殊处理以支持拖拽到画布
    if (type === 'workflow') {
        console.log(`${PLUGIN_NAME}: Setting up workflow drag for canvas drop`);
        
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
    
    console.log('Drag start:', draggedItems, 'Type:', type);
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

// 初始化事件监听器
function initializeEventListeners() {
    // 设置loadDirectory函数引用
    setLoadDirectoryRef(loadDirectory);
    
    // 监听来自其他模块的事件
    window.addEventListener('workflowManager:rename', (e) => {
        showRenameDialog(e.detail.path);
    });
    
    window.addEventListener('workflowManager:delete', () => {
        deleteSelectedItems();
    });
    
    window.addEventListener('workflowManager:loadWorkflow', (e) => {
        loadWorkflow(e.detail.path);
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
    loadDirectory,
    renderFileGrid,
    loadWorkflow,
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
    initializeEventListeners
}; 