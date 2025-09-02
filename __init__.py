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

def get_config_path():
    """获取配置文件路径"""
    plugin_dir = os.path.dirname(__file__)
    return os.path.join(plugin_dir, '.workflow_manager_config.json')

def load_config():
    """加载配置文件"""
    config_path = get_config_path()
    default_config = {
        'viewMode': 'list',  # 默认列表视图
        'sortBy': 'name',
        'sortOrder': 'asc'
    }
    
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # 合并默认配置，确保所有配置项都存在
                return {**default_config, **config}
        else:
            return default_config
    except Exception as e:
        logging.warning(f"Failed to load config: {e}")
        return default_config

def save_config(config):
    """保存配置文件"""
    try:
        config_path = get_config_path()
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error(f"Failed to save config: {e}")
        return False

def is_safe_path(base_path, target_path):
    """检查路径是否安全，防止目录遍历攻击"""
    base_path = os.path.abspath(base_path)
    target_path = os.path.abspath(target_path)
    return target_path.startswith(base_path)

@PromptServer.instance.routes.post("/workflow-manager/save-view-mode")
async def save_view_mode(request):
    """保存视图模式"""
    try:
        data = await request.json()
        view_mode = data.get('viewMode', 'list')
        
        # 加载现有配置
        config = load_config()
        config['viewMode'] = view_mode
        
        success = save_config(config)
        
        if success:
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "保存视图模式失败"}, status=500)
            
    except Exception as e:
        logging.error(f"Failed to save view mode: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

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
            "items": items,
            "config": load_config()  # 添加配置信息
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
        sync_preview = data.get('sync_preview', True)  # 默认同步重命名预览图
        
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
        
        # 如果是JSON工作流文件，查找并准备重命名预览图文件
        preview_files_to_rename = []
        if sync_preview and not os.path.isdir(old_full_path) and old_path.lower().endswith('.json'):
            preview_extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp']
            old_base_path = os.path.splitext(old_full_path)[0]
            
            # 确保新名称包含.json扩展名
            if not new_name.lower().endswith('.json'):
                new_name_with_ext = new_name + '.json'
                new_full_path = os.path.join(parent_dir, new_name_with_ext)
            else:
                new_name_with_ext = new_name
                
            new_base_path = os.path.splitext(new_full_path)[0]
            
            for ext in preview_extensions:
                old_preview_path = old_base_path + ext
                if os.path.exists(old_preview_path):
                    new_preview_path = new_base_path + ext
                    preview_files_to_rename.append((old_preview_path, new_preview_path))
        
        # 重命名主文件或文件夹
        os.rename(old_full_path, new_full_path)
        logging.info(f"Renamed: {old_full_path} -> {new_full_path}")
        
        # 重命名对应的预览图文件
        for old_preview, new_preview in preview_files_to_rename:
            try:
                os.rename(old_preview, new_preview)
                logging.info(f"Renamed preview: {old_preview} -> {new_preview}")
            except Exception as e:
                logging.warning(f"Failed to rename preview {old_preview}: {e}")
        
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
        sync_preview = data.get('sync_preview', True)  # 默认同步删除预览图
        
        if not item_path:
            return web.json_response({"success": False, "error": "路径不能为空"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        full_path = os.path.join(workflows_dir, item_path)
        
        if not is_safe_path(workflows_dir, full_path):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(full_path):
            return web.json_response({"success": False, "error": "文件或文件夹不存在"}, status=404)
        
        # 如果是JSON工作流文件，记录预览图路径
        preview_files_to_delete = []
        if sync_preview and not os.path.isdir(full_path) and item_path.lower().endswith('.json'):
            # 查找对应的预览图文件
            preview_extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp']
            base_path = os.path.splitext(full_path)[0]
            
            for ext in preview_extensions:
                preview_path = base_path + ext
                if os.path.exists(preview_path):
                    preview_files_to_delete.append(preview_path)
        
        # 删除主文件或文件夹
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
            
        logging.info(f"Deleted: {full_path}")
        
        # 删除对应的预览图文件
        for preview_path in preview_files_to_delete:
            try:
                os.remove(preview_path)
                logging.info(f"Deleted preview: {preview_path}")
            except Exception as e:
                logging.warning(f"Failed to delete preview {preview_path}: {e}")
        
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
        sync_preview = data.get('sync_preview', True)  # 默认同步移动预览图
        
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
        
        # 如果是JSON工作流文件，查找并准备移动预览图文件
        preview_files_to_move = []
        if sync_preview and not os.path.isdir(source_full_path) and source_path.lower().endswith('.json'):
            preview_extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp']
            source_base_path = os.path.splitext(source_full_path)[0]
            target_base_path = os.path.splitext(target_full_path)[0]
            
            for ext in preview_extensions:
                source_preview_path = source_base_path + ext
                if os.path.exists(source_preview_path):
                    target_preview_path = target_base_path + ext
                    preview_files_to_move.append((source_preview_path, target_preview_path))
        
        # 移动主文件或文件夹
        shutil.move(source_full_path, target_full_path)
        logging.info(f"Moved: {source_full_path} -> {target_full_path}")
        
        # 移动对应的预览图文件
        for source_preview, target_preview in preview_files_to_move:
            try:
                shutil.move(source_preview, target_preview)
                logging.info(f"Moved preview: {source_preview} -> {target_preview}")
            except Exception as e:
                logging.warning(f"Failed to move preview {source_preview}: {e}")
        
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
        sync_preview = data.get('sync_preview', True)  # 默认同步复制预览图
        
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
        original_target_full_path = target_full_path
        while os.path.exists(target_full_path):
            if ext:
                new_name = f"{base_name}_copy{counter}{ext}"
            else:
                new_name = f"{base_name}_copy{counter}"
            target_full_path = os.path.join(target_full_dir, new_name)
            counter += 1
        
        # 如果是JSON工作流文件，查找并准备复制预览图文件
        preview_files_to_copy = []
        if sync_preview and not os.path.isdir(source_full_path) and source_path.lower().endswith('.json'):
            preview_extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp']
            source_base_path = os.path.splitext(source_full_path)[0]
            target_base_path = os.path.splitext(target_full_path)[0]
            
            for ext_preview in preview_extensions:
                source_preview_path = source_base_path + ext_preview
                if os.path.exists(source_preview_path):
                    target_preview_path = target_base_path + ext_preview
                    preview_files_to_copy.append((source_preview_path, target_preview_path))
        
        # 复制主文件或文件夹
        if os.path.isdir(source_full_path):
            shutil.copytree(source_full_path, target_full_path)
        else:
            shutil.copy(source_full_path, target_full_path)  # 改为copy，不保留元数据
            
        logging.info(f"Copied: {source_full_path} -> {target_full_path}")
        
        # 复制对应的预览图文件
        for source_preview, target_preview in preview_files_to_copy:
            try:
                shutil.copy(source_preview, target_preview)
                logging.info(f"Copied preview: {source_preview} -> {target_preview}")
            except Exception as e:
                logging.warning(f"Failed to copy preview {source_preview}: {e}")
        
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

@PromptServer.instance.routes.get("/workflow-manager/preview")
async def get_workflow_preview(request):
    """获取工作流预览图"""
    try:
        path = request.query.get('path', '').strip()
        if not path:
            return web.Response(status=400, text='Path is required')
        
        workflows_dir = ensure_workflows_directory()
        
        # 构建预览图路径（将.json替换为.webp）
        preview_path = os.path.join(workflows_dir, path.replace('.json', '.webp'))
        
        # 检查文件是否存在
        if os.path.exists(preview_path):
            # 读取webp文件
            with open(preview_path, 'rb') as f:
                content = f.read()
            
            # 返回webp图片，设置缓存头 - 禁用缓存
            return web.Response(
                body=content,
                content_type='image/webp',
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',  # 禁用缓存
                    'Pragma': 'no-cache',  # HTTP/1.0兼容
                    'Expires': '0',  # 立即过期
                    'Access-Control-Allow-Origin': '*'
                }
            )
        else:
            # 预览图不存在，尝试查找其他格式
            # 尝试其他图片格式
            base_path = os.path.splitext(preview_path)[0]
            alternative_formats = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
            
            for ext in alternative_formats:
                alt_path = base_path + ext
                if os.path.exists(alt_path):
                    # 确定正确的content-type
                    content_type_map = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.bmp': 'image/bmp'
                    }
                    
                    content_type = content_type_map.get(ext, 'image/png')
                    
                    with open(alt_path, 'rb') as f:
                        content = f.read()
                    
                    return web.Response(
                        body=content,
                        content_type=content_type,
                        headers={
                            'Cache-Control': 'no-cache, no-store, must-revalidate',  # 禁用缓存
                            'Pragma': 'no-cache',  # HTTP/1.0兼容
                            'Expires': '0',  # 立即过期
                            'Access-Control-Allow-Origin': '*'
                        }
                    )
            
            # 如果都没有找到，返回404
            return web.Response(status=404, text='Preview not found')
                
    except Exception as e:
        logging.error(f"Failed to serve preview: {e}")
        return web.Response(status=500, text='Internal server error')

@PromptServer.instance.routes.post("/workflow-manager/upload-preview")
async def upload_workflow_preview(request):
    """上传工作流预览图"""
    try:
        data = await request.post()
        workflow_path = data.get('workflow_path', '').strip()
        preview_file = data.get('preview_file')
        
        if not workflow_path or not preview_file:
            return web.json_response({"success": False, "error": "参数不完整"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        workflow_full_path = os.path.join(workflows_dir, workflow_path)
        
        if not is_safe_path(workflows_dir, workflow_full_path):
            return web.json_response({"success": False, "error": "无效的路径"}, status=400)
        
        if not os.path.exists(workflow_full_path):
            return web.json_response({"success": False, "error": "工作流文件不存在"}, status=404)
        
        # 构建预览图路径（将.json替换为.webp）
        preview_path = workflow_full_path.replace('.json', '.webp')
        
        # 保存预览图文件
        with open(preview_path, 'wb') as f:
            f.write(preview_file.file.read())
        
        logging.info(f"Uploaded preview for: {workflow_path}")
        
        return web.json_response({"success": True})
        
    except Exception as e:
        logging.error(f"Failed to upload preview: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/workflow-manager/upload-workflow")
async def upload_workflow_file(request):
    """上传工作流文件"""
    try:
        reader = await request.multipart()
        workflow_files = []
        target_dir = ''
        create_dirs = False
        
        # 解析multipart数据
        field = await reader.next()
        while field is not None:
            if field.name == 'target_dir':
                target_dir = (await field.read()).decode('utf-8').strip()
            elif field.name == 'create_dirs':
                create_dirs = (await field.read()).decode('utf-8').strip().lower() == 'true'
            elif field.name == 'workflow_files':
                if hasattr(field, 'filename') and field.filename:
                    # 验证文件扩展名
                    if not field.filename.lower().endswith('.json'):
                        return web.json_response({
                            "success": False, 
                            "error": f"不支持的文件类型: {field.filename}。只支持.json文件"
                        }, status=400)
                    
                    # 读取文件内容
                    content = await field.read()
                    
                    # 验证JSON格式
                    try:
                        json.loads(content.decode('utf-8'))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        return web.json_response({
                            "success": False, 
                            "error": f"无效的JSON文件: {field.filename}"
                        }, status=400)
                    
                    workflow_files.append({
                        'filename': field.filename,
                        'content': content
                    })
            
            field = await reader.next()
        
        if not workflow_files:
            return web.json_response({"success": False, "error": "没有有效的工作流文件"}, status=400)
        
        workflows_dir = ensure_workflows_directory()
        
        # 确定目标目录
        if target_dir:
            target_full_dir = os.path.join(workflows_dir, target_dir)
        else:
            target_full_dir = workflows_dir
        
        # 安全检查
        if not is_safe_path(workflows_dir, target_full_dir):
            return web.json_response({"success": False, "error": "无效的目标路径"}, status=400)
        
        # 如果允许创建目录且目录不存在，则创建它
        if create_dirs and not os.path.exists(target_full_dir):
            try:
                os.makedirs(target_full_dir, exist_ok=True)
                logging.info(f"Created directory: {target_full_dir}")
            except Exception as e:
                return web.json_response({
                    "success": False, 
                    "error": f"无法创建目录 {target_dir}: {str(e)}"
                }, status=500)
        
        # 确保目标目录存在
        if not os.path.exists(target_full_dir):
            return web.json_response({"success": False, "error": "目标目录不存在"}, status=404)
        
        uploaded_files = []
        errors = []
        
        for file_info in workflow_files:
            filename = file_info['filename']
            content = file_info['content']
            
            # 构建目标文件路径
            target_file_path = os.path.join(target_full_dir, filename)
            
            # 如果文件已存在，自动重命名
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(target_file_path):
                new_filename = f"{base_name}_{counter}{ext}"
                target_file_path = os.path.join(target_full_dir, new_filename)
                counter += 1
            
            try:
                # 保存文件
                with open(target_file_path, 'wb') as f:
                    f.write(content)
                
                final_filename = os.path.basename(target_file_path)
                relative_path = os.path.relpath(target_file_path, workflows_dir).replace('\\', '/')
                
                uploaded_files.append({
                    'filename': final_filename,
                    'path': relative_path
                })
                
                logging.info(f"Uploaded workflow file: {target_file_path}")
                
            except Exception as e:
                errors.append(f"{filename}: {str(e)}")
                logging.error(f"Failed to save workflow file {filename}: {e}")
        
        if uploaded_files:
            message = f"成功上传 {len(uploaded_files)} 个工作流文件"
            if errors:
                message += f"，{len(errors)} 个失败"
            
            return web.json_response({
                "success": True,
                "message": message,
                "uploaded_files": uploaded_files,
                "uploaded": len(uploaded_files),
                "errors": errors
            })
        else:
            return web.json_response({
                "success": False, 
                "error": f"所有文件上传失败: {'; '.join(errors)}"
            }, status=500)
        
    except Exception as e:
        logging.error(f"Failed to upload workflow files: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

def setup():
    print(f"🚀 ComfyUI Workflow Manager v{__version__} loaded!")
    
    # 确保工作流目录存在
    try:
        workflows_dir = ensure_workflows_directory()
        print(f"   ✅ Workflows directory ready: {workflows_dir}")
    except Exception as e:
        print(f"   ❌ Failed to setup workflows directory: {e}")

setup() 
