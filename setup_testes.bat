@echo off
title Hawk Driver — npm install (Tailwind + Testes)
color 0A
echo.
echo  =====================================================
echo   HAWK DRIVER — Instalando todas as dependencias
echo  =====================================================
echo.

echo [1/2] Instalando todas as dependencias (npm install)...
echo       Isso instala Tailwind CSS, Vitest e demais pacotes.
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao instalar. Verifique o Node.js e tente novamente.
    pause
    exit /b 1
)

echo.
echo [2/2] Rodando os testes unitarios...
echo.
call npm test

echo.
echo  =====================================================
echo   Tudo instalado! Pode iniciar com iniciar_projeto.bat
echo  =====================================================
echo.
pause
