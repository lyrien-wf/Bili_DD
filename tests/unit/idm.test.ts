import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GM_xmlhttpRequest } from '$';
import { IdmDownloader, IDM_DEFAULT_PORT } from '../../src/downloader/idm';
import type { ExternalDownloadPayload } from '../../src/downloader/types';
import { saveDownloadSettings, DEFAULT_SETTINGS } from '../../src/utils/settings';

const { gmStore } = vi.hoisted(() => ({ gmStore: new Map<string, unknown>() }));

vi.mock('$', () => ({
  GM_xmlhttpRequest: vi.fn(),
  GM_getValue: (key: string, fallback?: unknown) => (gmStore.has(key) ? gmStore.get(key) : fallback),
  GM_setValue: (key: string, value: unknown) => {
    gmStore.set(key, value);
  },
}));

type CapturedRequest = {
  method?: string;
  url: string;
  data?: string;
  responseType?: string;
};

function mockBridge(handler: (req: CapturedRequest) => { status: number; body: unknown } | { error: string }) {
  vi.mocked(GM_xmlhttpRequest).mockImplementation((opts) => {
    const result = handler({
      method: opts.method,
      url: opts.url,
      data: opts.data as string | undefined,
      responseType: opts.responseType,
    });
    setTimeout(() => {
      if ('error' in result) {
        opts.onerror?.({ error: result.error } as never);
        return;
      }
      opts.onload?.({
        status: result.status,
        statusText: 'OK',
        responseHeaders: '',
        response: result.body,
        responseText: JSON.stringify(result.body),
      } as never);
    }, 0);
    return { abort: vi.fn() } as never;
  });
}

const payload: ExternalDownloadPayload = {
  title: '测试视频',
  sources: [
    {
      url: 'https://upos.bilivideo.com/video.m4s',
      filename: '测试视频_视频.m4s',
      type: 'video',
      headers: {
        Referer: 'https://www.bilibili.com/',
        Cookie: 'SESSDATA=abc',
        'User-Agent': 'UA-test',
      },
    },
    {
      url: 'https://upos.bilivideo.com/audio.m4s',
      filename: '测试视频_音频.m4s',
      type: 'audio',
      headers: {
        Referer: 'https://www.bilibili.com/',
        Cookie: 'SESSDATA=abc',
        'User-Agent': 'UA-test',
      },
    },
  ],
};

describe('IdmDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('默认端口为 15152', () => {
    expect(IDM_DEFAULT_PORT).toBe(15152);
    expect(new IdmDownloader().defaultPort).toBe(15152);
  });

  it('桥接服务 /ping 正常时报告可用', async () => {
    mockBridge(() => ({ status: 200, body: { ok: true, version: '1.0' } }));

    const status = await new IdmDownloader().checkAvailability({ port: 15152 });

    expect(status.isAvailable).toBe(true);
    expect(status.port).toBe(15152);
    expect(status.message).toContain('桥接服务已连接');
  });

  it('桥接服务不可达时报告不可用并给出启动提示', async () => {
    mockBridge(() => ({ error: 'connection refused' }));

    const status = await new IdmDownloader().checkAvailability({ port: 15152 });

    expect(status.isAvailable).toBe(false);
    expect(status.message).toContain('idm-bridge.ps1');
  });

  it('逐条投递：短名 v/a + 类型 + 子目录，Referer/Cookie/UA 一并带上', async () => {
    const captured: CapturedRequest[] = [];
    mockBridge((req) => {
      captured.push(req);
      return { status: 200, body: { ok: true } };
    });

    const res = await new IdmDownloader().sendDownload(payload, { port: 15152 });

    expect(res.success).toBe(true);
    expect(captured).toHaveLength(2);
    expect(captured[0]?.url).toBe('http://127.0.0.1:15152/download');
    expect(captured[0]?.method).toBe('POST');

    const first = JSON.parse(captured[0]!.data!);
    expect(first.url).toBe('https://upos.bilivideo.com/video.m4s');
    expect(first.referer).toBe('https://www.bilibili.com/');
    expect(first.cookie).toBe('SESSDATA=abc');
    expect(first.userAgent).toBe('UA-test');
    expect(first.filename).toBe('');
    expect(first.type).toBe('video');
    expect(first.subfolder).toBe('测试视频');
    expect(first.prompt).toBe(false);

    const second = JSON.parse(captured[1]!.data!);
    expect(second.filename).toBe('audio');
    expect(second.type).toBe('audio');
    expect(second.subfolder).toBe('测试视频');
    expect(second.prompt).toBe(false);

    // 界面要提示用户：这是两个文件，需要合并
    expect(res.message).toContain('2/2');
    expect(res.message).toContain('ffmpeg');
  });

  it('关闭「自动创建视频专属子文件夹」时不传 subfolder', async () => {
    const captured: CapturedRequest[] = [];
    mockBridge((req) => {
      captured.push(req);
      return { status: 200, body: { ok: true } };
    });

    await new IdmDownloader().sendDownload(payload, { port: 15152, autoTitleFolder: false });

    expect(JSON.parse(captured[0]!.data!).subfolder).toBe('');
  });

  it('开启「每次下载前确认」时让 IDM 弹开始下载对话框', async () => {
    const captured: CapturedRequest[] = [];
    mockBridge((req) => {
      captured.push(req);
      return { status: 200, body: { ok: true } };
    });

    await new IdmDownloader().sendDownload(payload, { port: 15152, prompt: true });

    expect(JSON.parse(captured[0]!.data!).prompt).toBe(true);
  });

  it('调用方只传端口时，也要按设置里的开关决定子文件夹与确认框', async () => {
    saveDownloadSettings({ ...DEFAULT_SETTINGS, autoTitleFolder: false, alwaysAskSaveAs: true });

    const captured: CapturedRequest[] = [];
    mockBridge((req) => {
      captured.push(req);
      return { status: 200, body: { ok: true } };
    });

    await new IdmDownloader().sendDownload(payload, { port: 15152 });

    const first = JSON.parse(captured[0]!.data!);
    expect(first.subfolder).toBe('');
    expect(first.prompt).toBe(true);

    saveDownloadSettings({ ...DEFAULT_SETTINGS });
  });

  it('桥接服务返回 ok:false 时整单失败', async () => {
    mockBridge(() => ({ status: 200, body: { ok: false, error: '找不到 IDM COM 组件' } }));

    const res = await new IdmDownloader().sendDownload(payload, { port: 15152 });

    expect(res.success).toBe(false);
    expect(res.message).toContain('找不到 IDM COM 组件');
  });

  it('桥接服务返回 500 时把真实错误原因透传出来', async () => {
    mockBridge(() => ({ status: 500, body: { ok: false, error: 'IDM 拒绝该任务' } }));

    const res = await new IdmDownloader().sendDownload(payload, { port: 15152 });

    expect(res.success).toBe(false);
    expect(res.message).toContain('IDM 拒绝该任务');
  });

  it('一条成功一条失败时仍返回成功并列出失败项', async () => {
    let call = 0;
    mockBridge(() => {
      call += 1;
      return call === 1 ? { status: 200, body: { ok: true } } : { status: 500, body: { ok: false } };
    });

    const res = await new IdmDownloader().sendDownload(payload, { port: 15152 });

    expect(res.success).toBe(true);
    expect(res.message).toContain('1/2');
    expect((res.details as { failures: string[] }).failures).toHaveLength(1);
  });
});
