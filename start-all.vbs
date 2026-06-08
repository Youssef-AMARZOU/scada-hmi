Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

indusDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Kill existing processes
WshShell.Run "taskkill /F /IM electron.exe", 0, False
WshShell.Run "taskkill /F /IM node.exe", 0, False
WScript.Sleep 1000

' Start servers in parallel (no sequential waits)
influxExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\influxdb2\influxd.exe"
If FSO.FileExists(influxExe) Then
    WshShell.Run """" & influxExe & """", 0, False
End If

cmd1 = "cmd /c ""cd /d """ & indusDir & """ && node scripts\local-opcua-server.js"""
WshShell.Run cmd1, 0, False

cmd2 = "cmd /c ""cd /d """ & indusDir & """ && node scripts\local-modbus-server.js"""
WshShell.Run cmd2, 0, False

' Short wait for servers to initialize
WScript.Sleep 3000

' Use production build if available
distPath = indusDir & "\dist\index.html"
If FSO.FileExists(distPath) Then
    cmd3 = "cmd /c ""cd /d """ & indusDir & """ && npx electron ."""
Else
    cmd3 = "cmd /c ""cd /d """ & indusDir & """ && npx vite"""
    WshShell.Run cmd3, 0, False
    WScript.Sleep 4000
    cmd3 = "cmd /c ""cd /d """ & indusDir & """ && set VITE_DEV_SERVER_URL=http://localhost:5173 && npx electron ."""
End If
WshShell.Run cmd3, 0, False

MsgBox "INDUS demarre !" & vbCrLf & vbCrLf & _
       "InfluxDB: http://localhost:8086" & vbCrLf & _
       "OPC-UA : opc.tcp://localhost:4840" & vbCrLf & _
       "Modbus : localhost:502" & vbCrLf & _
       "MQTT   : localhost:1883", vbInformation, "INDUS Platform"
