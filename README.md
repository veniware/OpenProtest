# Pro-test
### A management base for System Admins and IT professionals.

*[![GitHub](https://img.shields.io/github/license/veniware/openprotest)](https://github.com/veniware/OpenProtest/blob/master/LICENSE)*
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/veniware/openprotest)
*[![GitHub All Releases](https://img.shields.io/github/downloads/veniware/openprotest/total)](https://github.com/veniware/OpenProtest/releases/latest)*
*[![GitHub Release Date](https://img.shields.io/github/release-date/veniware/openprotest)](https://github.com/veniware/OpenProtest/releases/latest)*
*[![GitHub commits since latest release](https://img.shields.io/github/commits-since/veniware/openprotest/latest)](https://github.com/veniware/OpenProtest/releases/latest)*


#### This repository contains the source code for:
  * **Protest:** Front-end interface, address-book, database, network diagnostics tools, fetching and managing utilities.
  * **Proserv:** A service wrapper that allows you to run Pro-test as a win32 service.
  * **Protool:** A tool that allows you to convert IP2LOCATION files and IEEE mac file to optimized binary files.
  * **Protest remote agent**


With Pro-test you can create an inventory database of your network environment. It gathers data by communicating with Active Directory or by scanning your local network. Pro-test will automatically populate a database by targeting your domain controller, or a specified IP range. It can also fetch information from CISCO router and switches, MikroTik, and HPE. Keep a record of Hardware specification, model and serial number, network information, user information, devices up-time, and more.

Be more productive: with one-click, you can connect to your remote hosts over SSH, RDP, SMB, uVNC or PSExec. send a Wake On Lan packets or turn off, restart, or log off your network hosts. Also, you can manage processes and services and enable, disable, or unlock users.


**Additional tools can help you manage and troubleshoot:**
  * Documentation
  * Debit notes
  * Watchdog
  * Ping
  * DNS lookup
  * DHCP discover
  * NTP client
  * Trace route
  * Port scan
  * Locate IP, proxy and tor detection  *[demo](https://veniware.github.io/#locateip)*
  * MAC lookup  *[demo](https://veniware.github.io/#maclookup)*
  * Website check
  * Sub-net calculator  *[demo](https://veniware.github.io/#netcalc)*
  * Password generator  *[demo](https://veniware.github.io/#passgen)*
  * WMI console
  * Telnet client



Pro-test is portable and self-contained. You can access a web interface via the loopback address without authentication. If you wish to interface from a remote host, you can modify the http_ip and http_port parameters in the protest.cfg file to the local end-point of your choice. 
Requests from IPs other than loopback are rejected and require a username and a password to proceed. The username must be whitelisted in the config.txt file, and then your domain controller will handle the authentication.

To use pro-test to its full capabilities, it must be run with network administrator privileges. *(It uses WMI, active directory services, and remote-powershell to gather information)*

If you use a reverse proxy, for the authentication to work properly, you need to pass the "X-Forwarded-For" header from your proxy to the back-end.

For more informations check the in-app user-guide.

* *This product includes IP2Location LITE data available from http://www.ip2location.com.*
* *This product includes IP2Proxy LITE data available from https://www.ip2location.com/proxy-database.*
