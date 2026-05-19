---
name: sengclaw-android-sandbox-init
description: >
  Android Sandbox 项目环境一键初始化。从 git clone 到 AVD 跑通 smoke test 的完整引导。
  处理：仓库拉取、大文件解压（apks.zip/images.zip 从飞书下载）、.env 配置、
  Docker 镜像加载、AVD 模拟器启动、ADBKeyboard 激活、容器体检、单题 smoke 验证。
  当用户说「初始化 android sandbox」「搭建 android 评测环境」「android sandbox setup」
  「新人环境搭建」「android sandbox init」「搭一下沙盒」「评测环境初始化」时触发。
disable-model-invocation: false
user-invocable: true
---

# sengclaw-android-sandbox-init

把新人从 0 → 跑通第一道 Pass@1 的全链路自动化。

## 前置条件（开始前确认）

| 依赖 | 最低版本 | 检测命令 |
|------|---------|---------|
| macOS (Apple Silicon) | 14.0+ | `uname -m` → `arm64` |
| Docker Desktop | 4.25+ | `docker --version` |
| Python | 3.11+ | `python3 --version` |
| Git | 任意 | `git --version` |
| 飞书账号 | — | 能访问 dao-42 空间下载 apks.zip / images.zip |

> **Windows/Linux 用户**：当前 AVD 快照仅为 arm64 构建。x86 环境需要另行制作快照，本 skill 暂不支持。

## 资源清单

| 资源 | 大小 | 来源 | 说明 |
|------|------|------|------|
| `apks.zip` | ~25MB | 飞书文档附件（用户手动下载） | 5 品牌 APK + keyboardservice-debug.apk |
| `images.zip` | ~3GB | 飞书文档附件（用户手动下载） | android-dind-image.tar + android-env-image.tar |
| Android SDK (emulator + system-images + platform-tools) | ~3.5GB | sdkmanager 在线下载 | AI 自动执行 |

> AVD 不再需要离线拷贝，AI 通过 sdkmanager 直接下载并创建。

## 工作流

### Step 1 · Clone 仓库

```bash
cd ~/Documents/GitHub
git clone git@github.com:anthropics/android_sandbox.git
cd android_sandbox
```

如果已 clone 过，跳过。验证：

```bash
ls sengclaw/apps.py && echo "✓ 仓库已就位"
```

### Step 2 · 下载并解压大文件

**引导用户**：
1. 打开飞书文档 https://dao-42.feishu.cn/wiki/GafewSGFBi2jVFkOlTRcn8Ftn3d
2. 下载两个附件：`apks.zip` 和 `images.zip`
3. 把下载的文件放到仓库根目录

```bash
cd ~/Documents/GitHub/android_sandbox

# 解压 APKs
unzip -o ~/Downloads/apks.zip -d apks/
ls apks/*.apk  # 应看到 5 个品牌 APK + keyboardservice-debug.apk

# 解压 Docker images
unzip -o ~/Downloads/images.zip -d images/
ls -lh images/*.tar  # 应看到 android-dind-image.tar (~1.1G) + android-env-image.tar (~1.9G)
```

**验证**：

```bash
# APK 完整性
for apk in daishushenghuo duwu wogoumarket xianzhiershouwang xingqiushejiaowang; do
  [ -f "apks/${apk}-1.0.0.apk" ] && echo "✓ $apk" || echo "✗ $apk MISSING"
done
[ -f "apks/keyboardservice-debug.apk" ] && echo "✓ ADBKeyboard" || echo "✗ ADBKeyboard MISSING"

# Images 完整性
[ -f "images/android-dind-image.tar" ] && echo "✓ dind image" || echo "✗ dind image MISSING"
[ -f "images/android-env-image.tar" ] && echo "✓ env image" || echo "✗ env image MISSING"
```

### Step 3 · 下载 Android SDK 并创建 AVD

通过 sdkmanager 在线下载 emulator、platform-tools、system-images，然后创建 AVD。

