import { WebSocket } from "ws";

export class RoomService {
  private rooms: Map<string, Set<WebSocket>> = new Map();

  joinRoom(ws: WebSocket, roomCode: string) {
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Set());
    }
    this.rooms.get(roomCode)!.add(ws);
    (ws as any).room = roomCode;
  }

  leaveRoom(ws: WebSocket) {
    const roomCode = (ws as any).room;
    if (roomCode && this.rooms.has(roomCode)) {
      this.rooms.get(roomCode)!.delete(ws);
    }
  }

  broadcast(roomCode: string, payload: any) {
    const set = this.rooms.get(roomCode);
    if (!set) return;
    const str = JSON.stringify(payload);
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) client.send(str);
    }
  }
}
