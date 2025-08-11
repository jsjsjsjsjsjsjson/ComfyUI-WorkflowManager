// js/workflow_manager.js
// 主入口文件 - 插件注册和初始化

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

// 导入工具函数和状态管理
import { PLUGIN_NAME } from './workflow_utils.js';

// 导入UI模块
import { createManagerInterface } from './workflow_ui.js';

// 导入API模块
import { loadDirectory, initializeEventListeners } from './workflow_api.js';

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

/* 添加自定义图标样式 */
function addCustomIconStyles() {
    // 使用官方图标，不需要自定义样式
    return;
}

// 创建工作流管理器侧边栏标签
function createWorkflowManagerTab() {
    try {
        console.log(`${PLUGIN_NAME}: Creating workflow manager tab...`);
        
        if (!app.extensionManager?.registerSidebarTab) {
            console.error(`${PLUGIN_NAME}: extensionManager not available`);
            return false; // 返回 false 表示创建失败
        }
        
        app.extensionManager.registerSidebarTab({
            id: "workflow-manager",
            icon: "pi pi-folder-plus", // 使用官方ComfyUI图标格式
            title: "工作流管理器",
            tooltip: "完整的工作流文件管理",
            type: "custom",
            render: (el) => {
                console.log(`${PLUGIN_NAME}: Rendering workflow manager interface`);
                createManagerInterface(el);
                
                // 简化：渲染完成后直接加载数据
                setTimeout(() => {
                    console.log(`${PLUGIN_NAME}: Interface rendered, loading root directory`);
    loadDirectory('');
                }, 200);
            }
        });
        
        console.log(`${PLUGIN_NAME}: Tab created successfully`);
        return true; // 返回 true 表示创建成功
        
        } catch (error) {
        console.error(`${PLUGIN_NAME}: Failed to create tab:`, error);
        return false; // 返回 false 表示创建失败
    }
}

// 注册ComfyUI扩展
app.registerExtension({
    name: `Comfy.${PLUGIN_NAME}`,
    
    async setup() {
        console.log(`${PLUGIN_NAME}: Setting up...`);
        
        // 初始化事件监听器
        initializeEventListeners();
        
        // 添加全局拖拽监听器，支持工作流文件拖拽到画布
        setupCanvasDropHandler();
        
        // 先添加自定义图标样式
        addCustomIconStyles();
        
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
    console.log(`${PLUGIN_NAME}: Setting up canvas drop handler`);
    
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
                    console.log(`${PLUGIN_NAME}: Workflow dropped on canvas:`, workflowPath);
                    
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
            
            console.log(`${PLUGIN_NAME}: Canvas drop handler setup complete`);
            } else {
            // 画布还没准备好，稍后重试
            setTimeout(setupWhenReady, 500);
        }
    };
    
    setupWhenReady();
} 