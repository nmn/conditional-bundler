import { useEffect } from "react";

export function useExampleLog(message) {
  useEffect(() => {
    console.log(message);
  }, [message]);
}
