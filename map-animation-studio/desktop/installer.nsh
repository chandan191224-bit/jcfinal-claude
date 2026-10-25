; If the studio is open while installing or updating, ask once, close it, and carry on
; (electron-builder's default check can wrongly report it as running and block the install).
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /NH | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
  Pop $0
  ${if} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "Map Animation Studio is open. Click OK to close it and continue (your projects are saved automatically)." /SD IDOK IDOK closeIt
    Quit
    closeIt:
    nsExec::Exec `"$SYSDIR\taskkill.exe" /IM "${APP_EXECUTABLE_FILENAME}" /F`
    Pop $0
    Sleep 1500
  ${endif}
!macroend
