@echo off
REM CRM Builder - Comandos Úteis

REM Iniciar todos os serviços
pm2 start all

REM Parar todos os serviços
pm2 stop all

REM Reiniciar todos os serviços
pm2 restart all

REM Ver status dos serviços
pm2 status

REM Ver logs dos serviços
pm2 logs --lines 50 --nostream

REM Build frontend (web-admin)
cd apps\web-admin
pnpm run build
cd ..\..

REM Build backend (api)
cd apps\api
pnpm run build
cd ..\..

REM Reiniciar Nginx (Linux apenas)
sudo systemctl restart nginx

REM Ver status do Nginx (Linux apenas)
sudo systemctl status nginx

pause
