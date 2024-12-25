import {
  createContext,
  createElement,
  PropsWithChildren,
  useContext,
} from "react";
import { ModelContainer } from "../types";
import { useEffect, useRef } from "react";
import { ContainerOptions, createContainer } from "../createContainer";

export type ContainerScope = "local" | "global";

export type UseContainer = {
  (scope?: ContainerScope): ModelContainer;
  (options: ContainerOptions): ModelContainer;
};

export type ProviderProps = {
  container: ModelContainer;
};

const containerContext = createContext<ModelContainer | undefined>(undefined);

export const useContainer: UseContainer = (...args: any[]) => {
  let scope: ContainerScope = "global";
  let options: ContainerOptions | undefined;
  if (typeof args[0] === "string") {
    scope = args[0] as ContainerScope;
  } else if (args[0] && typeof args[0] === "object") {
    scope = "local";
    options = args[0];
  }

  const globalContainer = useContext(containerContext);
  const localContainerRef = useRef<ModelContainer>();
  const containerRef = useRef<ModelContainer>();

  if (scope === "local") {
    if (!localContainerRef.current) {
      localContainerRef.current = createContainer(options);
    }
    containerRef.current = localContainerRef.current;
  } else {
    if (!globalContainer) {
      throw new Error(
        "No container found. This component should place in side Provider component"
      );
    }
    containerRef.current = globalContainer;
  }

  useEffect(() => {
    return () => {
      if (scope === "local") {
        containerRef.current?.deleteAll();
      }
    };
  }, [scope]);

  return containerRef.current;
};

export function Provider(props: PropsWithChildren<ProviderProps>) {
  return createElement(
    containerContext.Provider,
    { value: props.container },
    props.children
  );
}
