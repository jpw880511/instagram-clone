// 하나의 명령어(`npm run dev` 또는 run.bat)로 백엔드 + 프론트엔드를 함께 실행한다.
// - 필요한 경우 backend/.venv 생성 및 pip install, frontend/node_modules install 을 자동 수행
// - 두 서버를 자식 프로세스로 띄우고, 프론트가 응답하면 기본 브라우저를 자동으로 연다
// - Ctrl+C 시 두 서버 모두 정리한다

import { spawn, spawnSync } from "node:child_process";
import { existsSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKEND_DIR = join(ROOT, "backend");
const FRONTEND_DIR = join(ROOT, "frontend");
const IS_WIN = process.platform === "win32";

const children = [];
let shuttingDown = false;

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function findPython() {
  for (const cmd of IS_WIN ? ["python", "py"] : ["python3", "python"]) {
    const res = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (!res.error && res.status === 0) return cmd;
  }
  return null;
}

function venvPaths(pythonCmd) {
  const venvDir = join(BACKEND_DIR, ".venv");
  const venvPython = IS_WIN ? join(venvDir, "Scripts", "python.exe") : join(venvDir, "bin", "python");
  return { venvDir, venvPython };
}

function ensureBackendEnv(pythonCmd) {
  const { venvDir, venvPython } = venvPaths(pythonCmd);
  const requirementsPath = join(BACKEND_DIR, "requirements.txt");
  const markerPath = join(venvDir, ".installed");

  if (!existsSync(venvPython)) {
    log("backend", "가상환경 생성 중 (.venv)...");
    const args = pythonCmd === "py" ? ["-3", "-m", "venv", ".venv"] : ["-m", "venv", ".venv"];
    const res = spawnSync(pythonCmd, args, { cwd: BACKEND_DIR, stdio: "inherit" });
    if (res.status !== 0) {
      log("backend", "가상환경 생성 실패. 백엔드 실행을 건너뜁니다.");
      return null;
    }
  }

  const needsInstall =
    !existsSync(markerPath) ||
    statSync(requirementsPath).mtimeMs > statSync(markerPath).mtimeMs;

  if (needsInstall) {
    log("backend", "의존성 설치 중 (pip install -r requirements.txt)...");
    const res = spawnSync(venvPython, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], {
      cwd: BACKEND_DIR,
      stdio: "inherit",
    });
    if (res.status !== 0) {
      log("backend", "의존성 설치 실패. 백엔드 실행을 건너뜁니다.");
      return null;
    }
    writeFileSync(markerPath, new Date().toISOString());
  }

  const envPath = join(BACKEND_DIR, ".env");
  const envExamplePath = join(BACKEND_DIR, ".env.example");
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    log("backend", ".env 파일을 .env.example 로부터 생성했습니다.");
  }

  return venvPython;
}

function ensureFrontendEnv() {
  const nodeModulesPath = join(FRONTEND_DIR, "node_modules");
  if (!existsSync(nodeModulesPath)) {
    log("frontend", "의존성 설치 중 (npm install)...");
    const res = spawnSync("npm", ["install"], { cwd: FRONTEND_DIR, stdio: "inherit", shell: IS_WIN });
    if (res.status !== 0) {
      log("frontend", "npm install 실패.");
      process.exit(1);
    }
  }

  const envPath = join(FRONTEND_DIR, ".env");
  const envExamplePath = join(FRONTEND_DIR, ".env.example");
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    log("frontend", ".env 파일을 .env.example 로부터 생성했습니다.");
  }
}

function openBrowser(url) {
  log("dev", `브라우저 열기: ${url}`);
  if (IS_WIN) spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
  else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true });
  else spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

function waitForHttpOk(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve) => {
    (function attempt() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(attempt, 500);
      });
      req.setTimeout(1500, () => req.destroy());
    })();
  });
}

function startBackend(venvPython) {
  if (!venvPython) return null;
  log("backend", "uvicorn 서버 시작 (http://localhost:8000)");
  const proc = spawn(venvPython, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], {
    cwd: BACKEND_DIR,
    stdio: "inherit",
    detached: !IS_WIN,
  });
  proc.on("exit", (code) => {
    if (!shuttingDown) log("backend", `프로세스가 종료되었습니다 (code ${code}).`);
  });
  children.push(proc);
  return proc;
}

function startFrontend() {
  log("frontend", "vite 개발 서버 시작 중...");
  const proc = spawn("npm", ["run", "dev"], {
    cwd: FRONTEND_DIR,
    stdio: ["inherit", "pipe", "inherit"],
    shell: IS_WIN,
    detached: !IS_WIN,
  });
  children.push(proc);

  let opened = false;
  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!opened) {
      // eslint-disable-next-line no-control-regex
      const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
      const match = plain.match(/Local:\s+(http:\/\/localhost:\d+\/?)/);
      if (match) {
        opened = true;
        const url = match[1];
        waitForHttpOk(url).then((ok) => {
          if (ok) openBrowser(url);
          else log("dev", `${url} 응답을 기다리다 실패했습니다. 수동으로 열어주세요.`);
        });
      }
    }
  });

  proc.on("exit", (code) => {
    if (!shuttingDown) log("frontend", `프로세스가 종료되었습니다 (code ${code}).`);
  });
  return proc;
}

function killTree(pid) {
  if (!pid) return;
  if (IS_WIN) {
    // uvicorn --reload / npm.cmd 는 자식 프로세스를 추가로 띄우므로 트리 전체를 종료해야 포트가 실제로 풀린다.
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // 이미 종료된 프로세스
      }
    }
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log("dev", "종료 중...");
  for (const child of children) {
    killTree(child.pid);
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  log("dev", "Gram 프로젝트를 시작합니다 (백엔드 + 프론트엔드)");

  const pythonCmd = findPython();
  let venvPython = null;
  if (!pythonCmd) {
    log("backend", "Python 을 찾을 수 없습니다. 백엔드 실행을 건너뜁니다 (프론트엔드는 목업 데이터로 동작합니다).");
  } else {
    venvPython = ensureBackendEnv(pythonCmd);
  }

  ensureFrontendEnv();

  startBackend(venvPython);
  startFrontend();
}

main();
