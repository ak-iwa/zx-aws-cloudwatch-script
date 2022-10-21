import { $, ProcessOutput } from 'zx';

export const generateSelectList = async (ps3: string, list: any): Promise<string> => {
  const { stdout } = await $`
    PS3=${ps3}
    select group in ${list}
    do
      echo "selected: $group"
      break
    done
  `;
  return stdout.replace('selected:', '').trim();
}

export const createProcessOutException = (errorMessage: string): ProcessOutput => {
  return new ProcessOutput(null, null, '', errorMessage, '', '');
}

export const ynRead = async (question: string) => {
  const { stdout } = await $`read -n1 -p "${question} (y/N): " yn; case "$yn" in [yY]*) echo yes;; *) echo "abort";; esac`;
  return stdout.trim();
}