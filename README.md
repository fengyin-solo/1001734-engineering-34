# 特种设备点检运维平台

面向锅炉、压力容器、起重机械、电梯等特种设备的台账建档、日常点检、润滑保养、定期检验与隐患整改的一体化运维后台。

这是一个前后端分离的管理平台：前端 Vue 3 + Vite + TypeScript，后端 FastAPI（Python）。
两边各自独立启动，前端 dev server 已关掉自动打开页面，启动后按终端打印的地址手工打开。

## 目录结构

```text
.
├── frontend/                 Vue 3 + Vite + TypeScript 前端
│   ├── .env                  前端唯一配置（端口、代理目标、接口前缀、部署子路径）
│   ├── src/views/            每个业务模块一个页面
│   ├── src/api/              统一请求封装
│   ├── src/config/           配置解析/校验、业务模块登记（导航与概览同源）
│   ├── src/stores/           会话与筛选状态
│   └── vite.config.ts        从 .env 读取 dev server / 代理 / base（open: false）
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
需要自己访问。`/api` 由 vite 代理到后端 `http://127.0.0.1:8000`。

#### 前端配置（只认 `frontend/.env` 这一份）

换端口、换后端地址、换部署子路径，都只改 `frontend/.env`，不要再改代码：

| 键名 | 含义 | 示例 |
| --- | --- | --- |
| `VITE_APP_NAME` | 应用名称（页面标题、侧边栏） | `特种设备点检运维平台` |
| `VITE_API_PREFIX` | 接口统一前缀，开发态按此前缀代理、生产态按此前缀拼接 | `/api` |
| `VITE_BASE` | 部署子路径；根路径部署填 `/`，子路径部署填 `/inspect/`（尾斜杠可省略） | `/inspect/` |
| `VITE_DEV_PORT` | dev server 监听端口 | `5173` |
| `VITE_PROXY_TARGET` | dev server 代理目标（后端地址） | `http://127.0.0.1:8000` |

约定：

- 同一份配置同时供 `npm run dev` 与 `npm run build` 使用，本地开发与构建产出走同一套规则，
  校验失败会直接指出缺的是哪个键、或哪个键不合法，补齐后重试即可，不需要回改代码。
- 接口前缀只在配置里维护一份：页面里写 `/boiler` 这样的相对路径，由 `src/api/client.ts`
  统一拼上 `VITE_API_PREFIX`；开发态由 dev server 代理到 `VITE_PROXY_TARGET`，
  生产态由同前缀的反向代理转发。
- 部署到子路径时，静态资源路径与 vue-router 的 base 都取 `VITE_BASE`，
  左侧导航与页面布局不会再错位。
- 业务模块清单（左侧导航、运营概览模块行）以 `frontend/src/config/modules.ts` 为唯一来源，
  新增/下线模块只改这一处。

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
