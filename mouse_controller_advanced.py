import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import time
import re
import json
import os
import pyautogui
from pynput import keyboard

class MouseController:
    def __init__(self, root):
        self.root = root
        self.root.title("鼠标控制器 - 高级版")
        self.root.geometry("800x1100")
        
        # 控制状态
        self.is_running = False
        self.is_recording = False
        self.script_thread = None
        self.keyboard_listener = None
        
        # 坐标记录
        self.coordinates = {}
        self.current_record_index = 1
        self.coordinates_file = "coordinates.json"
        
        # 加载保存的坐标
        self.load_coordinates()
        
        # 创建界面
        self.create_widgets()
        
        # 设置热键监听
        self.setup_hotkeys()
        
    def create_widgets(self):
        # 创建主标签页
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # 主控制页面
        self.main_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.main_frame, text="鼠标控制")
        
        # 坐标管理页面
        self.coords_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.coords_frame, text="坐标管理")
        
        # 创建主控制页面内容
        self.create_main_page()
        
        # 创建坐标管理页面内容
        self.create_coords_page()
        
    def create_main_page(self):
        # 标题
        title_label = ttk.Label(self.main_frame, text="鼠标控制器 - 高级版", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20))
        
        # 控制按钮框架
        button_frame = ttk.Frame(self.main_frame)
        button_frame.grid(row=1, column=0, columnspan=2, pady=(0, 10), sticky=(tk.W, tk.E))
        
        # 启动按钮
        self.start_button = ttk.Button(button_frame, text="启动 (Q)", command=self.start_script)
        self.start_button.grid(row=0, column=0, padx=(0, 10))
        
        # 停止按钮
        self.stop_button = ttk.Button(button_frame, text="停止 (E)", command=self.stop_script, state="disabled")
        self.stop_button.grid(row=0, column=1, padx=(0, 10))
        
        # 记录坐标按钮
        self.record_button = ttk.Button(button_frame, text="记录坐标 (R)", command=self.toggle_recording)
        self.record_button.grid(row=0, column=2)
        
        # 状态标签
        self.status_label = ttk.Label(button_frame, text="状态: 等待启动", foreground="blue")
        self.status_label.grid(row=0, column=3, padx=(20, 0))
        
        # 记录状态标签
        self.record_status_label = ttk.Label(button_frame, text="记录: 未开始", foreground="gray")
        self.record_status_label.grid(row=0, column=4, padx=(20, 0))
        
        # 脚本输入区域
        script_frame = ttk.LabelFrame(self.main_frame, text="脚本输入", padding="5")
        script_frame.grid(row=2, column=0, columnspan=2, pady=(0, 10), sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 脚本输入文本框
        self.script_text = scrolledtext.ScrolledText(script_frame, width=80, height=15, font=("Consolas", 10))
        self.script_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 命令说明区域
        help_frame = ttk.LabelFrame(self.main_frame, text="命令说明", padding="5")
        help_frame.grid(row=3, column=0, columnspan=2, pady=(10, 0), sticky=(tk.W, tk.E, tk.N, tk.S))
        
        help_text = """可用命令:
- move x y [duration]     移动鼠标到坐标(x,y)，可选持续时间(秒)
- move coordX             移动到记录的坐标X (coord1-coord18)
- click [button] [count]  鼠标点击，button: left/right/middle，count: 点击次数
- wheel [direction] [amount] 滚轮滚动，direction: up/down，amount: 滚动量
- wait seconds            等待指定秒数
- # comment               注释行

热键控制:
- Q键: 启动脚本执行
- E键: 停止脚本执行
- R键: 开始/停止记录坐标"""
        
        help_label = ttk.Label(help_frame, text=help_text, font=("Consolas", 9), justify=tk.LEFT)
        help_label.grid(row=0, column=0, sticky=tk.W)
        
        # 日志输出区域
        log_frame = ttk.LabelFrame(self.main_frame, text="执行日志", padding="5")
        log_frame.grid(row=4, column=0, columnspan=2, pady=(10, 0), sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.log_text = scrolledtext.ScrolledText(log_frame, width=80, height=8, font=("Consolas", 9))
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.log_text.config(state="disabled")
        
        # 配置网格权重
        self.main_frame.columnconfigure(0, weight=1)
        self.main_frame.rowconfigure(2, weight=1)
        self.main_frame.rowconfigure(4, weight=1)
        script_frame.columnconfigure(0, weight=1)
        script_frame.rowconfigure(0, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
    def create_coords_page(self):
        # 标题
        title_label = ttk.Label(self.coords_frame, text="坐标管理", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # 坐标编辑框架
        coords_edit_frame = ttk.LabelFrame(self.coords_frame, text="坐标编辑", padding="5")
        coords_edit_frame.grid(row=1, column=0, columnspan=3, pady=(0, 10), sticky=(tk.W, tk.E))
        
        # 创建坐标输入框
        self.coord_entries = {}
        for i in range(1, 19):
            row = (i - 1) // 6
            col = (i - 1) % 6
            
            coord_label = ttk.Label(coords_edit_frame, text=f"坐标{i}:")
            coord_label.grid(row=row*2, column=col, padx=(10, 5), pady=5, sticky=tk.W)
            
            coord_frame = ttk.Frame(coords_edit_frame)
            coord_frame.grid(row=row*2+1, column=col, padx=10, pady=5, sticky=tk.W)
            
            x_label = ttk.Label(coord_frame, text="X:")
            x_label.grid(row=0, column=0)
            
            x_entry = ttk.Entry(coord_frame, width=6)
            x_entry.grid(row=0, column=1, padx=(2, 5))
            
            y_label = ttk.Label(coord_frame, text="Y:")
            y_label.grid(row=0, column=2)
            
            y_entry = ttk.Entry(coord_frame, width=6)
            y_entry.grid(row=0, column=3, padx=(2, 0))
            
            self.coord_entries[f"coord{i}"] = {'x': x_entry, 'y': y_entry}
            
            # 设置当前坐标值
            if f"coord{i}" in self.coordinates:
                x_entry.insert(0, str(self.coordinates[f"coord{i}"][0]))
                y_entry.insert(0, str(self.coordinates[f"coord{i}"][1]))
        
        # 按钮框架
        coords_button_frame = ttk.Frame(self.coords_frame)
        coords_button_frame.grid(row=2, column=0, columnspan=3, pady=10)
        
        # 保存坐标按钮
        save_button = ttk.Button(coords_button_frame, text="保存坐标", command=self.save_coordinates)
        save_button.grid(row=0, column=0, padx=(0, 10))
        
        # 清空坐标按钮
        clear_button = ttk.Button(coords_button_frame, text="清空坐标", command=self.clear_coordinates)
        clear_button.grid(row=0, column=1, padx=(0, 10))
        
        # 获取当前坐标按钮
        get_current_button = ttk.Button(coords_button_frame, text="获取当前坐标", command=self.get_current_position)
        get_current_button.grid(row=0, column=2)
        
        # 坐标使用说明
        usage_frame = ttk.LabelFrame(self.coords_frame, text="坐标使用说明", padding="5")
        usage_frame.grid(row=3, column=0, columnspan=3, pady=(10, 0), sticky=(tk.W, tk.E, tk.N, tk.S))
        
        usage_text = """使用方法:
1. 手动输入坐标: 在对应的X/Y框中输入坐标值
2. 自动记录坐标: 在主页面按R键开始记录，移动鼠标到目标位置后按R键记录
3. 获取当前坐标: 点击"获取当前坐标"按钮获取鼠标当前位置
4. 在脚本中使用: move coord1, move coord2, ... move coord18

坐标记录流程:
- 按R键开始记录
- 移动鼠标到第一个目标位置
- 按R键记录为coord1
- 移动鼠标到第二个目标位置
- 按R键记录为coord2
- ...最多记录18个坐标"""
        
        usage_label = ttk.Label(usage_frame, text=usage_text, font=("Consolas", 9), justify=tk.LEFT)
        usage_label.grid(row=0, column=0, sticky=tk.W)
        
        # 配置网格权重
        self.coords_frame.columnconfigure(0, weight=1)
        self.coords_frame.rowconfigure(3, weight=1)
        
    def setup_hotkeys(self):
        """设置热键监听"""
        def on_press(key):
            try:
                if hasattr(key, 'char'):
                    if key.char == 'q' or key.char == 'Q':
                        self.root.after(0, self.start_script)
                    elif key.char == 'e' or key.char == 'E':
                        self.root.after(0, self.stop_script)
                    elif key.char == 'r' or key.char == 'R':
                        self.root.after(0, self.toggle_recording)
            except AttributeError:
                pass
        
        self.keyboard_listener = keyboard.Listener(on_press=on_press)
        self.keyboard_listener.daemon = True
        self.keyboard_listener.start()
        
        self.log_message("键盘监听已启动: Q键启动, E键停止, R键记录坐标")
        
    def load_coordinates(self):
        """加载保存的坐标"""
        if os.path.exists(self.coordinates_file):
            try:
                with open(self.coordinates_file, 'r', encoding='utf-8') as f:
                    self.coordinates = json.load(f)
            except:
                self.coordinates = {}
        else:
            self.coordinates = {}
            
    def save_coordinates(self):
        """保存坐标到文件"""
        try:
            # 从输入框获取坐标值
            for coord_name, entries in self.coord_entries.items():
                x_text = entries['x'].get().strip()
                y_text = entries['y'].get().strip()
                
                if x_text and y_text:
                    try:
                        x = int(x_text)
                        y = int(y_text)
                        self.coordinates[coord_name] = [x, y]
                    except ValueError:
                        pass
            
            with open(self.coordinates_file, 'w', encoding='utf-8') as f:
                json.dump(self.coordinates, f, ensure_ascii=False, indent=2)
            
            messagebox.showinfo("成功", "坐标已保存")
            self.log_message("坐标已保存到文件")
            
        except Exception as e:
            messagebox.showerror("错误", f"保存坐标失败: {str(e)}")
            
    def clear_coordinates(self):
        """清空坐标"""
        if messagebox.askyesno("确认", "确定要清空所有坐标吗？"):
            self.coordinates = {}
            for entries in self.coord_entries.values():
                entries['x'].delete(0, tk.END)
                entries['y'].delete(0, tk.END)
            self.save_coordinates()
            
    def get_current_position(self):
        """获取当前鼠标位置"""
        x, y = pyautogui.position()
        messagebox.showinfo("当前坐标", f"X: {x}, Y: {y}")
        
    def toggle_recording(self):
        """切换坐标记录状态"""
        if not self.is_recording:
            # 开始记录
            self.is_recording = True
            self.current_record_index = 1
            self.record_button.config(text="停止记录 (R)")
            self.record_status_label.config(text=f"记录: 准备记录坐标1", foreground="orange")
            self.log_message("开始记录坐标，移动鼠标到目标位置后按R键记录")
        else:
            # 记录当前坐标
            x, y = pyautogui.position()
            coord_name = f"coord{self.current_record_index}"
            self.coordinates[coord_name] = [x, y]
            
            # 更新输入框
            if coord_name in self.coord_entries:
                entries = self.coord_entries[coord_name]
                entries['x'].delete(0, tk.END)
                entries['x'].insert(0, str(x))
                entries['y'].delete(0, tk.END)
                entries['y'].insert(0, str(y))
            
            self.log_message(f"记录{coord_name}: ({x}, {y})")
            
            if self.current_record_index < 18:
                self.current_record_index += 1
                self.record_status_label.config(text=f"记录: 准备记录坐标{self.current_record_index}", foreground="orange")
            else:
                # 记录完成
                self.is_recording = False
                self.record_button.config(text="记录坐标 (R)")
                self.record_status_label.config(text="记录: 已完成", foreground="green")
                self.log_message("坐标记录完成，已记录18个坐标")
                
    def log_message(self, message):
        """添加日志消息"""
        self.log_text.config(state="normal")
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state="disabled")
        self.root.update()
        
    def parse_script(self, script_text):
        """解析脚本文本"""
        commands = []
        lines = script_text.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
                
            # 解析命令
            parts = re.split(r'\s+', line, maxsplit=1)
            command = parts[0].lower()
            
            if len(parts) > 1:
                args_str = parts[1]
            else:
                args_str = ""
                
            commands.append({
                'line': line_num,
                'command': command,
                'args_str': args_str,
                'original': line
            })
            
        return commands
    
    def execute_command(self, command_info):
        """执行单个命令"""
        command = command_info['command']
        args_str = command_info['args_str']
        
        try:
            if command == 'move':
                args = args_str.split()
                if len(args) == 0:
                    raise ValueError("move命令需要参数")
                
                # 检查是否是坐标名称
                if args[0].startswith('coord') and args[0][5:].isdigit():
                    coord_name = args[0]
                    if coord_name in self.coordinates:
                        x, y = self.coordinates[coord_name]
                        duration = float(args[1]) if len(args) > 1 else 0.5
                        self.log_message(f"移动到{coord_name}: ({x}, {y})，持续时间: {duration}秒")
                        pyautogui.moveTo(x, y, duration=duration)
                    else:
                        raise ValueError(f"未找到坐标: {coord_name}")
                else:
                    # 常规坐标移动
                    if len(args) < 2:
                        raise ValueError("move命令需要x和y参数")
                    
                    x = int(args[0])
                    y = int(args[1])
                    duration = float(args[2]) if len(args) > 2 else 0.5
                    
                    self.log_message(f"移动鼠标到 ({x}, {y})，持续时间: {duration}秒")
                    pyautogui.moveTo(x, y, duration=duration)
                
            elif command == 'click':
                # click [button] [count]
                args = args_str.split()
                button = args[0] if len(args) > 0 else 'left'
                count = int(args[1]) if len(args) > 1 else 1
                
                self.log_message(f"鼠标{button}点击 {count}次")
                pyautogui.click(button=button, clicks=count)
                
            elif command == 'wheel':
                # wheel [direction] [amount]
                args = args_str.split()
                direction = args[0] if len(args) > 0 else 'down'
                amount = int(args[1]) if len(args) > 1 else 1
                
                if direction == 'up':
                    amount = -amount
                
                self.log_message(f"滚轮滚动 {amount}")
                pyautogui.scroll(amount)
                
            elif command == 'wait':
                # wait seconds
                seconds = float(args_str) if args_str else 1.0
                self.log_message(f"等待 {seconds}秒")
                time.sleep(seconds)
                
            else:
                raise ValueError(f"未知命令: {command}")
                
        except Exception as e:
            raise ValueError(f"第{command_info['line']}行执行错误: {str(e)}")
    
    def execute_script(self):
        """执行脚本"""
        try:
            script_text = self.script_text.get("1.0", tk.END).strip()
            commands = self.parse_script(script_text)
            
            if not commands:
                self.log_message("脚本为空或只包含注释")
                self.script_completed()
                return
                
            self.log_message(f"开始执行脚本，共{len(commands)}条命令")
            
            # 顺序执行命令
            for i, cmd in enumerate(commands):
                if not self.is_running:
                    break
                self.execute_command(cmd)
                    
            if self.is_running:
                self.log_message("脚本执行完成")
                self.script_completed()
            else:
                self.log_message("脚本被用户停止")
                
        except Exception as e:
            self.log_message(f"执行错误: {str(e)}")
            messagebox.showerror("执行错误", str(e))
            self.script_completed()
    
    def script_completed(self):
        """脚本执行完成后的处理"""
        self.is_running = False
        self.start_button.config(state="normal")
        self.stop_button.config(state="disabled")
        self.status_label.config(text="状态: 执行完成，等待重新启动", foreground="green")
        
        self.log_message("脚本执行完成，程序等待重新启动...")
        self.log_message("修改脚本后按启动按钮或Q键重新执行")
    
    def start_script(self):
        """启动脚本执行"""
        if self.is_running:
            messagebox.showwarning("警告", "脚本已经在运行中")
            return
            
        self.is_running = True
        self.start_button.config(state="disabled")
        self.stop_button.config(state="normal")
        self.status_label.config(text="状态: 运行中", foreground="orange")
        
        self.log_message("=== 启动脚本执行 ===")
        
        # 在新线程中执行脚本
        self.script_thread = threading.Thread(target=self.execute_script)
        self.script_thread.daemon = True
        self.script_thread.start()
    
    def stop_script(self):
        """停止脚本执行"""
        if not self.is_running:
            return
            
        self.is_running = False
        self.start_button.config(state="normal")
        self.stop_button.config(state="disabled")
        self.status_label.config(text="状态: 已停止", foreground="red")
        
        self.log_message("=== 停止脚本执行 ===")
    
    def on_closing(self):
        """程序关闭时的清理"""
        self.stop_script()
        if self.keyboard_listener:
            self.keyboard_listener.stop()
        self.root.destroy()

def main():
    # 检查依赖
    try:
        import pyautogui
        import pynput
    except ImportError as e:
        print(f"缺少依赖库: {e}")
        print("请安装: pip install pyautogui pynput")
        return
    
    root = tk.Tk()
    app = MouseController(root)
    
    # 设置关闭事件
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    
    # 启动GUI
    root.mainloop()

if __name__ == "__main__":
    main()