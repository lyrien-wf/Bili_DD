/**
 * Internet Download Manager 适配器
 *
 * IDM 没有本地 HTTP API，官方也明确禁止网页直接调用它的 COM 接口，所以这里约定一个
 * 本地桥接服务来转发（见 tools/idm-bridge.ps1）：
 *
 *   浏览器 --POST http://127.0.0.1:15152/download--> 桥接脚本 --COM SendLinkToIDM--> IDM
 *
 * 相比命令行 IDMan.exe，走 COM 的好处是能带上 Referer、Cookie、User-Agent 和文件名：
 * B 站部分 CDN 节点在没有 Referer 时会直接 403，只靠命令行是下载不下来的。
 *
 * 注意：IDM 只负责下载，不做音视频合并。B 站是 DASH 分离流，所以推给 IDM 的结果
 * 一定是「视频轨 + 音频轨」两个文件，需要 ffmpeg 合并（面板里的「命令」按钮可一键生成）。
 */

import { GM_xmlhttpRequest, type GMXMLHttpRequestResponse, type GMXMLHttpRequestError } from '$';
import type {
  IExternalDownloader,
  ExternalDownloaderStatus,
  ExternalDownloadPayload,
  DownloaderRuntimeOptions,
} from './types';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';
import { getDownloadSettings, type DownloadSettings } from '../utils/settings';

export const IDM_DEFAULT_PORT = 15152;

interface BridgeReply {
  ok?: boolean;
  version?: string;
  message?: string;
  error?: string;
}

interface IdmJobRequest {
  url: string;
  referer: string;
  cookie: string;
  userAgent: string;
  /** 画面留空 = 用服务器 URL 里的文件名；音频固定叫 audio */
  filename: string;
  /** 视频还是音频，桥接探测不到 Content-Type 时用它兜底 */
  type: 'video' | 'audio';
  /** 每个视频一个子目录，避免不同视频的 v/a 互相覆盖；为空则平铺 */
  subfolder: string;
  /** true = 让 IDM 弹出「开始下载」对话框（可改目录），false = 静默开始 */
  prompt: boolean;
}

/** 与本地桥接服务通信（GM_xmlhttpRequest 不受 CORS 限制） */
function bridgeRequest<T>(options: {
  port: number;
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const { port, path, method = 'GET', body, timeoutMs = 8000 } = options;
  return new Promise<T>((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url: `http://127.0.0.1:${port}${path}`,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      data: body === undefined ? undefined : JSON.stringify(body),
      responseType: 'json',
      timeout: timeoutMs,
      onload: (res: GMXMLHttpRequestResponse) => {
        const raw = res.response !== undefined && res.response !== null && res.response !== '' ? res.response : res.responseText;
        if (res.status < 200 || res.status >= 300) {
          // 桥接服务出错时会带回 {"ok":false,"error":"..."}，优先把真实原因抛给用户
          let detail = `HTTP ${res.status}`;
          try {
            const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { error?: unknown; message?: unknown } | null;
            if (parsed && typeof parsed.error === 'string' && parsed.error) detail = parsed.error;
            else if (parsed && typeof parsed.message === 'string' && parsed.message) detail = parsed.message;
          } catch {
            // 返回体不是 JSON 时保留 HTTP 状态
          }
          reject(new Error(detail));
          return;
        }
        try {
          resolve((typeof raw === 'string' ? JSON.parse(raw) : raw) as T);
        } catch (e: unknown) {
          reject(new Error(`桥接服务返回内容无法解析: ${getErrorMessage(e)}`));
        }
      },
      onerror: (err: GMXMLHttpRequestError) => reject(new Error(err?.error || '无法连接 IDM 桥接服务')),
      ontimeout: () => reject(new Error('IDM 桥接服务响应超时')),
    });
  });
}

export class IdmDownloader implements IExternalDownloader {
  public readonly id = 'idm';
  public readonly name = 'Internet Download Manager';
  public readonly shortName = 'IDM';
  public readonly description = '通过本地桥接脚本调用 IDM 的 COM 接口，自动携带 Referer / Cookie / 文件名';
  public readonly defaultPort = IDM_DEFAULT_PORT;

  public resolveConfig(settings: DownloadSettings): DownloaderRuntimeOptions {
    const cfg = settings.downloadersConfig?.[this.id];
    return {
      port: cfg?.port ?? this.defaultPort,
      // 复用脚本全局设置：是否按标题建子文件夹、是否每次先问保存位置
      autoTitleFolder: settings.autoTitleFolder !== false,
      prompt: settings.alwaysAskSaveAs === true,
    };
  }

  public async checkAvailability(options?: {
    timeoutMs?: number;
    port?: number;
  }): Promise<ExternalDownloaderStatus> {
    const port = options?.port || this.defaultPort;
    const timeout = options?.timeoutMs || 1500;

    try {
      const reply = await bridgeRequest<BridgeReply>({ port, path: '/ping', timeoutMs: timeout });
      return {
        isAvailable: reply.ok !== false,
        name: this.name,
        port,
        version: reply.version,
        message: `IDM 桥接服务已连接 (端口: ${port})`,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        isAvailable: false,
        name: this.name,
        port,
        message: `未检测到 IDM 桥接服务 (端口 ${port})，请先运行 tools/idm-bridge.ps1`,
        lastChecked: Date.now(),
      };
    }
  }

  public async sendDownload(
    payload: ExternalDownloadPayload,
    options?: DownloaderRuntimeOptions
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const port = options?.port || this.defaultPort;
    const failures: string[] = [];
    let delivered = 0;
    const safeTitle = (payload.title || 'bili-dl').replace(/[\\/:*?"<>|]/g, '_').trim() || 'bili-dl';
    // 调用方通常只传 { port }，所以这里自己读一次设置，避免依赖调用方透传
    const settings = getDownloadSettings();
    const useTitleFolder = options?.autoTitleFolder !== undefined
      ? options.autoTitleFolder !== false
      : settings.autoTitleFolder !== false;
    const prompt = options?.prompt !== undefined
      ? options.prompt === true
      : settings.alwaysAskSaveAs === true;

    for (const source of payload.sources) {
      const isAudio = source.type === 'audio';
      const job: IdmJobRequest = {
        url: source.url,
        referer: source.headers?.Referer || 'https://www.bilibili.com/',
        cookie: source.headers?.Cookie || '',
        userAgent: source.headers?.['User-Agent'] || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        // 画面不指定名字 → 桥接取服务器 URL 里的文件名；音频统一叫 audio
        filename: isAudio ? 'audio' : '',
        type: isAudio ? 'audio' : 'video',
        subfolder: useTitleFolder ? safeTitle : '',
        prompt,
      };

      try {
        const reply = await bridgeRequest<BridgeReply>({
          port,
          path: '/download',
          method: 'POST',
          body: job,
        });
        if (reply.ok === false) {
          throw new Error(reply.error || '桥接服务拒绝该任务');
        }
        delivered += 1;
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        failures.push(`${source.type || 'file'}: ${msg}`);
        logger.warn('IDM', `投递失败 (${source.type || 'file'}): ${msg}`);
      }
    }

    if (delivered === 0) {
      return { success: false, message: failures[0] || '未能投递到 IDM', details: { failures } };
    }

    const splitHint = payload.sources.length > 1 ? '（画面与音频是两个文件，需用 ffmpeg 合并）' : '';
    return {
      success: true,
      message: `已向 IDM 投递 ${delivered}/${payload.sources.length} 个文件${splitHint}`,
      details: { failures },
    };
  }
}

export const idmDownloader = new IdmDownloader();