```bash
AVD_ROOT="$(pwd)/avd/android-runtime"
mkdir -p "$AVD_ROOT"

# 1. 下载 Android Command Line Tools（如果没有）
if [ ! -f "$AVD_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  CMDLINE_ZIP="commandlinetools-mac-11076708_latest.zip"
  curl -fSL "https://dl.google.com/android/repository/$CMDLINE_ZIP" -o "/tmp/$CMDLINE_ZIP"
  unzip -qo "/tmp/$CMDLINE_ZIP" -d "$AVD_ROOT/cmdline-tools-tmp"
  mkdir -p "$AVD_ROOT/cmdline-tools/latest"
  mv "$AVD_ROOT/cmdline-tools-tmp/cmdline-tools/"* "$AVD_ROOT/cmdline-tools/latest/"
  rm -rf "$AVD_ROOT/cmdline-tools-tmp" "/tmp/$CMDLINE_ZIP"
fi

export ANDROID_SDK_ROOT="$AVD_ROOT"
export ANDROID_HOME="$AVD_ROOT"
SDKMANAGER="$AVD_ROOT/cmdline-tools/latest/bin/sdkmanager"

# 2. 接受 License
yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true

# 3. 下载组件（~3.5GB，约 5-10 分钟）
"$SDKMANAGER" \
  "emulator" \
  "platform-tools" \
  "system-images;android-36;google_apis_playstore;arm64-v8a"
```

> 如果 `android-36` 不可用（版本号可能略有变化），执行 `$SDKMANAGER --list | grep "system-images.*arm64"` 找最新的 API 36+ 镜像。

```bash
# 4. 创建 AVD
export ANDROID_AVD_HOME="$AVD_ROOT/dot-android/avd"
mkdir -p "$ANDROID_AVD_HOME"
AVDMANAGER="$AVD_ROOT/cmdline-tools/latest/bin/avdmanager"

echo "no" | "$AVDMANAGER" create avd \
  -n "Medium_Phone" \
  -k "system-images;android-36;google_apis_playstore;arm64-v8a" \
  -d "medium_phone" \
  --force

# 5. 优化 AVD config（关动画、去 skin）
AVD_CONFIG="$ANDROID_AVD_HOME/Medium_Phone.avd/config.ini"
sed -i '' '/^skin\.name=/d;/^skin\.path=/d' "$AVD_CONFIG" 2>/dev/null || true
cat >> "$AVD_CONFIG" << 'EOF'
skin.dynamic=no
showDeviceFrame=no
hw.lcd.density=420
hw.lcd.height=2400
hw.lcd.width=1080
hw.ramSize=4096
disk.dataPartition.size=8G
EOF
```

```bash
# 6. 首次冷启动（约 2 分钟）
bash scripts/eval_avd.sh

# 等 boot 完成
export PATH="$AVD_ROOT/platform-tools:$PATH"
adb wait-for-device
adb -s emulator-5554 shell getprop sys.boot_completed  # 期望输出 1
```

```bash
# 7. 安装 APK + 配置 ADBKeyboard
for apk in apks/*.apk; do
  adb -s emulator-5554 install -r "$apk"
done

# 激活 ADBKeyboard
adb -s emulator-5554 shell ime enable com.android.adbkeyboard/.AdbIME
adb -s emulator-5554 shell ime set com.android.adbkeyboard/.AdbIME

# 验证
adb -s emulator-5554 shell "am broadcast -a ADB_INPUT_B64 -p com.android.adbkeyboard --es msg $(echo -n '你好' | base64)"
```

```bash
# 8. 保存 init_state 快照（后续 eval_avd.sh 每次从此快照恢复）
adb -s emulator-5554 emu avd snapshot save init_state
echo "✓ init_state snapshot saved"
```

**验证 AVD 可正常从快照启动**：

```bash
# 杀掉当前模拟器
adb -s emulator-5554 emu kill
sleep 3

# 从 init_state 启动
bash scripts/eval_avd.sh
adb wait-for-device
adb -s emulator-5554 shell getprop sys.boot_completed  # 期望输出 1
echo "✓ AVD ready from snapshot"
```

### Step 4 · 配置 .env

```bash
cp .env.example .env
```

**必填项**（引导用户编辑）：

```
ARK_API_KEY=<从火山引擎 ARK 控制台获取>
```

**可选项**（Fallback 模型链，不填也能跑）：

```
AGENT_FALLBACK_1_API_KEY=<OpenAI key>
AGENT_FALLBACK_2_API_KEY=<Anthropic key>
```

验证：

```bash
grep -q "^ARK_API_KEY=<" .env && echo "⚠ ARK_API_KEY 未填写！" || echo "✓ .env 已配置"
```

