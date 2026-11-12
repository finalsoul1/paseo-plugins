import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const KEEP = 1000;

interface State {
  opened: string[];
}

// 데스크톱과 휴대폰 앱이 같은 워크스페이스를 동시에 처음 열 수 있어서, 한 번 열었는지는 데몬 파일 하나에 기록한다.
export function createAutoOpenStore(path: string) {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<State> {
    try {
      const state = JSON.parse(await readFile(path, "utf8")) as Partial<State>;
      return { opened: state.opened ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { opened: [] };
    }
  }

  async function save(state: State) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, JSON.stringify(state));
    await rename(`${path}.tmp`, path);
  }

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    opened: () => serial(async () => (await load()).opened),
    claim: (workspaceId: string) =>
      serial(async () => {
        const state = await load();
        if (state.opened.includes(workspaceId)) return false;
        await save({ opened: [...state.opened, workspaceId].slice(-KEEP) });
        return true;
      }),
  };
}
