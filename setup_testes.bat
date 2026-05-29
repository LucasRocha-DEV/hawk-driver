@echo off
title Hawk Driver — Instalando Testes
color 0A
echo.
echo  =====================================================
echo   HAWK DRIVER — Setup de Testes Unitarios (Vitest)
echo  =====================================================
echo.

echo [1/3] Instalando dependencias de teste...
echo.
call npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao instalar dependencias. Verifique o Node.js.
    pause
    exit /b 1
)

echo.
echo [2/3] Rodando os testes unitarios...
echo.
call npm test

echo.
echo [3/3] Gerando relatorio de cobertura de codigo...
echo.
call npm run test:coverage

echo.
echo  =====================================================
echo   Testes concluidos! Veja o resultado acima.
echo  =====================================================
echo.
pause
