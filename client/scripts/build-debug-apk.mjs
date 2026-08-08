import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GRADLE_TIMEOUT_MS = 900_000;
const JAVA_CHECK_TIMEOUT_MS = 10_000;
const REQUIRED_JAVA_MAJOR = 21;
const REQUIRED_ANDROID_PLATFORM = 'android-36';
const androidDirectory = fileURLToPath(new URL('../android/', import.meta.url));
const apkPath = path.join(androidDirectory, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function fail(message) {
  console.error(`[android] ${message}`);
  process.exit(1);
}

function parseJavaMajor(versionOutput) {
  const match = versionOutput.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) fail('无法解析 JAVA_HOME 中的 Java 版本');
  const firstPart = Number(match[1]);
  if (firstPart !== 1) return firstPart;
  if (!match[2]) fail('无法解析旧格式 Java 版本');
  return Number(match[2]);
}

if (!existsSync(androidDirectory)) fail('缺少 android 工程，请先执行 npm run android:sync');

const isWindows = process.platform === 'win32';
const javaHome = process.env.JAVA_HOME?.trim();
if (!javaHome) fail('缺少 JAVA_HOME；请安装 JDK 21 并配置该环境变量');
const javaExecutable = path.join(javaHome, 'bin', isWindows ? 'java.exe' : 'java');
if (!existsSync(javaExecutable)) fail(`JAVA_HOME 中未找到 Java：${javaExecutable}`);
const javaVersion = spawnSync(javaExecutable, ['-version'], {
  encoding: 'utf8',
  timeout: JAVA_CHECK_TIMEOUT_MS,
});
if (javaVersion.error) fail(`Java 版本检查失败：${javaVersion.error.message}`);
if (javaVersion.status !== 0) fail('Java 版本检查返回失败状态');
const javaMajor = parseJavaMajor(`${javaVersion.stdout}\n${javaVersion.stderr}`);
if (javaMajor < REQUIRED_JAVA_MAJOR) fail(`需要 JDK 21 或更高版本，当前为 Java ${javaMajor}`);

let androidSdk = process.env.ANDROID_SDK_ROOT?.trim();
if (!androidSdk) androidSdk = process.env.ANDROID_HOME?.trim();
if (!androidSdk) fail('缺少 ANDROID_SDK_ROOT；请安装 Android SDK Platform 36');
if (!existsSync(androidSdk)) fail(`Android SDK 目录不存在：${androidSdk}`);
const androidPlatform = path.join(androidSdk, 'platforms', REQUIRED_ANDROID_PLATFORM);
if (!existsSync(androidPlatform)) fail(`缺少 Android SDK Platform 36：${androidPlatform}`);

const gradleCommand = isWindows ? 'cmd.exe' : './gradlew';
const gradleArguments = isWindows
  ? ['/d', '/s', '/c', 'gradlew.bat assembleDebug']
  : ['assembleDebug'];
const build = spawnSync(gradleCommand, gradleArguments, {
  cwd: androidDirectory,
  env: process.env,
  stdio: 'inherit',
  timeout: GRADLE_TIMEOUT_MS,
});

if (build.error) fail(`Gradle 启动失败：${build.error.message}`);
if (build.status === null) fail('Gradle 未返回退出状态');
if (build.status !== 0) process.exit(build.status);
if (!existsSync(apkPath)) fail(`构建成功但未找到 APK：${apkPath}`);

console.log(`[android] APK 已生成：${apkPath}`);
