import { exists } from "https://deno.land/std/fs/exists.ts";

// ==================== Configuration ====================
const config = {
  voipPortRange: { start: 5060, end: 5080 },
  qos: {
    trafficPriorities: {
      voip: 6,
      dns: 4,
      default: 0
    },
    bufferSettings: {
      highPriorityBufferSize: 1024 * 1024 * 10,
      defaultBufferSize: 1024 * 1024 * 5
    }
  }
};

// ==================== Performance Tracking ====================
const performanceStats = {
  totalConnections: 0,
  activeConnections: 0,
  tcpConnections: 0,
  udpConnections: 0,
  voipConnections: 0,
  qosStats: {
    highPriorityProcessed: 0,
    normalPriorityProcessed: 0
  }
};

// ==================== Constants ====================
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
const userID = 'a7be0aad-fd73-4b9a-aa65-e8fcffc67852';
const proxyIP = Deno.env.get('PROXYIP') || '';

// ==================== Helper Classes ====================
class PriorityQueue {
  constructor() {
    this.queues = {};
    this.priorityOrder = [];
  }

  enqueue(item, priority = 0) {
    if (!this.queues[priority]) {
      this.queues[priority] = [];
      this.priorityOrder.push(priority);
      this.priorityOrder.sort((a, b) => b - a);
    }
    this.queues[priority].push(item);
  }

  dequeue() {
    for (const priority of this.priorityOrder) {
      if (this.queues[priority]?.length > 0) {
        return {
          data: this.queues[priority].shift(),
          priority
        };
      }
    }
    return null;
  }

  get length() {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }
}

class VoipQualityMonitor {
  constructor() {
    this.stats = {
      packetsSent: 0,
      packetsLost: 0,
      jitter: 0,
      latency: 0,
      lastPacketTime: 0,
      lastSequenceNumber: 0
    };
  }

  analyzePacket(packet) {
    this.stats.packetsSent++;
    const now = Date.now();

    if (packet.length >= 12) {
      const view = new DataView(packet.buffer);
      const sequenceNumber = view.getUint16(2);
      
      if (this.stats.lastSequenceNumber > 0) {
        const diff = sequenceNumber - this.stats.lastSequenceNumber;
        if (diff > 1) {
          this.stats.packetsLost += diff - 1;
        }
      }
      this.stats.lastSequenceNumber = sequenceNumber;
    }

    if (this.stats.lastPacketTime > 0) {
      const delay = now - this.stats.lastPacketTime;
      this.stats.jitter = this.stats.jitter * 0.9 + Math.abs(delay - this.stats.latency) * 0.1;
      this.stats.latency = this.stats.latency * 0.9 + delay * 0.1;
    }
    
    this.stats.lastPacketTime = now;
    
    return this.stats;
  }

  getQualityReport() {
    const lossRate = this.stats.packetsSent > 0 
      ? (this.stats.packetsLost / this.stats.packetsSent) * 100 
      : 0;
    
    return {
      lossRate: lossRate.toFixed(2) + '%',
      jitter: this.stats.jitter.toFixed(2) + 'ms',
      latency: this.stats.latency.toFixed(2) + 'ms',
      mos: this.calculateMOS(lossRate, this.stats.jitter).toFixed(2)
    };
  }

  calculateMOS(lossRate, jitter) {
    const r = 93.2 - (lossRate * 0.25) - (jitter * 0.1);
    return 1 + (0.035) * r + (0.000007) * r * (r - 60) * (100 - r);
  }
}

