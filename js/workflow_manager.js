// js/workflow_manager.js
// 主入口文件 - 插件注册和初始化

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

// 导入状态管理
import { PLUGIN_NAME } from './workflow_state.js';

// 导入UI模块
import { createManagerInterface, setLoadDirectoryRef as setUILoadDirectoryRef, initializeUIEventListeners } from './workflow_ui.js';

// 导入API模块
import { loadDirectory, initializeEventListeners } from './workflow_api.js';

// 导入操作模块
import { setLoadDirectoryRef as setOperationsLoadDirectoryRef, initializeOperationEventListeners } from './workflow_operations.js';

// 等待ComfyUI API就绪
function waitForComfyAPI() {
    return new Promise((resolve) => {
        const checkAPI = () => {
            if (app.extensionManager && api && app.graph) {
                resolve();
            } else {
                setTimeout(checkAPI, 100);
            }
        };
        checkAPI();
    });
}

// 创建工作流管理器侧边栏标签
function createWorkflowManagerTab() {
    try {
        
        if (!app.extensionManager?.registerSidebarTab) {
            console.error(`${PLUGIN_NAME}: extensionManager not available`);
            return false;
        }
        
        app.extensionManager.registerSidebarTab({
            id: "workflow-manager",
            icon: "pi pi-folder-plus",
            title: "工作流管理器",
            tooltip: "完整的工作流文件管理",
            type: "custom",
            render: (el) => {
                // 设置侧边栏标签页容器样式，确保占满整个高度
                if (el.parentElement) {
                    el.parentElement.style.height = '100%';
                    el.parentElement.style.display = 'flex';
                    el.parentElement.style.flexDirection = 'column';
                }
                
                // 设置当前容器样式
                el.style.height = '100%';
                el.style.minHeight = '100vh';
                el.style.display = 'flex';
                el.style.flexDirection = 'column';
                
                createManagerInterface(el);
                
                // 设置loadDirectory函数引用到各个模块
                setUILoadDirectoryRef(loadDirectory);
                setOperationsLoadDirectoryRef(loadDirectory);
                
                // 初始化UI事件监听器
                initializeUIEventListeners();
                
                // 渲染完成后加载数据
                setTimeout(async () => {

                    // 获取配置并应用视图模式，然后再加载目录
                    try {
                        const response = await fetch('/workflow-manager/browse?path=');
                        if (response.ok) {
                            const result = await response.json();
                            const config = result.config || {};
                            const lastPath = config.lastPath || '';
                            
                            // 先应用视图模式
                            const { applyViewMode } = await import('./workflow_ui.js');
                            applyViewMode(config);
                            
                            // 等待一下确保视图模式应用完成，然后加载目录
                            setTimeout(() => {
                                loadDirectory(lastPath, true); // 跳过视图模式应用
                            }, 50);
                        } else {
                            console.warn(`${PLUGIN_NAME}: Failed to get config, loading root`);
                            loadDirectory('');
                        }
                    } catch (error) {
                        console.error(`${PLUGIN_NAME}: Error getting last path:`, error);
                        loadDirectory('');
                    }
                }, 200);
            }
        });
        
        return true;
        
        } catch (error) {
        console.error(`${PLUGIN_NAME}: Failed to create tab:`, error);
        return false;
        }
}

// 注册ComfyUI扩展
app.registerExtension({
    name: `Comfy.${PLUGIN_NAME}`,
    
    async setup() {
        
        // 初始化事件监听器
        initializeEventListeners();
        initializeOperationEventListeners();
        
        // 添加全局拖拽监听器，支持工作流文件拖拽到画布
        setupCanvasDropHandler();
        
        // 尝试立即创建，如果失败则稍后重试
        if (!createWorkflowManagerTab()) {
            await waitForComfyAPI();
            
            // 重试创建侧边栏标签
            setTimeout(() => {
                createWorkflowManagerTab();
            }, 200);
        }
    }
});

// 设置画布拖放处理器
function setupCanvasDropHandler() {
    
    // 等待画布可用
    const setupWhenReady = () => {
        if (app.canvas && app.canvas.canvas) {
            const canvas = app.canvas.canvas;
            
            // 添加拖拽悬停处理
            canvas.addEventListener('dragover', (e) => {
                // 检查是否是工作流文件拖拽
                if (e.dataTransfer.types.includes('application/comfy-workflow-path')) {
    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    
                    // 添加视觉反馈
                    canvas.style.filter = 'brightness(1.1)';
                    canvas.style.transition = 'filter 0.2s ease';
                }
            });
    
            // 添加拖拽离开处理
            canvas.addEventListener('dragleave', (e) => {
                // 移除视觉反馈
                canvas.style.filter = '';
    });
    
            // 添加拖放处理
            canvas.addEventListener('drop', async (e) => {
                // 移除视觉反馈
                canvas.style.filter = '';
                
                // 检查是否是工作流文件拖拽
                const workflowPath = e.dataTransfer.getData('application/comfy-workflow-path');
                if (workflowPath) {
        e.preventDefault();
                    
                    // 导入工作流到ComfyUI
                    try {
                        // 动态导入loadWorkflow函数
                        const { loadWorkflow } = await import('./workflow_api.js');
                        await loadWorkflow(workflowPath);
    } catch (error) {
                        console.error(`${PLUGIN_NAME}: Failed to load dropped workflow:`, error);
                    }
                }
            });
            
            } else {
            // 画布还没准备好，稍后重试
            setTimeout(setupWhenReady, 500);
        }
    };
    
    setupWhenReady();
} 