Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

indusDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Kill existing processes
WshShell.Run "taskkill /F /IM electron.exe", 0, False
WshShell.Run "taskkill /F /IM node.exe", 0, False
WScript.Sleep 1500

' Start InfluxDB
influxExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\influxdb2\influxd.exe"
If FSO.FileExists(influxExe) Then
    WshShell.Run """" & influxExe & """", 0, False
    WScript.Sleep 4000
End If

' Start OPC-UA server
cmd1 = "cmd /c ""cd /d """ & indusDir & """ && node scripts\local-opcua-server.js"""
WshShell.Run cmd1, 0, False
WScript.Sleep 3500

' Start Modbus server
cmd2 = "cmd /c ""cd /d """ & indusDir & """ && node scripts\local-modbus-server.js"""
WshShell.Run cmd2, 0, False
WScript.Sleep 2500

' Start Vite dev server
cmd3 = "cmd /c ""cd /d """ & indusDir & """ && npx vite"""
WshShell.Run cmd3, 0, False
WScript.Sleep 6000

' Start Electron app
cmd4 = "cmd /c ""cd /d """ & indusDir & """ && set VITE_DEV_SERVER_URL=http://localhost:5173 && npx electron ."""
WshShell.Run cmd4, 0, False
WScript.Sleep 2000

MsgBox "INDUS demarre avec InfluxDB !" & vbCrLf & vbCrLf & _
       "InfluxDB: http://localhost:8086" & vbCrLf & _
       "OPC-UA : opc.tcp://localhost:4840" & vbCrLf & _
       "Modbus : localhost:502" & vbCrLf & _
       "MQTT   : localhost:1883", vbInformation, "INDUS Platform"