// ==================== Main Server ====================
Deno.serve(async (request: Request) => {
  const upgrade = request.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() != 'websocket') {
    return new Response(
      `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amine-Codex | Telegram</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f5f7;
            color: #1c1c1e;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .container {
            text-align: center;
            width: 90%;
            max-width: 380px;
            padding: 25px;
            background-color: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .telegram-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #0088cc, #34b7f1);
            border-radius: 22px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 20px;
        }
        
        .telegram-icon i {
            color: white;
            font-size: 40px;
        }
        
        h1 {
            color: #0088cc;
            margin-bottom: 5px;
            font-weight: 600;
            font-size: 22px;
        }
        
        .developer-info {
            margin: 20px 0;
            padding: 15px;
            background-color: rgba(0, 136, 204, 0.08);
            border-radius: 12px;
            border: 1px solid rgba(0, 136, 204, 0.1);
        }
        
        .developer-name {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 5px;
        }
        
        .username {
            color: #34b7f1;
            font-weight: 500;
            margin: 10px 0;
            direction: ltr;
            display: inline-block;
            font-size: 15px;
        }
        
        .server-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: rgba(76, 175, 80, 0.1);
            color: #4CAF50;
            border-radius: 10px;
            font-size: 13px;
            margin-top: 8px;
            border: 1px solid rgba(76, 175, 80, 0.2);
        }
        
        .server-status::before {
            content: "";
            display: block;
            width: 8px;
            height: 8px;
            background-color: #4CAF50;
            border-radius: 50%;
        }
        
        .links {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 20px;
        }
        
        .link {
            padding: 8px 16px;
            background-color: #0088cc;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 500;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .link i {
            font-size: 16px;
        }
        
        .link.channel {
            background-color: #0088cc;
        }
        
        .link.group {
            background-color: #34b7f1;
        }
        
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #000;
                color: #f5f5f7;
            }
            
            .container {
                background-color: rgba(28, 28, 30, 0.9);
                border: 1px solid rgba(44, 44, 46, 0.6);
            }
            
            h1 {
                color: #34b7f1;
            }
            
            .developer-info {
                background-color: rgba(52, 183, 241, 0.08);
                border: 1px solid rgba(52, 183, 241, 0.1);
            }
            
            .link {
                background-color: #34b7f1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="telegram-icon">
            <i class="fab fa-telegram"></i>
        </div>
        
        <h1>Telegram</h1>
        
        <div class="developer-info">
            <div class="developer-name">المطور: Amine-Codex</div>
            <div class="username">@amine_dz46</div>
            <div class="server-status">SERVER STATE: ONLINE</div>
        </div>
        
        <div class="links">
            <a href="https://t.me/aminedz151" class="link channel" target="_blank">
                <i class="fas fa-broadcast-tower"></i> القناة
            </a>
            <a href="https://t.me/aminehxdz" class="link group" target="_blank">
                <i class="fas fa-users"></i> المجموعة
            </a>
        </div>
    </div>
</body>
</html>`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }
  return await vlessOverWSHandler(request);
});

// ==================== VLESS Over WS Handler ====================
async function vlessOverWSHandler(request: Request) {
  const { socket, response } = Deno.upgradeWebSocket(request);
  let address = '';
  let portWithRandomLog = '';
  const udpConnections = new Map();
  const voipMonitors = new Map();
  
  performanceStats.totalConnections++;
  performanceStats.activeConnections++;

  socket.addEventListener('close', () => {
    performanceStats.activeConnections--;
    udpConnections.forEach(conn => conn.close());
  });

  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
  const readableWebSocketStream = makeReadableWebSocketStream(socket, earlyDataHeader);
  
  let remoteSocketWapper = { value: null };
  let udpStreamWrite = null;
  let isDns = false;
  let isVoIP = false;

  readableWebSocketStream.pipeTo(
    new WritableStream({
      async write(chunk, controller) {
        if ((isDns || isVoIP) && udpStreamWrite) {
          return udpStreamWrite(chunk);
        }
        if (remoteSocketWapper.value) {
          const writer = remoteSocketWapper.value.writable.getWriter();
          await writer.write(new Uint8Array(chunk));
          writer.releaseLock();
          return;
        }

        const header = processVlessHeader(chunk, userID);
        if (header.hasError) {
          throw new Error(header.message);
        }

        address = header.addressRemote;
        portWithRandomLog = `${header.portRemote}--${Math.random()} ${header.isUDP ? 'udp ' : 'tcp '}`;
        
        if (header.isUDP) {
          if (header.portRemote === 53) {
            isDns = true;
            performanceStats.udpConnections++;
          } else if (header.portRemote >= config.voipPortRange.start && 
                   header.portRemote <= config.voipPortRange.end) {
            isVoIP = true;
            performanceStats.voipConnections++;
            voipMonitors.set(`${address}:${header.portRemote}`, new VoipQualityMonitor());
          } else {
            throw new Error(`UDP only for DNS/VoIP ports`);
          }
        } else {
          performanceStats.tcpConnections++;
        }
        
        const vlessResponseHeader = new Uint8Array([header.vlessVersion[0], 0]);
        const rawClientData = chunk.slice(header.rawDataIndex);

        if (isDns || isVoIP) {
          const connectionKey = `${address}:${header.portRemote}`;
          if (!udpConnections.has(connectionKey)) {
            const handler = await handleUDPOutBound(
              socket, 
              vlessResponseHeader, 
              isVoIP,
              voipMonitors.get(connectionKey)
            );
            udpConnections.set(connectionKey, handler);
          }
          udpConnections.get(connectionKey).write(rawClientData);
          return;
        }
        
        handleTCPOutBound(
          remoteSocketWapper,
          header.addressRemote,
          header.portRemote,
          rawClientData,
          socket,
          vlessResponseHeader
        );
      },
      close() {},
      abort() {}
    })
  ).catch(() => {});

  return response;
}

