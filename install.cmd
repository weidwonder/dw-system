@echo off
REM Windows 包装：让 install 无需手写 node 前缀
node "%~dp0install.mjs" %*