### Step 5 · 加载 Docker 镜像 & 启动容器

```bash
# 加载镜像（首次 ~3 分钟）
docker load -i images/android-dind-image.tar
docker load -i images/android-env-image.tar

# 启动容器栈
docker compose --env-file .env up --build -d

# 验证
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "vendor_android_env|android-dind"
curl -s http://localhost:6800/health && echo " ← vendor server OK"
```

### Step 6 · 启动 AVD 模拟器（日常使用）

Step 3 已经完成首次创建和快照保存。后续每次评测前启动：

```bash
bash scripts/eval_avd.sh

# 等待启动（从快照恢复约 30 秒）
export PATH="$(pwd)/avd/android-runtime/platform-tools:$PATH"
adb wait-for-device
adb -s emulator-5554 shell getprop sys.boot_completed  # 期望输出 1
```

**连通 Docker 容器**：

```bash
# 让模拟器监听 TCP 5555（容器通过 host.docker.internal:5555 连）
adb -s emulator-5554 tcpip 5555
sleep 2

# 容器侧连接
docker exec vendor_android_env adb connect host.docker.internal:5555
docker exec vendor_android_env adb devices  # 期望看到 host.docker.internal:5555 device
```

### Step 7 · 品牌 Rails 后端

新人评测不需要自己跑 Rails 后端 —— 用团队已部署的在线实例即可。但如果要本地开发：

```bash
# 在对应品牌 worktree 里启动
cd ~/Documents/GitHub/<brand-project>
bin/dev  # 默认端口见 sengclaw/apps.py
```

品牌端口注册表（`sengclaw/apps.py`）：

| Slug | 默认端口 |
|------|---------|
| daishushenghuo | 11601 |
| duwu | 11605 |
| wogoumarket | 11601 |
| xianzhiershouwang | 11602 |
| xingqiushejiaowang | 11604 |

### Step 8 · Smoke Test（验证全链路）

```bash
# 生成 task 定义
python3 sengclaw/generate_tasks.py --app wogoumarket --status all

# 同步到容器
./scripts/sync-tasks --fresh

# 跑单题 Pass@1（选一个最简单的 task）
python3 sengclaw/scripts/run_single_task.py \
  --brand wogoumarket \
  --task <pick-any-task-slug> \
  --max-steps 10 --k 1
```

如果 Step 6 runner 跑完 rc=0 → 环境搭建完成！

## 常见故障排查

### QEMU Segfault（macOS M 芯片已知问题）

```
qemu-system-aarch64: Segmentation fault: 11
```

正常现象，跑 1-2 个 Episode 后概率性崩溃。恢复：

```bash
bash sengclaw/scripts/recover_emulator.sh
```

### Docker 容器看不到模拟器设备

```bash
# 检查 ADB TCP 监听
adb -s emulator-5554 tcpip 5555

# 重连
docker exec vendor_android_env adb disconnect host.docker.internal:5555
docker exec vendor_android_env adb connect host.docker.internal:5555
```

### APK 安装失败（INSTALL_FAILED_OLDER_SDK）

当前 APK 目标 API 较新，AVD 镜像必须 ≥ API 33。检查：

```bash
adb shell getprop ro.build.version.sdk  # 期望 ≥ 33
```

### ADBKeyboard 不工作（中文输入失败）

```bash
# 手动激活
adb shell ime enable com.android.adbkeyboard/.AdbIME
adb shell ime set com.android.adbkeyboard/.AdbIME

# 验证
adb shell "am broadcast -a ADB_INPUT_B64 -p com.android.adbkeyboard --es msg $(echo -n '测试' | base64)"
```

### images.tar 平台不匹配

```bash
./scripts/detect-tar-platform  # 必须输出 linux/arm64
```

如果输出 `linux/amd64`，需要从团队获取 arm64 版本的 tar。

## 后续操作指引

环境搭建完成后的日常开发流程：

- **批量评测**：`python3 sengclaw/scripts/run_pass_at_3_batch.py --k 3`
- **单题调试**：`python3 sengclaw/scripts/run_single_task.py --brand <slug> --task <slug>`
- **Task 重新生成**：`./sengclaw/scripts/generate_all_tasks.sh`
- **AVD 崩溃恢复**：`bash sengclaw/scripts/recover_emulator.sh`

详细用法见 `sengclaw/README.md`。
