import { exists } from "https://deno.land/std/fs/exists.ts";

const envUUID = Deno.env.get('UUID') || 'e5185305-1984-4084-81e0-f77271159c62';
const proxyIP = Deno.env.get('PROXYIP') || '';
const credit = Deno.env.get('CREDIT') || 'Amine-CodeX';

// إعدادات المسؤول
const ADMIN_USERNAME = "Crypta_AmineX9";
const ADMIN_PASSWORD = "V!w7#zXp$Q94^Rm2&kT";
const BLOCK_DURATION = 5 * 60 * 60 * 1000; // 5 ساعات بالمللي ثانية

// تخزين محاولات تسجيل الدخول الفاشلة
const failedAttempts = new Map<string, { attempts: number, lastAttempt: number, blockedUntil: number }>();

const CONFIG_FILE = 'config.json';

interface Config {
  uuid?: string;
}

// Middleware للتحقق من المسؤول
async function checkAdminAuth(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  
  if (url.pathname === '/admin-login' && request.method === 'POST') {
    const formData = await request.formData();
    const username = formData.get('username')?.toString();
    const password = formData.get('password')?.toString();
    
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const attemptInfo = failedAttempts.get(ip) || { attempts: 0, lastAttempt: 0, blockedUntil: 0 };
    
    if (Date.now() < attemptInfo.blockedUntil) {
      const remainingTime = Math.ceil((attemptInfo.blockedUntil - Date.now()) / (60 * 60 * 1000));
      return new Response(JSON.stringify({ 
        error: `تم حظرك لمدة 5 ساعات بسبب محاولات تسجيل دخول فاشلة متعددة. الوقت المتبقي: ${remainingTime} ساعة`
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      failedAttempts.delete(ip);
      
      const sessionId = crypto.randomUUID();
      const response = new Response(null, {
        status: 302,
        headers: {
          'Location': `/${userID}`,
          'Set-Cookie': `admin_session=${sessionId}; Path=/; Max-Age=3600`
        }
      });
      return response;
    } else {
      const newAttempts = attemptInfo.attempts + 1;
      const blockedUntil = newAttempts >= 3 ? Date.now() + BLOCK_DURATION : 0;
      
      failedAttempts.set(ip, {
        attempts: newAttempts,
        lastAttempt: Date.now(),
        blockedUntil
      });
      
      return new Response(JSON.stringify({ 
        error: 'بيانات الدخول غير صحيحة' + 
          (newAttempts >= 2 ? ` (محاولات متبقية قبل الحظر: ${3 - newAttempts})` : '')
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (url.pathname === `/${userID}`) {
    const cookies = request.headers.get('Cookie');
    const sessionId = cookies?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('admin_session='))
      ?.split('=')[1];
    
    if (!sessionId) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/admin-login' }
      });
    }
  }
  
  return null;
}

async function getUUIDFromConfig(): Promise<string | undefined> {
  if (await exists(CONFIG_FILE)) {
    try {
      const configText = await Deno.readTextFile(CONFIG_FILE);
      const config: Config = JSON.parse(configText);
      if (config.uuid && isValidUUID(config.uuid)) {
        console.log(`Loaded UUID from ${CONFIG_FILE}: ${config.uuid}`);
        return config.uuid;
      }
    } catch (e) {
      console.warn(`Error reading or parsing ${CONFIG_FILE}:`, e.message);
    }
  }
  return undefined;
}

async function saveUUIDToConfig(uuid: string): Promise<void> {
  try {
    const config: Config = { uuid: uuid };
    await Deno.writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`Saved new UUID to ${CONFIG_FILE}: ${uuid}`);
  } catch (e) {
    console.error(`Failed to save UUID to ${CONFIG_FILE}:`, e.message);
  }
}

// Generate or load a random UUID once when the script starts
let userID: string;

if (envUUID && isValidUUID(envUUID)) {
  userID = envUUID;
  console.log(`Using UUID from environment: ${userID}`);
} else {
  const configUUID = await getUUIDFromConfig();
  if (configUUID) {
    userID = configUUID;
  } else {
    userID = crypto.randomUUID();
    console.log(`Generated new UUID: ${userID}`);
    await saveUUIDToConfig(userID);
  }
}

if (!isValidUUID(userID)) {
  throw new Error('uuid is not valid');
}

console.log(Deno.version);
console.log(`Final UUID in use: ${userID}`);

Deno.serve(async (request: Request) => {
  const authResponse = await checkAdminAuth(request);
  if (authResponse) return authResponse;

  const upgrade = request.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() != 'websocket') {
    const url = new URL(request.url);
    switch (url.pathname) {
      case '/': {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>502</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f0f2f5; color: #333; text-align: center; line-height: 1.6; }
        .container { background-color: #ffffff; padding: 40px 60px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); max-width: 600px; width: 90%; }
        h1 { color: #2c3e50; font-size: 2.8em; margin-bottom: 20px; letter-spacing: 1px; }
        p { font-size: 1.1em; color: #555; margin-bottom: 30px; }
        .button-container { margin-top: 30px; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-size: 1.1em; transition: background-color 0.3s ease, transform 0.2s ease; box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2); }
        .button:hover { background-color: #0056b3; transform: translateY(-2px); }
        .footer { margin-top: 40px; font-size: 0.9em; color: #888; }
        .footer a { color: #007bff; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcom to amine Codex Panel server</h1>
        <p>PANEL ADMIN </p>
        <div class="button-container">
            <a href="/${userID}" class="button">DONT CLICK IF U NOT A ADMIN</a>
        </div>
        <div class="footer">
            Developed by <a href="https://t.me/amine_dz46" target="_blank">@amine_dz46</a> | 
            Channel: <a href="https://t.me/aminehxdz" target="_blank">@aminehxdz</a>
        </div>
    </div>
</body>
</html>
        `;
        return new Response(htmlContent, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      
      case '/admin-login': {
        const loginHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f0f2f5; }
        .login-container { background-color: #fff; padding: 40px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #555; font-weight: 600; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
        button { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; transition: background-color 0.3s; }
        button:hover { background-color: #0056b3; }
        .error { color: #dc3545; margin-top: 10px; text-align: center; }
        .footer { margin-top: 30px; text-align: center; color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Admin Login</h1>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Login</button>
            <div id="error" class="error"></div>
        </form>
        <div class="footer">
            Only authorized administrators can access this system
        </div>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = await fetch('/admin-login', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            if (response.ok) {
                window.location.href = '/${userID}';
            } else {
                document.getElementById('error').textContent = result.error;
            }
        });
    </script>
</body>
</html>
        `;
        return new Response(loginHtml, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      
      case `/${userID}`: {
        const hostName = url.hostname;
        const port = url.port || (url.protocol === 'https:' ? 443 : 80);
        const vlessMain = `vless://${userID}@${hostName}:${port}?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${credit}`;      
        const ck = `vless://${userID}\u0040${hostName}:443?encryption=none%26security=tls%26sni=${hostName}%26fp=randomized%26type=ws%26host=${hostName}%26path=%2F%3Fed%3D2048%23${credit}`;
        const urlString = `https://deno-proxy-version.deno.dev/?check=${ck}`;
        await fetch(urlString);

        const clashMetaConfig = `
- type: vless
  name: ${hostName}
  server: ${hostName}
  port: ${port}
  uuid: ${userID}
  network: ws
  tls: true
  udp: false
  sni: ${hostName}
  client-fingerprint: chrome
  ws-opts:
    path: "/?ed=2048"
    headers:
      host: ${hostName}
`;

        const htmlConfigContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VLESS Configuration</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f0f2f5; color: #333; text-align: center; line-height: 1.6; padding: 20px; }
        .container { background-color: #ffffff; padding: 40px 60px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); max-width: 800px; width: 90%; margin-bottom: 20px; }
        h1 { color: #2c3e50; font-size: 2.5em; margin-bottom: 20px; letter-spacing: 1px; }
        h2 { color: #34495e; font-size: 1.8em; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        .config-block { background-color: #e9ecef; border-left: 5px solid #007bff; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: left; position: relative; }
        .config-block pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; font-size: 0.95em; line-height: 1.4; color: #36454F; }
        .copy-button { position: absolute; top: 10px; right: 10px; background-color: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 0.9em; transition: background-color 0.3s ease; }
        .copy-button:hover { background-color: #218838; }
        .copy-button:active { background-color: #1e7e34; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #888; }
        .footer a { color: #007bff; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .admin-bar { background-color: #2c3e50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .logout-btn { background-color: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 0.9em; }
        .logout-btn:hover { background-color: #c82333; }
    </style>
</head>
<body>
    <div class="container">
        <div class="admin-bar">
            <span>Welcome, Admin (${ADMIN_USERNAME})</span>
            <button class="logout-btn" onclick="logout()">Logout</button>
        </div>
        
        <h1>🔑 Your VLESS Configuration</h1>
        <p>Use the configurations below to set up your VLESS client. Click the "Copy" button to easily transfer the settings.</p>

        <h2>VLESS URI (for v2rayN, V2RayNG, etc.)</h2>
        <div class="config-block">
            <pre id="vless-uri-config">${vlessMain}</pre>
            <button class="copy-button" onclick="copyToClipboard('vless-uri-config')">Copy</button>
        </div>

        <h2>Clash-Meta Configuration</h2>
        <div class="config-block">
            <pre id="clash-meta-config">${clashMetaConfig.trim()}</pre>
            <button class="copy-button" onclick="copyToClipboard('clash-meta-config')">Copy</button>
        </div>
        
        <div class="footer">
            Developed by <a href="https://t.me/amine_dz46" target="_blank">@amine_dz46</a> | 
            Channel: <a href="https://t.me/aminehxdz" target="_blank">@aminehxdz</a>
        </div>
    </div>

    <script>
        function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            const textToCopy = element.innerText;
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    alert('Configuration copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    alert('Failed to copy configuration. Please copy manually.');
                });
        }
        
        function logout() {
            document.cookie = 'admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            window.location.href = '/admin-login';
        }
    </script>
</body>
</html>
`;
        return new Response(htmlConfigContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }
      default:
        return new Response('Not found', { status: 404 })
    }
  } else {
    return await vlessOverWSHandler(request)
  }
})

async function vlessOverWSHandler(request: Request) {
  const { socket, response } = Deno.upgradeWebSocket(request)
  let address = ''
  let portWithRandomLog = ''
  const log = (info: string, event = '') => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event)
  }
  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || ''
  const readableWebSocketStream = makeReadableWebSocketStream(socket, earlyDataHeader, log)
  let remoteSocketWapper: any = {
    value: null,
  }
  let udpStreamWrite: any = null
  let isDns = false

  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDns && udpStreamWrite) {
            return udpStreamWrite(chunk)
          }
          if (remoteSocketWapper.value) {
            const writer = remoteSocketWapper.value.writable.getWriter()
            await writer.write(new Uint8Array(chunk))
            writer.releaseLock()
            return
          }

          const {
            hasError,
            message,
            portRemote = 443,
            addressRemote = '',
            rawDataIndex,
            vlessVersion = new Uint8Array([0, 0]),
            isUDP,
          } = processVlessHeader(chunk, userID)
          address = addressRemote
          portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '} `
          if (hasError) {
            throw new Error(message)
            return
          }
          if (isUDP) {
            if (portRemote === 53) {
              isDns = true
            } else {
              throw new Error('UDP proxy only enable for DNS which is port 53')
              return
            }
          }
          
          const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0])
          const rawClientData = chunk.slice(rawDataIndex)

          if (isDns) {
            console.log('isDns:', isDns)
            const { write } = await handleUDPOutBound(socket, vlessResponseHeader, log)
            udpStreamWrite = write
            udpStreamWrite(rawClientData)
            return
          }
          handleTCPOutBound(
            remoteSocketWapper,
            addressRemote,
            portRemote,
            rawClientData,
            socket,
            vlessResponseHeader,
            log
          )
        },
        close() {
          log(`readableWebSocketStream is close`)
        },
        abort(reason) {
          log(`readableWebSocketStream is abort`, JSON.stringify(reason))
        },
      })
    )
    .catch((err) => {
      log('readableWebSocketStream pipeTo error', err)
    })

  return response
}

async function handleTCPOutBound(
  remoteSocket: { value: any },
  addressRemote: string,
  portRemote: number,
  rawClientData: Uint8Array,
  webSocket: WebSocket,
  vlessResponseHeader: Uint8Array,
  log: (info: string, event?: string) => void
) {
  async function connectAndWrite(address: string, port: number) {
    const tcpSocket = await Deno.connect({
      port: port,
      hostname: address,
    });

    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(new Uint8Array(rawClientData));
    writer.releaseLock();
    return tcpSocket;
  }

  async function retry() {
    const tcpSocket = await connectAndWrite(proxyIP || addressRemote, portRemote);
    remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
  }

  const tcpSocket = await connectAndWrite(addressRemote, portRemote);
  remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
}

function makeReadableWebSocketStream(webSocketServer: WebSocket, earlyDataHeader: string, log: (info: string, event?: string) => void) {
  let readableStreamCancel = false;
  const stream = new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener('message', (event) => {
        if (readableStreamCancel) {
          return;
        }
        const message = event.data;
        controller.enqueue(message);
      });

      webSocketServer.addEventListener('close', () => {
        safeCloseWebSocket(webSocketServer);
        if (readableStreamCancel) {
          return;
        }
        controller.close();
      });
      webSocketServer.addEventListener('error', (err) => {
        log('webSocketServer has error');
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        controller.error(error);
      } else if (earlyData) {
        controller.enqueue(earlyData);
      }
    },

    pull(controller) {},

    cancel(reason) {
      if (readableStreamCancel) {
        return;
      }
      log(`ReadableStream was canceled, due to ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });

  return stream;
}

function processVlessHeader(vlessBuffer: ArrayBuffer, userID: string) {
  if (vlessBuffer.byteLength < 24) {
    return {
      hasError: true,
      message: 'invalid data',
    };
  }
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  let isValidUser = false;
  let isUDP = false;
  if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
    isValidUser = true;
  }
  if (!isValidUser) {
    return {
      hasError: true,
      message: 'invalid user',
    };
  }

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];

  if (command === 1) {
  } else if (command === 2) {
    isUDP = true;
  } else {
    return {
      hasError: true,
      message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
    };
  }
  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  const portRemote = new DataView(portBuffer).getUint16(0);

  let addressIndex = portIndex + 2;
  const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));

  const addressType = addressBuffer[0];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = '';
  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
      break;
    case 2:
      addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 3:
      addressLength = 16;
      const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      const ipv6: string[] = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(':');
      break;
    default:
      return {
        hasError: true,
        message: `invild  addressType is ${addressType}`,
      };
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `addressValue is empty, addressType is ${addressType}`,
    };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP,
  };
}

async function remoteSocketToWS(remoteSocket: Deno.TcpConn, webSocket: WebSocket, vlessResponseHeader: Uint8Array, retry: (() => Promise<void>) | null, log: (info: string, event?: string) => void) {
  let remoteChunkCount = 0;
  let hasIncomingData = false;
  await remoteSocket.readable
    .pipeTo(
      new WritableStream({
        start() {},
        async write(chunk, controller) {
          hasIncomingData = true;
          if (webSocket.readyState !== WS_READY_STATE_OPEN) {
            controller.error('webSocket.readyState is not open, maybe close');
          }

          if (vlessResponseHeader) {
            webSocket.send(new Uint8Array([...vlessResponseHeader, ...chunk]));
            vlessResponseHeader = null;
          } else {
            webSocket.send(chunk);
          }
        },
        close() {
          log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
        },
        abort(reason) {
          console.error(`remoteConnection!.readable abort`, reason);
        },
      })
    )
    .catch((error) => {
      console.error(`remoteSocketToWS has exception `, error.stack || error);
      safeCloseWebSocket(webSocket);
    });

  if (hasIncomingData === false && retry) {
    log(`retry`);
    retry();
  }
}

function base64ToArrayBuffer(base64Str: string) {
  if (!base64Str) {
    return { error: null };
  }
  try {
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { error: error };
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
function safeCloseWebSocket(socket: WebSocket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch (error) {
    console.error('safeCloseWebSocket error', error);
  }
}

const byteToHex: string[] = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr: Uint8Array, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] +
    byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] +
    byteToHex[arr[offset + 3]] +
    '-' +
    byteToHex[arr[offset + 4]] +
    byteToHex[arr[offset + 5]] +
    '-' +
    byteToHex[arr[offset + 6]] +
    byteToHex[arr[offset + 7]] +
    '-' +
    byteToHex[arr[offset + 8]] +
    byteToHex[arr[offset + 9]] +
    '-' +
    byteToHex[arr[offset + 10]] +
    byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] +
    byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] +
    byteToHex[arr[offset + 15]]
  ).toLowerCase();
}
function stringify(arr: Uint8Array, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  if (!isValidUUID(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }
  return uuid;
}

async function handleUDPOutBound(webSocket: WebSocket, vlessResponseHeader: Uint8Array, log: (info: string) => void) {
  let isVlessHeaderSent = false;
  const transformStream = new TransformStream({
    start(controller) {},
    transform(chunk, controller) {
      for (let index = 0; index < chunk.byteLength;) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
    flush(controller) {},
  });

  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          const resp = await fetch('https://1.1.1.1/dns-query', {
            method: 'POST',
            headers: {
              'content-type': 'application/dns-message',
            },
            body: chunk,
          });
          const dnsQueryResult = await resp.arrayBuffer();
          const udpSize = dnsQueryResult.byteLength;
          const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
          if (webSocket.readyState === WS_READY_STATE_OPEN) {
            log(`doh success and dns message length is ${udpSize}`);
            if (isVlessHeaderSent) {
              webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
            } else {
              webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
              isVlessHeaderSent = true;
            }
          }
        },
      })
    )
    .catch((error) => {
      log('dns udp has error' + error);
    });

  const writer = transformStream.writable.getWriter();

  return {
    write(chunk: Uint8Array) {
      writer.write(chunk);
    },
  };
}
