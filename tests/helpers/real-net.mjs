// The simulated network's interface (listen, clock, rand) on real sockets and real time, so the same fake veadotube
// and fake OBS (sim.mjs) can serve a real browser in the browser tests. A minimal WebSocket server (RFC 6455:
// text frames, close, ping), enough for the dock and the scenes. Everything listens on 127.0.0.1 only.
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { rng } from './sim.mjs';

const frame = (op, payload) => {
  const b = Buffer.from(payload), n = b.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127, 0, 0, 0, 0]), Buffer.from([n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255])]);
  return Buffer.concat([head, b]);
};

export class RealNet {
  constructor(seed = 1) {
    this.rand = rng(seed); this.servers = []; this.sockets = new Set();
    const timers = new Set();
    this.timers = timers;
    this.clock = {
      get now() { return Date.now(); },
      at: (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; },
      pipe: (rand, [lo, hi]) => { let last = 0; return (fn) => { const when = Math.max(last, Date.now() + lo + rand() * (hi - lo)); last = when; return this.clock.at(when - Date.now(), fn); }; },
    };
  }
  // addr: '127.0.0.1:0' for any free port; resolves to the real address
  listen(addr, onConnection) {
    const [host, port] = addr.split(':');
    const server = createServer((sock) => {
      this.sockets.add(sock); sock.on('close', () => this.sockets.delete(sock));
      let buf = Buffer.alloc(0), open = false, closed = false;
      const peer = {
        closed: false, onmessage: null, onclose: null,
        send: (text) => { if (!peer.closed) sock.write(frame(1, text)); },
        close: (code = 1000) => { if (peer.closed) return; peer.closed = true; const c = Buffer.alloc(2); c.writeUInt16BE(code); sock.end(frame(8, c)); },
      };
      const gone = () => { if (closed) return; closed = true; peer.closed = true; peer.onclose && peer.onclose(); };
      sock.on('close', gone); sock.on('error', gone);
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        if (!open) {
          const i = buf.indexOf('\r\n\r\n'); if (i < 0) return;
          const key = /Sec-WebSocket-Key: *(.*)\r\n/i.exec(buf.subarray(0, i).toString())?.[1]?.trim();
          if (!key) { sock.destroy(); return; }
          sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}\r\n\r\n`);
          open = true; buf = buf.subarray(i + 4); onConnection(peer);
        }
        while (buf.length >= 2) {
          let len = buf[1] & 127, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); off = 10; }
          if (buf.length < off + 4 + len) return;
          const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len)).map((x, k) => x ^ mask[k % 4]);
          const op = buf[0] & 15; buf = buf.subarray(off + 4 + len);
          if (op === 8) { peer.closed = true; sock.end(frame(8, data.subarray(0, 2))); gone(); return; }
          if (op === 9) { sock.write(frame(10, data)); continue; }
          if (op === 1 && peer.onmessage) peer.onmessage(data.toString());
        }
      });
    });
    this.servers.push(server);
    return new Promise((ok) => server.listen(+port, host, () => ok(`${host}:${server.address().port}`)));
  }
  close() { for (const t of this.timers) clearTimeout(t); for (const s of this.servers) s.close(); for (const s of this.sockets) s.destroy(); }
}
