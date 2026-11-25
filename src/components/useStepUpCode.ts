import { useCallback, useState } from 'react';
import { devCode } from '../api/client';

/** State for an "authenticator code" field; pre-filled with the development code when one is active. */
export function useStepUpCode(): [string, (v: string) => void, () => void] {
  const [code, setCode] = useState(devCode());
  const reset = useCallback(() => setCode(devCode()), []);
  return [code, setCode, reset];
}
