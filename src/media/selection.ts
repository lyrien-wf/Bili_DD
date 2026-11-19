/**
 * 音视频轨选择策略
 *
 * 个人版约定：UI 不再让用户逐条选择音频轨，一律由这里挑选「官方质量最高的可混流音轨」。
 *
 * 为什么不是简单地取 audios[0]：
 * B 站响应里的音频轨顺序是 dolby → flac → 普通 AAC，直接取第一条会拿到杜比或 FLAC。
 * 其中 FLAC（fLaC 样本入口）塞进 MP4 后多数播放器/剪辑软件无法识别，等于产出坏文件，
 * 所以混流场景下 FLAC 必须排在最后兜底，而不是"质量最高所以优先"。
 */

import type { AudioStreamItem, VideoStreamItem } from '../types';

type AudioFamily = 'aac' | 'dolby' | 'flac' | 'other';

/** 混流兼容性权重：AAC 最稳，杜比次之，FLAC 兜底 */
const AUDIO_FAMILY_RANK: Record<AudioFamily, number> = {
  aac: 3,
  dolby: 2,
  other: 1,
  flac: 0,
};

/** 视频编码偏好：AVC 兼容性最好，HEVC 次之，AV1 最后 */
const VIDEO_CODEC_RANK: Record<string, number> = {
  AVC: 3,
  HEVC: 2,
  AV1: 1,
};

export function getAudioFamily(audio: AudioStreamItem): AudioFamily {
  const codec = (audio.codec || '').toLowerCase();
  if (codec.includes('flac')) return 'flac';
  if (codec.includes('ec-3') || codec.includes('ac-3') || codec.includes('eac3')) return 'dolby';
  if (codec.includes('mp4a') || codec.includes('aac')) return 'aac';
  return 'other';
}

/**
 * 选出用于混流的音轨：同族内码率最高者优先，跨族按兼容性权重排序。
 * 返回 undefined 表示没有任何可用音轨（调用方按"仅画面"处理）。
 */
export function pickBestAudio(audios: AudioStreamItem[] | undefined): AudioStreamItem | undefined {
  if (!audios || audios.length === 0) return undefined;
  return [...audios].sort((a, b) => {
    const familyDiff = AUDIO_FAMILY_RANK[getAudioFamily(b)] - AUDIO_FAMILY_RANK[getAudioFamily(a)];
    if (familyDiff !== 0) return familyDiff;
    return (b.bandwidth || 0) - (a.bandwidth || 0);
  })[0];
}

/**
 * 选出画质最高的视频轨：分辨率 → 码率 → 编码兼容性。
 * 用于所有文案声称"最高画质"的入口，避免依赖接口返回顺序。
 */
export function pickHighestQualityVideo(
  videos: VideoStreamItem[] | undefined
): VideoStreamItem | undefined {
  if (!videos || videos.length === 0) return undefined;
  return [...videos].sort((a, b) => {
    const heightDiff = (b.height || 0) - (a.height || 0);
    if (heightDiff !== 0) return heightDiff;
    const bandwidthDiff = (b.bandwidth || 0) - (a.bandwidth || 0);
    if (bandwidthDiff !== 0) return bandwidthDiff;
    return (VIDEO_CODEC_RANK[b.codecName] || 0) - (VIDEO_CODEC_RANK[a.codecName] || 0);
  })[0];
}
