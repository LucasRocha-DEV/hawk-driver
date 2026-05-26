@echo off
title Iniciar Hawk Driver
echo ===================================================
echo   Iniciando o Hawk Driver (Instalando dependencias)
echo ===================================================
echo.

:: Verifica se a pasta node_modules existe.
if not exist node_modules (
    echo Instalando as dependencias do projeto...
    call npm install
) else (
    echo Verificando e atualizando as dependencias...
    call npm install
)

echo.
echo ===================================================
echo   Iniciando o servidor Vite de desenvolvimento...
echo ===================================================
echo.

:: Abre o navegador automaticamente no link do app
start http://localhost:5173/

:: Inicia o Vite
call npm run dev

pause
