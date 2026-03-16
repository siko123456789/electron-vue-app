!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

Var AutoStartCheckbox
Var AutoStartState

Function AutoStartPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "安装选项" "请选择是否启用开机自启"

  ${NSD_CreateLabel} 0 0 100% 24u "建议开启：应用将以托盘方式后台常驻（不会影响正常使用）。"
  Pop $1

  ${NSD_CreateCheckbox} 0 30u 100% 12u "开机自启动"
  Pop $AutoStartCheckbox

  ${If} $AutoStartState == 1
    ${NSD_Check} $AutoStartCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function AutoStartPageLeave
  ${NSD_GetState} $AutoStartCheckbox $AutoStartState
FunctionEnd

!macro customWelcomePage
  Page custom AutoStartPageCreate AutoStartPageLeave
!macroend

!macro customInstall
  ${If} $AutoStartState == 1
    ${If} $installMode == "all"
      WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$\"$appExe$\" --autostart"
    ${Else}
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$\"$appExe$\" --autostart"
    ${EndIf}
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
    DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  ${EndIf}
!macroend