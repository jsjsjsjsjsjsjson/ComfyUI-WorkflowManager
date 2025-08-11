# __init__.py
"""
ComfyUI Workflow Manager Plugin
完整的工作流文件管理器 - 支持文件夹创建、重命名、移动、复制、删除等完整文件操作
"""

import os
import json
import shutil
import logging
from aiohttp import web
import folder_paths
from server import PromptServer

WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__version__ = "1.0.0"
__author__ = "ComfyUI Community"
__description__ = "Complete workflow file manager with full filesystem operations"

def get_workflows_directory():
    """获取用户工作流目录路径"""
    user_dir = folder_paths.get_user_directory()
    return os.path.join(user_dir, "default", "workflows")

def ensure_workflows_directory():
    """确保工作流目录存在"""
    workflows_dir = get_workflows_directory()
    os.makedirs(workflows_dir, exist_ok=True)
    return workflows_dir

def is_safe_path(base_path, target_path):
    """检查路径是否安全，防止目录遍历攻击"""
    base_path = os.path.abspath(base_path)
    target_path = os.path.abspath(target_path)
    return target_path.startswith(base_path)

@PromptServer.instance.routes.get("/workflow-manager/browse")
async def browse_directory(request):
    """浏览目录内容"""
    try:
        path = request.query.get('path', '').strip()
        workflows_dir = ensure_workflows_directory()
        
        if path:
            target_dir = os.path.join(workflows_dir, path)
        else:
            target_dir = workflows_dir
            
        if not is_safe_path(workflows_dir, target_dir):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
            
        if not os.path.exists(target_dir):
            return web.json_response({"success": False, "error": "目录不存在"}, status=404)
        
        items = []
        
        # 获取目录内容
        for item_name in sorted(os.listdir(target_dir)):
            item_path = os.path.join(target_dir, item_name)
            relative_path = os.path.relpath(item_path, workflows_dir).replace('\\', '/')
            
            if os.path.isdir(item_path):
                # 统计文件夹中的工作流数量
                workflow_count = 0
                try:
                    for file in os.listdir(item_path):
                        if file.endswith('.json'):
                            workflow_count += 1
                except:
                    workflow_count = 0
                    
                items.append({
                    "name": item_name,
                    "type": "directory",
                    "path": relative_path,
                    "size": 0,
                    "modified": os.path.getmtime(item_path),
                    "workflow_count": workflow_count
                })
            elif item_name.endswith('.json'):
                # 工作流文件
                file_size = os.path.getsize(item_path)
                items.append({
                    "name": item_name,
                    "type": "workflow",
                    "path": relative_path,
                    "size": file_size,
                    "modified": os.path.getmtime(item_path)
                })
        
        return web.json_response({
            "success": True,
            "current_path": path,
            "items": items
        })
        
    except Exception as e:
        logging.error(f"Failed to browse directory: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/create-folder")
