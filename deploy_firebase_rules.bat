@echo off
title Hawk Driver — Deploy Firebase Security Rules
color 0B
echo.
echo  =====================================================
echo   HAWK DRIVER — Deploy das Firebase Security Rules
echo  =====================================================
echo.

echo [1/3] Verificando Firebase CLI...
call firebase --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Firebase CLI nao encontrado. Instalando...
    call npm install -g firebase-tools
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar Firebase CLI.
        pause
        exit /b 1
    )
)
echo Firebase CLI OK.
echo.

echo [2/3] Login no Firebase (abrira o navegador)...
echo      Faca login com a conta: hawklucasribeiro@gmail.com
echo.
call firebase login

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha no login do Firebase.
    pause
    exit /b 1
)

echo.
echo [3/3] Fazendo deploy das Security Rules...
call firebase deploy --only firestore:rules --project uberfinances-e7d4e

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha no deploy das rules.
    echo Tente colar o conteudo de firestore.rules manualmente no Firebase Console:
    echo https://console.firebase.google.com/project/uberfinances-e7d4e/firestore/rules
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo   Security Rules aplicadas com sucesso!
echo   Seu Firestore agora esta protegido em producao.
echo  =====================================================
echo.
pause
