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
- 设置弹窗，包含 `数据 / 语言 / 快捷键 / 关于` 四个 tab
- 数据目录原生选择器
- 切换数据目录时可选：
  - 迁移现有数据
  - 打开目标目录（打开已有数据库，或创建空数据库）
- 中英文界面切换
- 独立笔记工作区，支持 Markdown 编辑、预览、自动保存与本地删除
- 笔记详情提供“导入/导出”菜单：导入支持 Markdown，导出支持 Markdown、Word（`.docx`）和 PDF。导入 `.md` / `.markdown` 文件时以文件名为标题新建笔记，文件中的全部内容（包括标题、元数据、代码块等）均保留为正文，同名笔记不会覆盖；导出先保存当前编辑，所有格式均包含笔记标题与完整正文；没有笔记时也可从详情空白页导入
- Word、PDF 导出转换正文中的标题、列表、加粗、删除线、代码块和表格，PDF 内置 Noto Sans SC 中文字体并自动分页，跨页表格重复表头；图片保留描述与来源地址，不下载外部图片。生成文件不依赖安装 Word、打印机或在线服务；字体许可证见 `internal/notedoc/fonts/OFL.txt`
- Markdown 导入支持 UTF-8（含 BOM），单文件最大 16 MB；标签、关联和置顶等应用元数据不包含在 Markdown 文件中
- 分组完成进度、色签和更清晰的待办信息层级
- 待办与笔记统一搜索、标签筛选，以及今天 / 未来 7 天 / 逾期 / 无日期 / 已完成智能视图
- `Ctrl+K`（macOS 为 `Command+K`）全局搜索，支持类型标识、正文匹配高亮与键盘导航
- 设置页提供只读快捷键总览
- 待办优先级、待办日期与系统提醒
- 待办与笔记双向关联，笔记支持 `[[笔记标题]]` 内链和反向链接
- 笔记置顶、收藏、归档；待办收藏与归档
- 本地回收站、删除撤销、恢复、永久删除与一键清空；回收站内容默认保留 30 天

## 技术栈

- 后端：Go `1.22`
- 桌面容器：Wails `v2`
- 前端：React 18 + TypeScript + Vite 8
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
- Node.js `20.19+` 或 `22.12+`，推荐 Node.js `22`
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
build/bin/Mine Todo.exe
```

设置页 `关于` 模块当前显示版本：`1.0.0`

## 配置与数据

配置文件默认位于用户配置目录下的 `mine-todo/config.json`，包含：

- `storageDir`：SQLite 数据目录
- `dbPath`：数据库文件完整路径
- `language`：界面语言，当前支持 `zh-CN` / `en-US`

默认数据库文件名为 `todo.db`。

切换数据目录时，应用不会再静默复制旧数据，而是让用户选择：

- `迁移现有数据`：通过 SQLite 一致性快照复制到新目录；若目标已有数据库则提示冲突，不覆盖已有内容。
- `打开目标目录`：打开该目录已有数据库；不存在时创建空数据库。

切换待办、切换数据库和正常退出会先完成当前修改的保存；保存失败会保留草稿并提供重试。切换目录失败时，保留原配置和原数据库连接。

## 校验

```powershell
cd frontend
npm ci
npm run build
npm test
cd ..
go test ./...
go vet ./...
```

Windows 的浏览器测试默认使用 Microsoft Edge；测试后端为隔离的模拟实现。原生退出保存另有可选的 Windows 集成测试，命令见 [修复记录](docs/other/fixes-2026-11-10.md)。


## 开源合规

当前使用的技术与素材均为免费开源方案：

- Wails：MIT
- React：MIT
- marked：MIT
- DOMPurify：Apache-2.0
- modernc.org/sqlite：BSD 风格许可

新增生产力功能采用通用交互模式并由本项目独立实现，未复制竞品源码、品牌素材、专有图标、文案或特有视觉表达；未新增商业授权组件或闭源 SDK。

## 文档

- [使用文档](./docs/usage.md)
