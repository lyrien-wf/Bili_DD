# =============================================================================
#  IDM 本地桥接服务（bili-dl 个人改款配套脚本）
#
#  作用：浏览器里的油猴脚本不能直接调用 IDM 的 COM 接口，所以起一个只监听
#        127.0.0.1 的极小 HTTP 服务，收到任务后转发给 IDM：
#
#    POST /download  {"url","referer","cookie","userAgent","filename"}
#    GET  /ping      -> {"ok":true,"version":"1.0"}
#
#  用法（任选一种）：
#    powershell -ExecutionPolicy Bypass -File .\tools\idm-bridge.ps1
#    powershell -ExecutionPolicy Bypass -File .\tools\idm-bridge.ps1 -Port 15152 -DryRun
#
#  参数：
#    -Port      监听端口，默认 15152（脚本设置页里要填同一个端口）
#    -Folder    保存目录，留空则用系统的「下载」文件夹
#    -DryRun    只打印不真正调用 IDM，用于验证连通性
#    -SelfTest  只做一次 COM 调用自检（入队但不开始），然后退出
#
#  注意：IDM 只下载不合并，B 站推过来必然是「视频 + 音频」两个文件。
# =============================================================================

[CmdletBinding()]
param(
  [int]$Port = 15152,
  [string]$Folder = '',
  [switch]$DryRun,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$Version = '1.2'

if (-not $Folder) {
  $Folder = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
}

# ------------------------------------------------------- 强类型 COM 互操作
# IDM 的 ICIDMLinkTransmitter 是纯 IUnknown 接口（非 IDispatch），PowerShell /
# VBScript 的晚绑定调不到方法，必须声明 vtable 布局后用 COM interop 调用。
# IID/CLSID 取自官方 IDManTypeInfo_i.c。
$IdmComSource = @'
using System;
using System.Runtime.InteropServices;

namespace IdmBridge
{
    [ComImport]
    [Guid("4BD46AAE-C51F-4BF7-8BC0-2E86E33D1873")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ICIDMLinkTransmitter
    {
        void SendLinkToIDM(
            [MarshalAs(UnmanagedType.BStr)] string bstrUrl,
            [MarshalAs(UnmanagedType.BStr)] string bstrReferer,
            [MarshalAs(UnmanagedType.BStr)] string bstrCookies,
            [MarshalAs(UnmanagedType.BStr)] string bstrData,
            [MarshalAs(UnmanagedType.BStr)] string bstrUser,
            [MarshalAs(UnmanagedType.BStr)] string bstrPassword,
            [MarshalAs(UnmanagedType.BStr)] string bstrLocalPath,
            [MarshalAs(UnmanagedType.BStr)] string bstrLocalFileName,
            int lFlags);
    }

    public static class IdmClient
    {
        private const string Clsid = "AC746233-E9D3-49CD-862F-068F7B7CCCA4";

        public static void Send(string url, string referer, string cookies, string localPath, string fileName, int flags)
        {
            Type t = Type.GetTypeFromCLSID(new Guid(Clsid), true);
            object raw = Activator.CreateInstance(t);
            try
            {
                ICIDMLinkTransmitter idm = (ICIDMLinkTransmitter)raw;
                idm.SendLinkToIDM(url, referer, cookies, null, null, null, localPath, fileName, flags);
            }
            finally
            {
                if (raw != null && Marshal.IsComObject(raw))
                {
                    Marshal.ReleaseComObject(raw);
                }
            }
        }
    }
}
'@

try {
  Add-Type -TypeDefinition $IdmComSource -Language CSharp -ErrorAction Stop
}
catch {
  Write-Host "无法编译 IDM 互操作代码：$($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

if ($SelfTest) {
  Write-Host "IDM COM 自检：向 IDM 队列添加一条测试任务（不会开始下载），保存目录 $Folder"
  try {
    [IdmBridge.IdmClient]::Send('http://127.0.0.1:1/idm-bridge-selftest.txt', 'https://www.bilibili.com/', '', $Folder, 'idm-bridge-selftest.txt', 2)
    Write-Host '自检成功：COM 调用已被 IDM 接受。去 IDM 里把这条测试任务删掉即可。' -ForegroundColor Green
    exit 0
  }
  catch {
    Write-Host "自检失败：$($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.InnerException) { Write-Host "  内部错误：$($_.Exception.InnerException.Message)" -ForegroundColor Red }
    exit 1
  }
}

# ---------------------------------------------------------------- HTTP helpers

function Read-HeaderBlock {
  param([System.IO.Stream]$Stream)

  $bytes = [System.Collections.Generic.List[byte]]::new()
  $one = [byte[]]::new(1)

  while ($true) {
    $n = $Stream.Read($one, 0, 1)
    if ($n -le 0) { return $null }
    $bytes.Add($one[0])
    $count = $bytes.Count
    if ($count -ge 4 -and
        $bytes[$count - 4] -eq 13 -and $bytes[$count - 3] -eq 10 -and
        $bytes[$count - 2] -eq 13 -and $bytes[$count - 1] -eq 10) {
      break
    }
    if ($count -gt 65536) { throw '请求头过长' }
  }

  $text = [System.Text.Encoding]::ASCII.GetString($bytes.GetRange(0, $bytes.Count - 4).ToArray())
  return $text
}

function Read-AsciiLine {
  param([System.IO.Stream]$Stream)

  $bytes = [System.Collections.Generic.List[byte]]::new()
  $one = [byte[]]::new(1)
  while ($true) {
    $n = $Stream.Read($one, 0, 1)
    if ($n -le 0) { return $null }
    if ($one[0] -eq 10) { break }
    if ($one[0] -ne 13) { $bytes.Add($one[0]) }
  }
  return [System.Text.Encoding]::ASCII.GetString($bytes.ToArray())
}

function Read-Body {
  param(
    [System.IO.Stream]$Stream,
    [hashtable]$Headers
  )

  $result = [System.Collections.Generic.List[byte]]::new()

  if ($Headers.ContainsKey('transfer-encoding') -and $Headers['transfer-encoding'] -match 'chunked') {
    while ($true) {
      $sizeLine = Read-AsciiLine -Stream $Stream
      if ($null -eq $sizeLine) { break }
      $size = [Convert]::ToInt32($sizeLine.Trim(), 16)
      if ($size -le 0) {
        Read-AsciiLine -Stream $Stream | Out-Null
        break
      }
      $buf = [byte[]]::new($size)
      $read = 0
      while ($read -lt $size) {
        $n = $Stream.Read($buf, $read, $size - $read)
        if ($n -le 0) { throw 'chunk 读取中断' }
        $read += $n
      }
      $result.AddRange($buf)
      Read-AsciiLine -Stream $Stream | Out-Null
    }
  }
  elseif ($Headers.ContainsKey('content-length')) {
    $size = [int]$Headers['content-length']
    if ($size -gt 0) {
      $buf = [byte[]]::new($size)
      $read = 0
      while ($read -lt $size) {
        $n = $Stream.Read($buf, $read, $size - $read)
        if ($n -le 0) { throw '请求体读取中断' }
        $read += $n
      }
      $result.AddRange($buf)
    }
  }

  return [System.Text.Encoding]::UTF8.GetString($result.ToArray())
}

function Write-Response {
  param(
    [System.IO.Stream]$Stream,
    [int]$Status,
    [string]$Json
  )

  $reason = switch ($Status) {
    200 { 'OK' }
    400 { 'Bad Request' }
    404 { 'Not Found' }
    default { 'Internal Server Error' }
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
  $header = "HTTP/1.1 $Status $reason`r`n" +
            "Content-Type: application/json; charset=utf-8`r`n" +
            "Content-Length: $($bytes.Length)`r`n" +
            "Connection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($bytes, 0, $bytes.Length)
  $Stream.Flush()
}

# ------------------------------------------------------------------ IDM bridge

function Get-UrlBaseName {
  param(
    [string]$Url,
    [string]$Fallback = 'video'
  )
  try {
    $uri = [Uri]$Url
    $name = [System.IO.Path]::GetFileName($uri.AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($name)) { return $Fallback }
    return $name
  }
  catch {
    return $Fallback
  }
}

function Resolve-MediaExtension {
  param(
    [string]$Url,
    [string]$Referer,
    [string]$UserAgent,
    [string]$Hint
  )

  $fallback = if ($Hint -eq 'audio') { 'm4a' } else { 'mp4' }
  try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    $resp = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 12 -Headers @{
      'Range'      = 'bytes=0-1'
      'Referer'    = $Referer
      'User-Agent' = $UserAgent
    }
    $contentType = [string]$resp.Headers['Content-Type']
    $contentType = $contentType.ToLowerInvariant()
    Write-Host "探测 Content-Type: $contentType"

    if ($contentType -match 'flac') { return 'flac' }
    if ($contentType -match '^audio/') {
      # 音频轨在 MP4 容器里 → m4a；audio/mp4 以外的音频格式按声明走
      if ($contentType -match 'mp4|m4a') { return 'm4a' }
      return $fallback
    }
    if ($contentType -match 'video/') { return 'mp4' }
    # application/octet-stream 之类没有可依据的声明 → 用类型兜底
    return $fallback
  }
  catch {
    Write-Host "探测 Content-Type 失败，按类型兜底为 .$fallback ($($_.Exception.Message))" -ForegroundColor DarkYellow
    return $fallback
  }
}

function Invoke-IdmJob {
  param(
    [string]$Url,
    [string]$Referer,
    [string]$Cookie,
    [string]$UserAgent,
    [string]$BaseName,
    [string]$Hint,
    [string]$SubFolder,
    [bool]$Prompt = $false
  )

  if (-not $Url) { throw '缺少 url 参数' }

  # 画面：没指定名字时用服务器 URL 里的文件名；音频：固定 audio
  $rawBase = $BaseName
  if ([string]::IsNullOrWhiteSpace($rawBase)) {
    $fallbackName = if ($Hint -eq 'audio') { 'audio' } else { 'video' }
    $rawBase = Get-UrlBaseName -Url $Url -Fallback $fallbackName
  }

  $safeBase = ($rawBase -replace '[\\/:*?"<>|]', '_').Trim()
  # 去掉自带的扩展名，避免出现 xxx.mp4.mp4
  $safeBase = [System.IO.Path]::GetFileNameWithoutExtension($safeBase)
  if ([string]::IsNullOrWhiteSpace($safeBase)) {
    $safeBase = if ($Hint -eq 'audio') { 'audio' } else { 'video' }
  }

  $safeSub = ($SubFolder -replace '[\\/:*?"<>|]', '_').Trim()

  # 探测服务器声明的类型，决定最终后缀（DryRun 也探测，方便预演文件名）
  $ext = Resolve-MediaExtension -Url $Url -Referer $Referer -UserAgent $UserAgent -Hint $Hint
  $fileName = "$safeBase.$ext"
  $targetFolder = if ($safeSub) { Join-Path $Folder $safeSub } else { $Folder }

  if ($DryRun) {
    Write-Host "[DryRun] IDM <- $Url"
    Write-Host "         将保存为: $targetFolder\$fileName (hint=$Hint prompt=$Prompt referer=$Referer cookieLen=$($Cookie.Length))"
    return
  }

  if (-not (Test-Path -LiteralPath $targetFolder)) {
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
  }

  # flags: 0 = 弹「开始下载」对话框（可改目录/文件名）；1 = 不弹框直接开始；2 = 只入队
  $flags = if ($Prompt) { 0 } else { 1 }
  [IdmBridge.IdmClient]::Send($Url, $Referer, $Cookie, $targetFolder, $fileName, $flags)

  Write-Host "IDM <- $targetFolder\$fileName (flags=$flags)"
}

# ------------------------------------------------------------------- main loop

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
  $listener.Start()
}
catch {
  Write-Host "端口 $Port 启动失败：$($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "IDM 桥接服务已启动: http://127.0.0.1:$Port" -ForegroundColor Green
if ($DryRun) { Write-Host '当前为 DryRun 模式：只打印任务，不会真的调用 IDM' -ForegroundColor Yellow }
if ($Folder) { Write-Host "保存目录: $Folder" }
Write-Host '保持此窗口打开；在脚本设置里把外部下载器选为 IDM、端口填同一个值。Ctrl+C 退出。'
Write-Host ''

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 15000
    $stream = $client.GetStream()

    $headerText = Read-HeaderBlock -Stream $stream
    if ([string]::IsNullOrWhiteSpace($headerText)) { continue }

    $lines = $headerText -split "`r`n"
    $requestLine = $lines[0].Split(' ')
    $method = $requestLine[0].ToUpperInvariant()
    $path = $requestLine[1]
    $route = $path.Split('?')[0]

    $headers = @{}
    for ($i = 1; $i -lt $lines.Count; $i++) {
      $idx = $lines[$i].IndexOf(':')
      if ($idx -gt 0) {
        $headers[$lines[$i].Substring(0, $idx).Trim().ToLowerInvariant()] = $lines[$i].Substring($idx + 1).Trim()
      }
    }

    $body = Read-Body -Stream $stream -Headers $headers

    if ($method -eq 'GET' -and $route -eq '/ping') {
      $json = @{ ok = $true; version = $Version; dryRun = [bool]$DryRun } | ConvertTo-Json -Compress
      Write-Response -Stream $stream -Status 200 -Json $json
    }
    elseif ($method -eq 'POST' -and $route -eq '/download') {
      try {
        $job = $body | ConvertFrom-Json
        Invoke-IdmJob -Url $job.url -Referer $job.referer -Cookie $job.cookie -UserAgent $job.userAgent -BaseName $job.filename -Hint $job.type -SubFolder $job.subfolder -Prompt ([bool]$job.prompt)
        $json = @{ ok = $true; message = 'queued' } | ConvertTo-Json -Compress
        Write-Response -Stream $stream -Status 200 -Json $json
      }
      catch {
        $msg = $_.Exception.Message
        if ($_.Exception.InnerException) { $msg = "$msg | $($_.Exception.InnerException.Message)" }
        Write-Host "任务失败: $msg" -ForegroundColor Red
        $json = @{ ok = $false; error = $msg } | ConvertTo-Json -Compress
        Write-Response -Stream $stream -Status 500 -Json $json
      }
    }
    else {
      Write-Response -Stream $stream -Status 404 -Json '{"ok":false,"error":"not found"}'
    }
  }
  catch {
    Write-Host "连接处理异常: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  finally {
    if ($client) { $client.Close() }
  }
}
