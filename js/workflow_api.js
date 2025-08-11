// js/workflow_api.js
// API调用和核心业务逻辑

import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { 
    PLUGIN_NAME, 
    managerState, 
    formatFileSize, 
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
    isLoading = true;
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
        isLoading = false;
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
        
        // 检查是否在列表视图模式下
        const isListView = fileGrid.classList.contains('list-view');
        
        // 为文件夹添加展开图标（仅在列表视图下）
        const expandIcon = isFolder && isListView 
            ? `<i class="folder-expand-icon pi pi-chevron-right" data-path="${item.path}" title="展开文件夹"></i>` 
            : '';
        
        return `
            <div class="file-item" 
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
    
    // 绑定展开图标的点击事件
    if (fileGrid.classList.contains('list-view')) {
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
        
        // 获取文件夹内容
        const result = await WorkflowAPI.browse(folderPath);
        
        if (result.success) {
            const folderItem = document.querySelector(`[data-path="${folderPath}"]`);
            if (!folderItem) return;
            
            // 创建子内容容器
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            childrenContainer.dataset.parentPath = folderPath;
            
            // 渲染子项目
            const sortedItems = sortItems(result.items || []);
            childrenContainer.innerHTML = sortedItems.map(item => {
                const isFolder = item.type === 'directory';
                const iconClass = isFolder ? 'folder' : 'workflow';
                const icon = isFolder ? 'pi-folder' : 'pi-file';
                
                const meta = isFolder 
                    ? `${item.workflow_count} 个工作流` 
                    : `${formatFileSize(item.size)} • ${formatDate(item.modified)}`;
                
                // 子文件夹也可以展开
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
            
            // 插入到文件夹项目后面
            folderItem.insertAdjacentElement('afterend', childrenContainer);
            
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
}

// 折叠文件夹内容
function collapseFolderContent(folderPath) {
    // 递归折叠所有子文件夹
    const allExpanded = Array.from(managerState.expandedFolders);
    allExpanded.forEach(expandedPath => {
        if (expandedPath.startsWith(folderPath + '/')) {
            managerState.expandedFolders.delete(expandedPath);
        }
    });
    
    // 使用更安全的方式移除DOM中的子内容
    const allContainers = document.querySelectorAll('.folder-children');
    
    allContainers.forEach(container => {
        if (container.dataset.parentPath === folderPath) {
            container.remove();
        }
    });
    
    showToast(`已折叠文件夹 "${folderPath}"`);
}

// 加载工作流
async function loadWorkflow(path) {
    try {
        console.log(`${PLUGIN_NAME}: Loading workflow from path:`, path);
        
        const result = await WorkflowAPI.readWorkflow(path);
        
        if (result.success) {
            // 从路径中提取文件名（不包含扩展名）
            const fileName = path.split('/').pop().replace(/\.json$/i, '');
            
            // 关键修复：使用相对路径，ComfyUI会内部添加workflows前缀
            const workflowPath = path;
            console.log(`${PLUGIN_NAME}: Using relative workflow path:`, workflowPath);
            
            // 使用ComfyUI的标准方法：app.loadGraphData(workflow, true, true, workflowName)
            if (app.loadGraphData && typeof app.loadGraphData === 'function') {
                console.log(`${PLUGIN_NAME}: Using app.loadGraphData with relative path`);
                
                try {
                    await app.loadGraphData(result.workflow, true, true, workflowPath);
                    showToast(`工作流"${fileName}"已加载`);
                    console.log(`${PLUGIN_NAME}: Workflow loaded with relative path:`, workflowPath);
                    
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
    // 方法1：尝试使用workflowStore.openWorkflow
    if (app.workflowStore && typeof app.workflowStore.openWorkflow === 'function') {
        console.log(`${PLUGIN_NAME}: Trying workflowStore.openWorkflow as primary fallback`);
        
        try {
            const workflowObject = {
                path: workflowPath,
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
    tryFallbackMethods
}; 