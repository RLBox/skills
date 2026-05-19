# 故障排查手册

## 一、AVD / QEMU 相关

### QEMU Segfault（最常见）

```
qemu-system-aarch64: Segmentation fault: 11
```

**原因**：macOS M 芯片 + QEMU 36.5.11 已知稳定性问题，跑 1-2 个 Episode 后概率崩溃。

**修复**：

```bash
bash sengclaw/scripts/recover_emulator.sh
```

或手动：

```bash
pkill -f "qemu-system-aarch64.*Medium_Phone" 2>/dev/null || true
sleep 3
bash scripts/eval_avd.sh
```

### hardware-qemu.ini.lock 文件残留

```
ERROR: another emulator instance is running
```

```bash
rm -f avd/android-runtime/dot-android/avd/Medium_Phone.avd/hardware-qemu.ini.lock
```

### AVD 启动后 adb 看不到设备

```bash
# 确保用项目内的 adb（避免版本冲突）
export PATH="$(pwd)/avd/android-runtime/platform-tools:$PATH"
adb devices
adb kill-server && adb start-server && adb devices
```

## 二、Docker 容器相关

### 容器看不到模拟器设备

```bash
# 1. 确保模拟器开了 TCP 监听
adb -s emulator-5554 tcpip 5555

# 2. 容器侧重连
docker exec vendor_android_env adb disconnect host.docker.internal:5555
docker exec vendor_android_env adb connect host.docker.internal:5555
docker exec vendor_android_env adb devices
```

### vendor_android_env health 不通

```bash
# 检查容器是否 running
docker ps | grep vendor_android_env

# 重建
docker compose --env-file .env down
docker compose --env-file .env up --build -d

# 查日志
docker logs vendor_android_env --tail 50
```

### images.tar 平台不对

```bash
./scripts/detect-tar-platform
# 必须输出 linux/arm64
# 如果输出 linux/amd64 → 需要 arm64 版本
```

## 三、APK 相关

### INSTALL_FAILED_OLDER_SDK

APK target SDK > 设备 SDK。检查：

```bash
adb shell getprop ro.build.version.sdk  # 需要 ≥ 33
```

### ADBKeyboard 中文输入无效

```bash
# 检查当前 IME
adb shell settings get secure default_input_method
# 期望：com.android.adbkeyboard/.AdbIME

# 重新激活
adb shell ime enable com.android.adbkeyboard/.AdbIME
adb shell ime set com.android.adbkeyboard/.AdbIME

# Smoke test
adb shell "am broadcast -a ADB_INPUT_B64 -p com.android.adbkeyboard --es msg $(echo -n '你好' | base64)"
```

### APK WebView net::ERR_CONNECTION_REFUSED

APK 无法连到 Rails 后端。检查：

```bash
# 模拟器走 10.0.2.2（NAT 网关指向 host）
adb shell "curl -s http://10.0.2.2:11601/api/tasks | head -c 100"

# 真机走局域网 IP
adb shell "curl -s http://192.168.x.x:11601/api/tasks | head -c 100"
```

## 四、Task 生成 / sync 相关

### generate_tasks.py 报 "Unknown app"

`sengclaw/apps.py` 里没注册。看支持的 slug：

```bash
python3 -c "from sengclaw.apps import APPS; print(sorted(APPS.keys()))"
```

### sync-tasks 失败

```bash
# vendor 容器是否活着
docker ps | grep vendor_android_env

# 手动看容器里 taskset 目录
docker exec vendor_android_env ls /workspace/taskset/ | head -10
```

## 五、Agent Loop / runner 相关

### LLM API 报 401

ARK_API_KEY 配错或过期。到火山引擎控制台确认 key 有效。

### runner 超时退出但 task 未完成

增加 `--max-steps`：

```bash
python3 sengclaw/scripts/run_single_task.py --brand wogoumarket --task <slug> -- --max-steps 80
```

### 全量 Pass@3 中途断电恢复

用同一个 `--report-dir` 再跑一次，`already_done()` 自动跳过已完成：

```bash
python3 sengclaw/scripts/run_pass_at_3_batch.py --k 3 --report-dir $REPORT_DIR
```