async def create_folder(request):
    """创建文件夹"""
    try:
        data = await request.json()
        folder_name = data.get('name', '').strip()
        parent_path = data.get('parent_path', '').strip()
        
        if not folder_name:
            return web.json_response({"success": False, "error": "文件夹名称不能为空"}, status=400)
        
        # 检查文件夹名称是否合法
        if any(char in folder_name for char in r'<>:"/\|?*'):
            return web.json_response({"success": False, "error": "文件夹名称包含非法字符"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        
        if parent_path:
            target_dir = os.path.join(workflows_dir, parent_path, folder_name)
        else:
            target_dir = os.path.join(workflows_dir, folder_name)
        
        if not is_safe_path(workflows_dir, target_dir):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if os.path.exists(target_dir):
            return web.json_response({"success": False, "error": "文件夹已存在"}, status=409)
        
        os.makedirs(target_dir, exist_ok=True)
        logging.info(f"Folder created: {target_dir}")
        
        return web.json_response({"success": True, "path": os.path.relpath(target_dir, workflows_dir).replace('\\', '/')})
        
    except Exception as e:
        logging.error(f"Failed to create folder: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/rename")
async def rename_item(request):
    """重命名文件或文件夹"""
    try:
        data = await request.json()
        old_path = data.get('old_path', '').strip()
        new_name = data.get('new_name', '').strip()
        
        if not old_path or not new_name:
            return web.json_response({"success": False, "error": "路径和新名称不能为空"}, status=400)
        
        # 检查新名称是否合法
        if any(char in new_name for char in r'<>:"/\|?*'):
            return web.json_response({"success": False, "error": "名称包含非法字符"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        old_full_path = os.path.join(workflows_dir, old_path)
        
        if not is_safe_path(workflows_dir, old_full_path):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(old_full_path):
            return web.json_response({"success": False, "error": "文件或文件夹不存在"}, status=404)
        
        # 构建新路径
        parent_dir = os.path.dirname(old_full_path)
        new_full_path = os.path.join(parent_dir, new_name)
        
        if os.path.exists(new_full_path):
            return web.json_response({"success": False, "error": "目标名称已存在"}, status=409)
        
        os.rename(old_full_path, new_full_path)
        logging.info(f"Renamed: {old_full_path} -> {new_full_path}")
        
        return web.json_response({
            "success": True, 
            "new_path": os.path.relpath(new_full_path, workflows_dir).replace('\\', '/')
        })
        
    except Exception as e:
        logging.error(f"Failed to rename: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/delete")
async def delete_item(request):
    """删除文件或文件夹"""
    try:
        data = await request.json()
        item_path = data.get('path', '').strip()
        
        if not item_path:
            return web.json_response({"success": False, "error": "路径不能为空"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        full_path = os.path.join(workflows_dir, item_path)
        
        if not is_safe_path(workflows_dir, full_path):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(full_path):
            return web.json_response({"success": False, "error": "文件或文件夹不存在"}, status=404)
        
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
            
        logging.info(f"Deleted: {full_path}")
        
        return web.json_response({"success": True})
        
    except Exception as e:
        logging.error(f"Failed to delete: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/move")
async def move_item(request):
    """移动文件或文件夹"""
    try:
        data = await request.json()
        source_path = data.get('source_path', '').strip()
        target_dir = data.get('target_dir', '').strip()
        
        if not source_path:
            return web.json_response({"success": False, "error": "源路径不能为空"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        source_full_path = os.path.join(workflows_dir, source_path)
        
        if target_dir:
            target_full_dir = os.path.join(workflows_dir, target_dir)
        else:
            target_full_dir = workflows_dir
        
        if not is_safe_path(workflows_dir, source_full_path) or not is_safe_path(workflows_dir, target_full_dir):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(source_full_path):
            return web.json_response({"success": False, "error": "源文件不存在"}, status=404)
        
        if not os.path.exists(target_full_dir):
            return web.json_response({"success": False, "error": "目标目录不存在"}, status=404)
        
        source_name = os.path.basename(source_full_path)
        target_full_path = os.path.join(target_full_dir, source_name)
        
        if os.path.exists(target_full_path):
            return web.json_response({"success": False, "error": "目标位置已存在同名项目"}, status=409)
        
        shutil.move(source_full_path, target_full_path)
        logging.info(f"Moved: {source_full_path} -> {target_full_path}")
        
        return web.json_response({
            "success": True,
            "new_path": os.path.relpath(target_full_path, workflows_dir).replace('\\', '/')
        })
        
    except Exception as e:
        logging.error(f"Failed to move: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/copy")
async def copy_item(request):
    """复制文件或文件夹"""
    try:
        data = await request.json()
        source_path = data.get('source_path', '').strip()
        target_dir = data.get('target_dir', '').strip()
        
        if not source_path:
            return web.json_response({"success": False, "error": "源路径不能为空"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        source_full_path = os.path.join(workflows_dir, source_path)
        
        if target_dir:
            target_full_dir = os.path.join(workflows_dir, target_dir)
        else:
            target_full_dir = workflows_dir
        
        if not is_safe_path(workflows_dir, source_full_path) or not is_safe_path(workflows_dir, target_full_dir):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(source_full_path):
            return web.json_response({"success": False, "error": "源文件不存在"}, status=404)
        
        if not os.path.exists(target_full_dir):
            return web.json_response({"success": False, "error": "目标目录不存在"}, status=404)
        
        source_name = os.path.basename(source_full_path)
        target_full_path = os.path.join(target_full_dir, source_name)
        
        # 如果目标已存在，自动重命名
        counter = 1
        base_name, ext = os.path.splitext(source_name)
        while os.path.exists(target_full_path):
            if ext:
                new_name = f"{base_name}_copy{counter}{ext}"
            else:
                new_name = f"{base_name}_copy{counter}"
            target_full_path = os.path.join(target_full_dir, new_name)
            counter += 1
        
        if os.path.isdir(source_full_path):
            shutil.copytree(source_full_path, target_full_path)
        else:
            shutil.copy(source_full_path, target_full_path)  # 改为copy，不保留元数据
            
        logging.info(f"Copied: {source_full_path} -> {target_full_path}")
        
        return web.json_response({
            "success": True,
            "new_path": os.path.relpath(target_full_path, workflows_dir).replace('\\', '/')
        })
        
    except Exception as e:
        logging.error(f"Failed to copy: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.get("/workflow-manager/read-workflow")
async def read_workflow(request):
    """读取工作流文件内容"""
    try:
        workflow_path = request.query.get('path', '').strip()
        
        if not workflow_path:
            return web.json_response({"success": False, "error": "工作流路径不能为空"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        full_path = os.path.join(workflows_dir, workflow_path)
        
        if not is_safe_path(workflows_dir, full_path):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(full_path):
            return web.json_response({"success": False, "error": "工作流文件不存在"}, status=404)
        
        with open(full_path, 'r', encoding='utf-8') as f:
            workflow_data = json.load(f)
        
        return web.json_response({
            "success": True,
            "workflow": workflow_data
        })
        
    except Exception as e:
        logging.error(f"Failed to read workflow: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

def setup():
    print(f"🚀 ComfyUI Workflow Manager v{__version__} loaded!")
    print("📁 Features:")
    print("   • Complete file system operations (create, rename, move, copy, delete)")
    print("   • Directory browsing with breadcrumb navigation")
    print("   • Workflow file management and preview")
    print("   • Drag-and-drop interface")
    print(f"   • Workflows directory: {get_workflows_directory()}")
    
    # 确保工作流目录存在
    try:
        workflows_dir = ensure_workflows_directory()
        print(f"   ✅ Workflows directory ready: {workflows_dir}")
    except Exception as e:
        print(f"   ❌ Failed to setup workflows directory: {e}")

setup() 
