// js/workflow_api.js
// API调用和核心业务逻辑

import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { 
    PLUGIN_NAME, 
    managerState, 
    formatDate, 
    sortItems,
    showToast, 
    showLoading,
    updateBreadcrumb,
    updateToolbar,
    updateStatusBar,
    setLoadDirectoryRef
} from './workflow_state.js';

// 本地isLoading变量
let isLoading = false;

// API调用函数
const WorkflowAPI = {
    async browse(path = '') {
        try {
            
            // 检查API是否可用
            if (!api || !api.fetchApi) {
                throw new Error('ComfyUI API not available');
            }
            
            const url = `/workflow-manager/browse?path=${encodeURIComponent(path)}`;
            
            const response = await api.fetchApi(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Failed to browse directory:`, error);
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

function getIconHTML(itemType) {
    if (itemType === 'directory') {
        return '<i class="file-icon folder pi pi-folder" aria-hidden="true"></i>';
    }
    return '<span class="file-icon workflow" role="img" aria-label="工作流文件"></span>';
}

// 核心目录加载函数
async function loadDirectory(path, skipViewModeApply = false) {
    
    // 防止重复调用
    if (isLoading) {
        console.log(`${PLUGIN_NAME}: Already loading, skipping duplicate request`);
        return;
    }
    
    // 使用模块级变量而不是导入的变量
    isLoading = true;
    showLoading(true);
    
    try {
        // 确保API可用
        if (!api || !api.fetchApi) {
            throw new Error('ComfyUI API not ready');
        }
        
        const result = await WorkflowAPI.browse(path);
        
        if (result.success) {
            managerState.currentPath = path;
            
            // 保存当前路径
            import('./workflow_ui.js').then(({ saveLastPath }) => {
                saveLastPath(path);
            });
            
            // 如果有配置信息且未跳过视图模式应用，则应用视图模式
            if (result.config && !skipViewModeApply) {
                // 动态导入 applyViewMode 函数
                import('./workflow_ui.js').then(({ applyViewMode }) => {
                    applyViewMode(result.config);
                });
            }
            
            await renderFileGrid(result.items || []);
            updateBreadcrumb(path);
            updateToolbar();
            updateStatusBar((result.items || []).length);
        } else {
            console.error(`${PLUGIN_NAME}: Browse failed:`, result.error);
            showToast(`加载失败: ${result.error}`, 'error');
            await renderFileGrid([]);
        }
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Load directory error:`, error);
        showToast(`加载失败: ${error.message}`, 'error');
        await renderFileGrid([]);
    } finally {
        showLoading(false);
        isLoading = false;
    }
}

// 渲染文件网格
async function renderFileGrid(items) {
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
    
    // 保存已展开文件夹的子项内容
    const expandedContents = new Map();
    managerState.expandedFolders.forEach(folderPath => {
        const childItems = Array.from(document.querySelectorAll(`[data-parent-path="${folderPath}"]`));
        if (childItems.length > 0) {
            expandedContents.set(folderPath, childItems.map(item => item.outerHTML));
        }
    });
    
    // 排序
    const sortedItems = sortItems(items);
    
    fileGrid.innerHTML = sortedItems.map(item => {
        const isFolder = item.type === 'directory';

        const meta = isFolder
            ? `${item.workflow_count} 个工作流`
            : `${formatDate(item.modified)}`;

        // 检查是否在列表视图模式下
        const isListView = fileGrid.classList.contains('list-view');

        // 为文件夹添加展开图标（仅在列表视图下）
        const expandIcon = isFolder && isListView
            ? `<i class="folder-expand-icon pi pi-chevron-right" data-path="${item.path}" title="展开文件夹"></i>`
            : '';

        const iconHtml = getIconHTML(item.type);

        return `
            <div class="file-item"
                 data-path="${item.path}"
                 data-name="${item.name}"
                 data-type="${item.type}"
                 draggable="true">
                ${expandIcon}
                <div class="file-icon-container">
                    ${iconHtml}
                    ${!isFolder ? `<div class="preview-placeholder" data-preview-path="${item.path}" style="display: none;">
                        <div class="preview-loading" style="display: none;">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>` : ''}
                </div>
                <div class="file-name">${item.name}</div>
                <div class="file-meta">${meta}</div>
            </div>
        `;
    }).join('');
    
    // 绑定展开图标的点击事件
    if (fileGrid.classList.contains('list-view')) {
        rebindExpandIconEvents();
    }
    
    // 如果是网格视图，加载预览图
    if (!fileGrid.classList.contains('list-view')) {
        loadPreviewsForWorkflows();
    }
    
    // 重新获取并恢复已展开文件夹的最新内容
    for (const folderPath of managerState.expandedFolders) {
        try {
            // 重新获取文件夹内容
            const result = await WorkflowAPI.browse(folderPath);
            if (result.success && result.items && result.items.length > 0) {
                // 先删除旧的子项目
                const existingChildren = document.querySelectorAll(`[data-parent-path="${folderPath}"]`);
                existingChildren.forEach(child => child.remove());
                
                // 添加新的子项目
                const folderItem = document.querySelector(`[data-path="${folderPath}"]`);
                if (folderItem) {
                    let insertAfter = folderItem;
                    
                    result.items.forEach((item, index) => {
                        const isFolder = item.type === 'directory';

                        const meta = isFolder
                            ? `${item.workflow_count} 个工作流`
                            : `${formatDate(item.modified)}`;

                        // 子文件夹也可以展开
                        const expandIcon = isFolder
                            ? `<i class="folder-expand-icon pi pi-chevron-right" data-path="${item.path}" title="展开文件夹"></i>`
                            : '';

                        const iconHtml = getIconHTML(item.type);

                        const childItem = document.createElement('div');
                        childItem.className = 'file-item child-item';
                        childItem.dataset.path = item.path;
                        childItem.dataset.name = item.name;
                        childItem.dataset.type = item.type;
                        childItem.dataset.parentPath = folderPath;
                        childItem.draggable = true;

                        childItem.innerHTML = `
                            ${expandIcon}
                            <div class="file-icon-container">
                                ${iconHtml}
                            </div>
                            <div class="file-name">${item.name}</div>
                            <div class="file-meta">${meta}</div>
                        `;
                        
                        insertAfter.insertAdjacentElement('afterend', childItem);
                        insertAfter = childItem;
                        
                        // 立即为新创建的子项目绑定事件
                        window.dispatchEvent(new CustomEvent('workflowManager:rebindChildItem', { 
                            detail: { element: childItem } 
                        }));
                    });
                }
            } else {
                // 如果文件夹为空，移除所有子项目
                const existingChildren = document.querySelectorAll(`[data-parent-path="${folderPath}"]`);
                existingChildren.forEach(child => child.remove());
            }
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Failed to refresh expanded folder ${folderPath}:`, error);
        }
    }
    
    // 恢复已展开文件夹的图标状态
    managerState.expandedFolders.forEach(folderPath => {
        const expandIcon = document.querySelector(`[data-path="${folderPath}"] .folder-expand-icon`);
        if (expandIcon) {
            expandIcon.classList.remove('pi-chevron-right');
            expandIcon.classList.add('pi-chevron-down');
        }
    });
    
    // 重新绑定事件
    if (managerState.expandedFolders.size > 0) {
        rebindExpandIconEvents();
    }
}

// 切换文件夹展开/折叠状态
async function toggleFolderExpand(folderPath) {
    const expandIcon = document.querySelector(`[data-path="${folderPath}"] .folder-expand-icon`);
    const folderItem = document.querySelector(`[data-path="${folderPath}"]`);
    
    if (!expandIcon || !folderItem) return;
    
    if (managerState.expandedFolders.has(folderPath)) {
        // 折叠文件夹
        collapseFolderContent(folderPath);
        managerState.expandedFolders.delete(folderPath);
        expandIcon.classList.remove('pi-chevron-down');
        expandIcon.classList.add('pi-chevron-right');
    } else {
        // 展开文件夹
        await expandFolderContent(folderPath);
        managerState.expandedFolders.add(folderPath);
        expandIcon.classList.remove('pi-chevron-right');
        expandIcon.classList.add('pi-chevron-down');
    }
}

// 点击文件夹行展开/折叠
async function toggleFolderByRow(folderPath) {
    await toggleFolderExpand(folderPath);
}

// 展开文件夹内容
async function expandFolderContent(folderPath) {
    try {
        // 检查是否已经存在子内容，如果存在则不重复展开
        const existingChildren = document.querySelector(`[data-parent-path="${folderPath}"]`);
        if (existingChildren) {
            console.log(`${PLUGIN_NAME}: Children already exist for ${folderPath}, skipping expansion`);
            return;
        }
        
        showLoading(true);
        const result = await WorkflowAPI.browse(folderPath);
        
        if (result.success && result.items && result.items.length > 0) {
            // 不创建容器，直接插入子项目
            const folderItem = document.querySelector(`[data-path="${folderPath}"]`);
            
            // 渲染子项目并直接插入到文件夹后面
            result.items.forEach((item, index) => {
                const isFolder = item.type === 'directory';

                const meta = isFolder
                    ? `${item.workflow_count} 个工作流`
                    : `${formatDate(item.modified)}`;

                // 子文件夹也可以展开
                const expandIcon = isFolder
                    ? `<i class="folder-expand-icon pi pi-chevron-right" data-path="${item.path}" title="展开文件夹"></i>`
                    : '';

                const iconHtml = getIconHTML(item.type);

                const childItem = document.createElement('div');
                childItem.className = 'file-item child-item';
                childItem.dataset.path = item.path;
                childItem.dataset.name = item.name;
                childItem.dataset.type = item.type;
                childItem.dataset.parentPath = folderPath;
                childItem.draggable = true;

                childItem.innerHTML = `
                    ${expandIcon}
                    <div class="file-icon-container">
                        ${iconHtml}
                    </div>
                    <div class="file-name">${item.name}</div>
                    <div class="file-meta">${meta}</div>
                `;
                
                // 插入到合适的位置
                let insertAfter = folderItem;
                const existingChildren = document.querySelectorAll(`[data-parent-path="${folderPath}"]`);
                if (existingChildren.length > 0) {
                    insertAfter = existingChildren[existingChildren.length - 1];
                }
                
                insertAfter.insertAdjacentElement('afterend', childItem);
            });
            
            // 重新绑定所有展开图标的事件
            rebindExpandIconEvents();
            
            showToast(`已展开文件夹 "${folderPath}"`);
        }
    } catch (error) {
        showToast(`展开失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 重新绑定展开图标事件
function rebindExpandIconEvents() {
    // 先移除所有现有的事件监听器
    const allExpandIcons = document.querySelectorAll('.folder-expand-icon');
    allExpandIcons.forEach(icon => {
        // 克隆节点来移除所有事件监听器
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);
        
        // 添加新的事件监听器
        newIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFolderExpand(newIcon.dataset.path);
        });
    });
    
    // 重新绑定所有子项目的事件（点击、拖拽、右键菜单等）
    const childItems = document.querySelectorAll('.file-item.child-item');
    childItems.forEach(item => {
        // 确保子项目有正确的事件绑定
        if (!item.hasAttribute('data-events-bound')) {
            // 标记已绑定事件，避免重复绑定
            item.setAttribute('data-events-bound', 'true');
            
            // 通知UI模块重新绑定这个子项目的事件
            window.dispatchEvent(new CustomEvent('workflowManager:rebindChildItem', { 
                detail: { element: item } 
            }));
        }
    });
}

// 折叠文件夹内容
function collapseFolderContent(folderPath) {
    // 递归折叠所有子文件夹
    const allExpanded = Array.from(managerState.expandedFolders);
    allExpanded.forEach(expandedPath => {
        if (expandedPath.startsWith(folderPath + '/')) {
            managerState.expandedFolders.delete(expandedPath);
            
            // 更新展开图标状态
            const expandIcon = document.querySelector(`[data-path="${expandedPath}"] .folder-expand-icon`);
            if (expandIcon) {
                expandIcon.classList.remove('pi-chevron-down');
                expandIcon.classList.add('pi-chevron-right');
            }
        }
    });
    
    // 移除所有属于这个文件夹的子项目
    const childItems = document.querySelectorAll(`[data-parent-path="${folderPath}"]`);
    childItems.forEach(item => {
        item.remove();
    });
    
    showToast(`已折叠文件夹 "${folderPath}"`);
}

// 加载工作流
async function loadWorkflow(path) {
    try {
        
        // 检查文件类型，只允许加载.json文件
        if (!path.toLowerCase().endsWith('.json')) {
            showToast(`只能加载.json工作流文件`, 'warning');
            return;
        }
        
        const result = await WorkflowAPI.readWorkflow(path);
        
        if (result.success) {
            // 从路径中提取文件名（不包含扩展名）
            const fileName = path.split('/').pop().replace(/\.json$/i, '');
            
            // 关键修复：优先使用workflowStore.openWorkflow来直接加载现有文件
            if (app.workflowStore && typeof app.workflowStore.openWorkflow === 'function') {
                
                try {
                    const workflowObject = {
                        path: path,
                        key: fileName,
                        isPersisted: true,
                        isModified: false,
                        workflow: result.workflow,
                        directory: path.substring(0, path.lastIndexOf('/')) || '',
                        filename: fileName + '.json'
                    };
                    
                    await app.workflowStore.openWorkflow(workflowObject);
                    showToast(`工作流"${fileName}"已加载`);
                    return;
                } catch (workflowStoreError) {
                    console.warn(`${PLUGIN_NAME}: workflowStore.openWorkflow failed:`, workflowStoreError);
                    // 如果失败，继续尝试其他方法
                }
            }
            
            // 回退方案：使用ComfyUI的标准方法
            const workflowPath = path;
            
            // 使用ComfyUI的标准方法：app.loadGraphData(workflow, true, true, workflowName)
            if (app.loadGraphData && typeof app.loadGraphData === 'function') {
                
                try {
                    await app.loadGraphData(result.workflow, true, true, workflowPath);
                    showToast(`工作流"${fileName}"已加载`);
                    
                    // 验证工作流是否正确加载
                    setTimeout(() => {
                        console.log(`${PLUGIN_NAME}: Post-load verification...`);
                        if (app.graph) {
                            console.log(`${PLUGIN_NAME}: app.graph.title:`, app.graph.title);
                            console.log(`${PLUGIN_NAME}: app.graph.filename:`, app.graph.filename);
                            
                            try {
                                app.graph.title = fileName;
                                app.graph.filename = workflowPath;
                                console.log(`${PLUGIN_NAME}: Updated graph properties - title: ${fileName}, filename: ${workflowPath}`);
                            } catch (e) {
                                console.warn(`${PLUGIN_NAME}: Failed to set graph properties:`, e);
                            }
                        }
                    }, 500);
                    
                } catch (loadError) {
                    console.warn(`${PLUGIN_NAME}: app.loadGraphData failed:`, loadError);
                    await tryFallbackMethods(result.workflow, fileName, path, workflowPath);
                }
                
            } else {
                console.log(`${PLUGIN_NAME}: app.loadGraphData not available, trying fallback methods`);
                await tryFallbackMethods(result.workflow, fileName, path, workflowPath);
            }
        } else {
            showToast(`加载失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error(`${PLUGIN_NAME}: Error loading workflow:`, error);
        showToast(`加载失败: ${error.message}`, 'error');
    }
}

// 尝试回退方法的辅助函数
async function tryFallbackMethods(workflowData, fileName, path, workflowPath) {
    // 方法1：尝试使用workflowStore.openWorkflow（优先使用相对路径）
    if (app.workflowStore && typeof app.workflowStore.openWorkflow === 'function') {
        console.log(`${PLUGIN_NAME}: Trying workflowStore.openWorkflow as primary fallback`);
        
        try {
            const workflowObject = {
                path: path, // 使用相对路径
                key: fileName,
                isPersisted: true,
                isModified: false,
                workflow: workflowData,
                directory: path.substring(0, path.lastIndexOf('/')) || '',
                filename: fileName + '.json'
            };
            
            console.log(`${PLUGIN_NAME}: Created workflow object:`, workflowObject);
            
            await app.workflowStore.openWorkflow(workflowObject);
            showToast(`工作流"${fileName}"已加载（通过workflowStore）`);
            return;
        } catch (workflowStoreError) {
            console.warn(`${PLUGIN_NAME}: workflowStore.openWorkflow failed:`, workflowStoreError);
        }
    }
    
    // 方法2：尝试workflowService.openWorkflow
    if (app.workflowService && typeof app.workflowService.openWorkflow === 'function') {
        console.log(`${PLUGIN_NAME}: Trying workflowService.openWorkflow as fallback`);
        
        try {
            const workflowDataWithPath = {
                ...workflowData,
                path: workflowPath,
                filename: fileName,
                source: 'file',
                originalPath: workflowPath
            };
            
            await app.workflowService.openWorkflow(workflowDataWithPath);
            showToast(`工作流"${fileName}"已加载（通过workflowService）`);
            return;
        } catch (workflowServiceError) {
            console.warn(`${PLUGIN_NAME}: workflowService.openWorkflow failed:`, workflowServiceError);
        }
    }
    
    // 方法3：尝试app.handleFile
    if (app.handleFile && typeof app.handleFile === 'function') {
        console.log(`${PLUGIN_NAME}: Trying app.handleFile as final fallback`);
        await fallbackToHandleFile(workflowData, fileName, path, workflowPath);
        return;
    }
    
    // 方法4：最后的回退方案
    console.log(`${PLUGIN_NAME}: Using basic app.loadGraphData as final fallback`);
    await app.loadGraphData(workflowData, true, true);
    showToast(`工作流"${fileName}"已加载（基础方法）`);
}

// 回退到handleFile方法
async function fallbackToHandleFile(workflowData, fileName, path, workflowPath) {
    const workflowBlob = new Blob([JSON.stringify(workflowData)], { type: 'application/json' });
    const file = new File([workflowBlob], `${fileName}.json`, { type: 'application/json' });
    
    try {
        // 设置文件路径属性
        Object.defineProperty(file, 'fullPath', {
            value: workflowPath,
            writable: false,
            configurable: true
        });
        
        Object.defineProperty(file, 'webkitRelativePath', {
            value: workflowPath,
            writable: false,
            configurable: true
        });
        
        file._originalPath = workflowPath;
        file._workflowPath = workflowPath;
        
    } catch (e) {
        console.log(`${PLUGIN_NAME}: Could not set some file properties:`, e.message);
    }
    
    await app.handleFile(file);
    showToast(`工作流"${fileName}"已加载`);
}

// 初始化事件监听器
function initializeEventListeners() {
    // 设置loadDirectory函数引用
    setLoadDirectoryRef(loadDirectory);
    
    // 监听来自其他模块的事件
    window.addEventListener('workflowManager:loadWorkflow', (e) => {
        loadWorkflow(e.detail.path);
    });
    
    // 监听文件夹行点击展开/折叠事件
    window.addEventListener('workflowManager:toggleFolder', (e) => {
        toggleFolderByRow(e.detail.path);
    });
    
    // 监听重新绑定事件
    window.addEventListener('workflowManager:rebindEvents', () => {
        rebindExpandIconEvents();
    });
}

// 预览图加载函数
async function loadPreviewsForWorkflows() {
    // 检查当前视图模式 - 只在网格视图下加载预览图
    const fileGrid = document.querySelector('#fileGrid');
    if (fileGrid.classList.contains('list-view')) {
        return;
    }
    
    // 网格视图下：显示预览图
    const workflowItems = document.querySelectorAll('.file-item[data-type="workflow"]');
    
    for (const item of workflowItems) {
        const path = item.dataset.path;
        const iconElement = item.querySelector('.file-icon');
        const previewPlaceholder = item.querySelector('.preview-placeholder');
        
        if (iconElement && previewPlaceholder) {
            try {
                // 动态导入预览图加载函数
                const { loadWorkflowPreview } = await import('./workflow_state.js');
                const previewImg = await loadWorkflowPreview(path);
                
                if (previewImg) {
                    // 隐藏图标，显示预览图
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
                } else {
                    // 预览图加载失败，保持图标显示
                    iconElement.style.display = 'block';
                    previewPlaceholder.style.display = 'none';
                }
            } catch (error) {
                console.error(`${PLUGIN_NAME}: Error loading preview for ${path}:`, error);
                // 错误时保持图标显示
                iconElement.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            }
        }
    }
}

// 导出主要函数
export {
    WorkflowAPI,
    loadDirectory,
    renderFileGrid,
    loadWorkflow,
    initializeEventListeners,
    toggleFolderExpand,
    expandFolderContent,
    collapseFolderContent,
    rebindExpandIconEvents,
    toggleFolderByRow,
    fallbackToHandleFile,
    tryFallbackMethods,
    loadPreviewsForWorkflows
};