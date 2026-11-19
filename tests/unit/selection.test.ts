import { describe, it, expect } from 'vitest';
import { pickBestAudio, pickHighestQualityVideo, getAudioFamily } from '../../src/media/selection';
import type { AudioStreamItem, VideoStreamItem } from '../../src/types';

function audio(partial: Partial<AudioStreamItem> & { id: number; bandwidth: number }): AudioStreamItem {
  return {
    name: `音频 ${partial.id}`,
    qualityDesc: '标准音质',
    codec: 'mp4a.40.2',
    sizeMB: '10',
    baseUrl: `https://example.com/${partial.id}.m4s`,
    ...partial,
  };
}

function video(partial: Partial<VideoStreamItem> & { id: number; height: number; bandwidth: number }): VideoStreamItem {
  return {
    qualityName: `${partial.height}P`,
    codecName: 'AVC',
    codec: 'avc1.640028',
    sizeMB: '100',
    baseUrl: `https://example.com/v${partial.id}.m4s`,
    width: Math.round((partial.height * 16) / 9),
    frameRate: '30',
    ...partial,
  };
}

describe('音频轨选择', () => {
  it('识别音轨编码家族', () => {
    expect(getAudioFamily(audio({ id: 30280, bandwidth: 320000 }))).toBe('aac');
    expect(getAudioFamily(audio({ id: 30250, bandwidth: 448000, codec: 'ec-3' }))).toBe('dolby');
    expect(getAudioFamily(audio({ id: 30251, bandwidth: 1500000, codec: 'fLaC' }))).toBe('flac');
  });

  it('即使 FLAC 码率更高，也不会被选为混流音轨', () => {
    const picked = pickBestAudio([
      audio({ id: 30251, bandwidth: 1500000, codec: 'fLaC' }),
      audio({ id: 30280, bandwidth: 320000 }),
    ]);
    expect(picked?.id).toBe(30280);
  });

  it('同族内选码率最高者', () => {
    const picked = pickBestAudio([
      audio({ id: 30216, bandwidth: 64000 }),
      audio({ id: 30280, bandwidth: 320000 }),
      audio({ id: 30232, bandwidth: 132000 }),
    ]);
    expect(picked?.id).toBe(30280);
  });

  it('只有 FLAC 时仍能兜底返回', () => {
    const picked = pickBestAudio([audio({ id: 30251, bandwidth: 1500000, codec: 'fLaC' })]);
    expect(picked?.id).toBe(30251);
  });

  it('空输入返回 undefined', () => {
    expect(pickBestAudio([])).toBeUndefined();
    expect(pickBestAudio(undefined)).toBeUndefined();
  });
});

describe('视频轨选择', () => {
  it('按分辨率优先，其次码率', () => {
    const picked = pickHighestQualityVideo([
      video({ id: 80, height: 1080, bandwidth: 9000000 }),
      video({ id: 120, height: 2160, bandwidth: 4000000 }),
      video({ id: 112, height: 1080, bandwidth: 12000000 }),
    ]);
    expect(picked?.id).toBe(120);
  });

  it('同分辨率同码率时偏好 AVC', () => {
    const picked = pickHighestQualityVideo([
      video({ id: 80, height: 1080, bandwidth: 5000000, codecName: 'AV1' }),
      video({ id: 80, height: 1080, bandwidth: 5000000, codecName: 'AVC' }),
    ]);
    expect(picked?.codecName).toBe('AVC');
  });

  it('空输入返回 undefined', () => {
    expect(pickHighestQualityVideo([])).toBeUndefined();
  });
});
