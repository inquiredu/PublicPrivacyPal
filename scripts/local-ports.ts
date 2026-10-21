import { createServer } from 'node:net';

export interface LocalPortProbe {
  once(event: 'error', listener: (error: NodeJS.ErrnoException) => void): unknown;
  listen(port: number, host: string, listener: () => void): unknown;
  close(listener: (error?: Error) => void): unknown;
}

function bindFailure(port: number, error: NodeJS.ErrnoException): Error {
  const address = `127.0.0.1:${port}`;
  if (error.code === 'EADDRINUSE') {
    return new Error(`Port ${port} is occupied (EADDRINUSE). Stop the local services before starting a fresh session.`, { cause: error });
  }
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return new Error(`Permission denied binding ${address} (${error.code}). Check local bind permissions or sandbox restrictions before retrying.`, { cause: error });
  }
  return new Error(`Cannot bind ${address}${error.code ? ` (${error.code})` : ''}. Startup stopped; inspect the socket error before retrying.`, { cause: error });
}

export async function assertLocalPortsAvailable(ports: readonly number[], createProbe: () => LocalPortProbe = () => createServer()): Promise<void> {
  for (const port of ports) {
    await new Promise<void>((accept, reject) => {
      const socket = createProbe();
      socket.once('error', error => reject(bindFailure(port, error)));
      try {
        socket.listen(port, '127.0.0.1', () => socket.close(error => error
          ? reject(new Error(`Could not release the startup probe for 127.0.0.1:${port}. Startup stopped.`, { cause: error }))
          : accept()));
      } catch (error) { reject(bindFailure(port, error as NodeJS.ErrnoException)); }
    });
  }
}
