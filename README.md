# 特种设备点检运维平台

面向锅炉、压力容器、起重机械、电梯等特种设备的台账建档、日常点检、润滑保养、定期检验与隐患整改的一体化运维后台。

这是一个前后端分离的管理平台：前端 Vue 3 + Vite + TypeScript，后端 FastAPI（Python）。
两边各自独立启动，前端 dev server 已关掉自动打开页面，启动后按终端打印的地址手工打开。

## 目录结构

```text
.
├── frontend/                 Vue 3 + Vite + TypeScript 前端
│   ├── .env                  唯一前端配置（代理/前缀/端口/子路径，dev 与 build 共用）
│   ├── config/node.ts        Node/Vite 侧：读取校验 .env、生成代理规则
│   ├── src/config/           浏览器侧：唯一配置来源、运行时加载与重试
│   ├── src/views/            每个业务模块一个页面
│   ├── src/api/              统一请求封装（接口前缀取唯一配置）
│   ├── src/stores/           会话与筛选状态
│   └── vite.config.ts        从唯一配置派生（open: false）
├── backend/                  FastAPI（Python） 后端
│   ├── app/routers/          每个业务模块一组接口
│   ├── app/services/         业务规则与状态流转
│   └── app/store.py          内存数据仓库与示例数据
├── .gitignore
└── docker-compose.yml
```

## 启动

### 后端

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./run.sh
```

健康检查：`curl http://127.0.0.1:8000/api/health`

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认监听 `http://127.0.0.1:5173/`，dev server 不会自动打开浏览器，
需要自己访问。

#### 一份配置管全部

代理目标、接口前缀、本地端口、部署子路径、应用名只在 **`frontend/.env`** 这一份里配置，
dev 与 `npm run build` 读取同一份、走同一套校验，本地开发与构建产物口径一致：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `VITE_APP_NAME` | `特种设备点检运维平台` | 左侧导航标题与浏览器标题 |
| `VITE_API_PREFIX` | `/api` | 接口统一前缀，dev 代理键与浏览器请求都用它 |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8000` | dev 代理到的后端地址 |
| `VITE_DEV_PORT` | `5173` | 本地 dev server 端口 |
| `VITE_BASE_PATH` | `/` | 部署子路径，根目录填 `/`，子路径填如 `/ops/` |

换后端端口/地址、换前端端口、改接口前缀都只改这一个文件，无需改代码。
该文件已纳入版本管理，克隆后无需任何修改即可启动。

- 启动或构建时如果配置缺失/不合法，会直接报错并指出 **文件与行号**（例如
  `frontend/.env:4 配置项 VITE_DEV_PORT 不合法：端口必须在 1-65535 之间`），按提示补齐后重试。
- 浏览器端取不到配置时，页面会列出“缺哪一项”，并提供「重新加载配置」按钮；
  重试不会沿用上一次的旧值。
- 自测配置逻辑：`npm run test:config`。

#### 部署到子路径

把 `VITE_BASE_PATH` 改成对应子路径（如 `/ops/`）后重新 `npm run build`，
构建产物的静态资源前缀与前端路由基路径会一起切换，左侧导航与页面布局不会错位。
各业务路由地址（`/boiler` 等）保持不变，只是整体挂在子路径下。

接口代理关系：dev server 把 `VITE_API_PREFIX`（默认 `/api`）代理到
`VITE_PROXY_TARGET`（默认 `http://127.0.0.1:8000`）。

## 业务模块

| 模块 | 目录 | 业务对象 | 主要字段 |
| --- | --- | --- | --- |
| 锅炉设备 | `boiler` | 锅炉设备 | 设备编号、设备名称、额定蒸发量 |
| 压力容器 | `vessel` | 压力容器 | 容器编号、容器名称、设计压力 |
| 压力管道 | `pressurepipe` | 压力管道 | 管道编号、管道名称、管道级别 |
| 起重机械 | `crane` | 起重机械 | 机械编号、机械名称、额定起重量 |
| 电梯设备 | `elevator` | 电梯设备 | 电梯编号、电梯名称、载重规格 |
| 场内机动车辆 | `forklift` | 场内机动车辆 | 车辆编号、车辆名称、动力方式 |
| 点检计划 | `plan` | 点检计划 | 计划编号、点检对象、点检周期 |
| 点检记录 | `spotcheck` | 点检记录 | 点检单号、关联计划、点检设备 |
| 润滑保养 | `lubricate` | 保养记录 | 保养单号、保养设备、润滑点位 |
| 定期检验 | `inspect` | 检验任务 | 检验编号、检验对象、检验类别 |
| 检验报告 | `report` | 检验报告 | 报告编号、关联检验、报告类别 |
| 隐患登记 | `hazard` | 隐患记录 | 隐患编号、涉及设备、隐患类型 |
| 整改闭环 | `rectify` | 整改单 | 整改单号、关联隐患、整改措施 |
| 使用登记 | `register` | 登记记录 | 登记编号、登记设备、使用单位 |
| 作业人员 | `operator` | 作业人员 | 人员编号、人员姓名、所属单位 |
| 备件器材 | `spare` | 备件器材 | 备件编号、备件名称、适用设备 |
| 维保合同 | `contract` | 维保合同 | 合同编号、服务单位、维保设备 |
| 费用结算 | `settle` | 结算单 | 结算单号、关联合同、费用类别 |

## 约定

- 每个模块的前端页面在 `frontend/src/views/<模块>/index.vue`，后端接口在
  `backend/app/routers/<模块>.py`，业务规则在 `backend/app/services/<模块>.py`。
- 列表接口统一返回 `{ items, total, page, size }`，动作接口统一返回 `{ ok, message }`。
- 状态流转只允许在 `app/services` 里改，路由层不做业务判断。
