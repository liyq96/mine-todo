# Mine ToDo

一个基于 `Go + Wails + React + SQLite` 的本地桌面待办应用，当前优先面向 Windows 使用，同时保持对 macOS 的兼容。

当前发布版本：`v1.0.0`

## 当前功能

- 本地 SQLite 存储，不依赖云端
- 左侧待办列表、右侧详情查看与编辑
- 快速新建、编辑、删除、完成状态切换
- Markdown 详情编辑与预览
- 编辑态自动保存
- 设置弹窗，包含 `数据 / 语言 / 关于` 三个 tab
- 数据目录原生选择器
- 切换数据目录时可选：
  - 迁移旧数据
  - 使用空数据
- 中英文界面切换

## 技术栈

- 后端：Go `1.22`
- 桌面容器：Wails `v2`
- 前端：React 18 + TypeScript + Vite
- 数据库：SQLite（`modernc.org/sqlite`）
- Markdown 渲染：`marked` + `dompurify`

## 目录结构

```text
.
├─ app.go                     # Wails 绑定方法
├─ main.go                    # 桌面应用入口
├─ internal
│  ├─ config                  # 本地配置管理
│  └─ store                   # SQLite 访问与 Todo 仓储
├─ frontend
│  ├─ src
│  │  ├─ lib                  # Wails 前端调用封装
│  │  ├─ App.tsx              # 主界面与交互
│  │  ├─ styles.css           # 样式
│  │  └─ types.ts             # 前端类型定义
│  └─ package.json
├─ docs
│  └─ usage.md                # 使用说明
├─ build
│  ├─ appicon.png             # 应用图标源文件
│  └─ windows                 # Windows 打包资源
└─ wails.json
```

## 本地开发

前提：

- Go `1.22.x`
- Node.js `20+`
- Wails CLI

安装 Wails CLI：

```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

启动开发环境：

```powershell
go mod tidy
cd frontend
npm install
cd ..
wails dev
```

## 打包

```powershell
wails build
```

Windows 默认输出：

```text
build/bin/mine-todo.exe
```

设置页 `关于` 模块当前显示版本：`1.0.0`

## 配置与数据

配置文件默认位于用户配置目录下的 `mine-todo/config.json`，包含：

- `storageDir`：SQLite 数据目录
- `dbPath`：数据库文件完整路径
- `language`：界面语言，当前支持 `zh-CN` / `en-US`

默认数据库文件名为 `todo.db`。

切换数据目录时，应用不会再静默复制旧数据，而是让用户选择：

- `迁移旧数据`
- `使用空数据`


## 开源合规

当前使用的技术与素材均为免费开源方案：

- Wails：MIT
- React：MIT
- marked：MIT
- DOMPurify：Apache-2.0
- modernc.org/sqlite：BSD 风格许可

未引入商业授权组件、闭源 SDK 或侵权素材。

## 文档

- [使用文档](./docs/usage.md)