// ==================== Connection Handlers ====================
async function handleTCPOutBound(
  remoteSocket,
  addressRemote,
  portRemote,
  rawClientData,
  webSocket,
  vlessResponseHeader
) {
  const isVoIP = portRemote >= config.voipPortRange.start && 
                portRemote <= config.voipPortRange.end;

  if (isVoIP) {
    Deno.resources({ highPriority: true });
  }

  const tcpSocket = await Deno.connect({
    hostname: addressRemote,
    port: portRemote
  });

  remoteSocket.value = tcpSocket;
  
  const writer = tcpSocket.writable.getWriter();
  await writer.write(new Uint8Array(rawClientData));
  writer.releaseLock();

  remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null);
}

async function handleUDPOutBound(
  webSocket,
  vlessResponseHeader,
  isVoIP = false,
  qualityMonitor = null
) {
  let isVlessHeaderSent = false;
  const priorityQueue = new PriorityQueue();
  let activeSending = false;

  const processQueue = async () => {
    if (activeSending) return;
    activeSending = true;

    while (true) {
      const item = priorityQueue.dequeue();
      if (!item) {
        activeSending = false;
        return;
      }

      const { data: packet, priority } = item;
      const udpSize = packet.byteLength;
      const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);

      if (isVoIP && qualityMonitor) {
        qualityMonitor.analyzePacket(packet);
      }

      try {
        const dataToSend = isVlessHeaderSent
          ? [udpSizeBuffer, packet]
          : [vlessResponseHeader, udpSizeBuffer, packet];
        
        await webSocket.send(new Blob(dataToSend).arrayBuffer());
        isVlessHeaderSent = true;
        
        if (priority === config.qos.trafficPriorities.voip) {
          performanceStats.qosStats.highPriorityProcessed++;
        } else {
          performanceStats.qosStats.normalPriorityProcessed++;
        }
      } catch {}
    }
  };

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const priority = isVoIP 
        ? config.qos.trafficPriorities.voip 
        : (isDns ? config.qos.trafficPriorities.dns : config.qos.trafficPriorities.default);
      
      priorityQueue.enqueue(chunk, priority);
      controller.enqueue(chunk);
      processQueue();
    }
  });

  const writer = transformStream.writable.getWriter();

  return {
    write(chunk) {
      writer.write(chunk);
    },
    close() {
      writer.close();
    }
  };
}

// ==================== Utility Functions ====================
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader) {
  let readableStreamCancel = false;
  
  return new ReadableStream({
    start(controller) {
      webSocketServer.onmessage = (event) => {
        if (readableStreamCancel) return;
        controller.enqueue(event.data);
      };

      webSocketServer.onclose = () => {
        if (readableStreamCancel) return;
        controller.close();
      };

      webSocketServer.onerror = (err) => {
        controller.error(err);
      };

      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    cancel(reason) {
      readableStreamCancel = true;
      webSocketServer.close();
    }
  });
}

function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) {
    return { hasError: true, message: 'invalid data' };
  }

  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) !== userID) {
    return { hasError: true, message: 'invalid user' };
  }

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
  const isUDP = command === 2;

  if (command !== 1 && command !== 2) {
    return {
      hasError: true,
      message: `command ${command} is not supported (01-tcp, 02-udp)`
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
      return { hasError: true, message: `invalid addressType ${addressType}` };
  }

  if (!addressValue) {
    return { hasError: true, message: `empty addressValue for type ${addressType}` };
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

async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry) {
  let hasIncomingData = false;
  
  await remoteSocket.readable.pipeTo(
    new WritableStream({
      write(chunk) {
        hasIncomingData = true;
        if (webSocket.readyState !== WS_READY_STATE_OPEN) {
          throw new Error('WebSocket not open');
        }

        if (vlessResponseHeader) {
          webSocket.send(new Uint8Array([...vlessResponseHeader, ...chunk]));
          vlessResponseHeader = null;
        } else {
          webSocket.send(chunk);
        }
      },
      close() {},
      abort() {}
    })
  ).catch(() => {});

  if (!hasIncomingData && retry) {
    await retry();
  }
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { error: null };
  try {
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decode = atob(base64Str);
    return { 
      earlyData: Uint8Array.from(decode, c => c.charCodeAt(0)).buffer,
      error: null 
    };
  } catch (error) {
    return { error };
  }
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || 
        socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch {}
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
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

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  if (!isValidUUID(uuid)) {
    throw TypeError('Invalid UUID');
  }
  return uuid;
}
