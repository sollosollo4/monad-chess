declare module "stockfish" {
  export type StockfishEngine = {
    postMessage: (cmd: string) => void;
    onmessage: (msg: string | { data: string }) => void;
    terminate?: () => void;
  };

  export default function Stockfish(): StockfishEngine;
}