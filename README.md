# Mine ToDo

一个基于 `Go + Wails + React + SQLite` 的本地桌面待办应用，当前优先面向 Windows 使用，同时保持对 macOS 的兼容。

当前发布版本：`v1.0.0`

## 当前功能

- 本地 SQLite 存储，不依赖云端
- 左侧待办列表、右侧详情查看与编辑
- 快速新建、编辑、删除、完成状态切换
- 子项待办管理，支持编辑态新增、修改、勾选与批量删除
- 待办日期字段，支持为空并参与本地日历视图展示
- 日历看板，支持本地公历月视图与周视图，并按日期查看待办
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
- 可访问性原语：`@radix-ui/react-dialog` / `-popover` / `-radio-group`（无样式原语，不引入整框 UI 库）
- 数据库：SQLite（`modernc.org/sqlite`）
- Markdown 渲染：`marked` + `dompurify`

## 目录结构

```text
.
├─ app.go                      # Wails 绑定方法（前后端桥接层）
├─ main.go                     # 桌面应用入口
├─ internal
│  ├─ config                   # 本地配置管理（config.json）
│  └─ store                    # SQLite 访问与 Todo/Group/Subitem 仓储
├─ frontend
│  ├─ src
│  │  ├─ App.tsx               # 顶层编排组件
│  │  ├─ main.tsx              # React 挂载入口
│  │  ├─ appMessages.ts        # 中英文文案 (i18n)
│  │  ├─ appTypes.ts           # 通用字面量类型 (Locale / Tab / View)
│  │  ├─ types.ts              # 与后端对齐的领域模型类型
│  │  ├─ styles.css            # 全局样式
│  │  ├─ lib                   # Wails 调用封装与纯函数工具 (wails/date/todos)
│  │  ├─ hooks                 # 业务状态 hook (按职责拆分)
│  │  └─ features              # 展示组件，按功能域拆分
│  │     ├─ _primitives/        # Radix 原语语义封装 (Modal 等)
│  │     ├─ calendar/          # 日历看板、日期选择
│  │     ├─ settings/          # 设置弹窗
│  │     └─ todos/             # 侧栏列表、详情面板、删除确认
│  └─ package.json
├─ docs
│  └─ usage.md                 # 使用说明
├─ build
│  ├─ appicon.png              # 应用图标源文件
│  └─ windows                  # Windows 打包资源
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
