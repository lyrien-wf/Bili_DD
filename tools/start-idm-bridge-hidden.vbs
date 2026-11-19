' 静默启动 IDM 桥接服务（不显示控制台窗口）
' 用法：双击本文件；或把它的快捷方式放进「启动」文件夹实现开机自启：
'   Win + R  ->  shell:startup  ->  把本文件的快捷方式粘进去
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = scriptDir

ps1 = scriptDir & "\idm-bridge.ps1"

' 优先用 pwsh（PowerShell 7），没有则回退 Windows PowerShell
on error resume next
sh.Run "pwsh -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
if Err.Number <> 0 then
  Err.Clear
  sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
end if
if Err.Number <> 0 then
  MsgBox "启动 IDM 桥接失败：" & Err.Description, 16, "bili-dl IDM 桥接"
end if
