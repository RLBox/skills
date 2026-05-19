# 环境变量参考

## .env 文件配置说明

基于 `.env.example` 复制并修改。

### 必填（不填 agent loop 跑不动）

| 变量 | 说明 | 获取方式 |
|------|------|---------|
| `ARK_API_KEY` | 火山引擎 ARK 平台 API Key | https://console.volcengine.com/ark |

### 基础设施（默认值可用，一般不改）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | 6800 | vendor_android_env 容器服务端口 |
| `ADB_TARGET` | host.docker.internal:5555 | 容器连模拟器的 ADB 地址 |
| `EMU_CONSOLE_TARGET` | host.docker.internal:5554 | telnet 模拟器控制台 |
| `GRPC_TARGET` | host.docker.internal:8554 | 模拟器 gRPC 端口 |

### Agent Loop 参数

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_MODEL_NAME` | doubao-seed-2-0-lite-260428 | 主力推理模型 |
| `AGENT_LLM_BASE_URL` | https://ark.cn-beijing.volces.com/api/v3 | 模型 API 地址 |
| `AGENT_SERVER_URL` | http://localhost:6800 | vendor server 访问地址 |
| `AGENT_K` | 1 | Pass@K 的 K 值 |
| `AGENT_MAX_STEPS` | 50 | 单个 Episode 最大步数 |

### Fallback 模型链（可选，不配也能跑）

格式 `AGENT_FALLBACK_{N}_MODEL_NAME` / `_BASE_URL` / `_API_KEY`，编号从 1 开始严格连续。

默认链：豆包主力 → GPT-4o → Claude

| 变量 | 说明 |
|------|------|
| `AGENT_FALLBACK_1_MODEL_NAME` | gpt-4o |
| `AGENT_FALLBACK_1_BASE_URL` | https://api.openai.com/v1 |
| `AGENT_FALLBACK_1_API_KEY` | OpenAI API Key |
| `AGENT_FALLBACK_2_MODEL_NAME` | claude-sonnet-4-5-20250929 |
| `AGENT_FALLBACK_2_BASE_URL` | https://api.anthropic.com/v1 |
| `AGENT_FALLBACK_2_API_KEY` | Anthropic API Key |

### LLM-Judge 质量兜底（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FALLBACK_ON_QUALITY_FAILURE` | 1 | 0=关 / 1=开 |
| `FALLBACK_JUDGE_CONFIDENCE_THRESHOLD` | 0.7 | 切模型的置信度下限 |
| `FALLBACK_JUDGE_MAX_CALLS_PER_BATCH` | 10 | 单次 batch 最多调 Judge 次数 |

## 品牌注册表

源码：`sengclaw/apps.py`

| Slug | 代号 | 包名 | 端口 | 说明 |
|------|------|------|------|------|
| wogoumarket | Goomart | com.wogoumarket | 11601 | 线上超市 |
| xianzhiershouwang | IdleSwap | com.xianzhiershouwang | 11602 | 闲置交易 |
| daishushenghuo | Kangoo | com.daishushenghuo | 11603 | 跑腿外卖 |
| xingqiushejiaowang | Planet | com.xingqiushejiaowang | 11604 | 社区 |
| duwu | Duvy | com.duwu | 11605 | DU物 |

APK 命名规范：`apks/<slug>-1.0.0.apk`

Settings.Global 键名规范（一台设备多品牌共存）：
- `<slug>_api_endpoint` — Rails 后端地址
- `<slug>_task_id` — 当前 task
- `<slug>_session_id` — 当前 session

## 目录结构

```
android_sandbox/
├── .env                    ← 从 .env.example 复制并填 API key
├── apks/                   ← 品牌 APK + ADBKeyboard（git-ignored）
├── avd/android-runtime/    ← AVD 快照 + emulator binary（git-ignored, ~16GB）
├── images/                 ← Docker tar（git-ignored, ~3GB）
├── scripts/                ← eval_avd.sh / sync-tasks / run_agent_loop_demo.sh
├── sengclaw/               ← Task 生成器 + 评测脚本
│   ├── apps.py             ← 品牌注册表
│   ├── generate_tasks.py   ← 从 Rails 拉 validator → 生成 .py
│   └── scripts/            ← run_single_task.py / run_pass_at_3_batch.py
├── src/android_tasks_external/  ← 生成的 Task 定义文件（git-ignored）
└── docker/                 ← compose + override
```
