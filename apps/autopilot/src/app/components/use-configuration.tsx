import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { isEqual } from "lodash";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { nullsToUndefined } from "~/lib/utils";
import { getConfiguration, updateConfiguration } from "./actions";

export interface configurationStore {
  serviceCredentials: { username: string; password: string };
  completeQuizzes: boolean;
  completePdfAssignments: boolean;
  allowExternalResearch: boolean;
  customInstructions: string;
  setConfiguration: (newConfig: Partial<configurationStore>) => void;
}

const useConfigurationStore = create<configurationStore>()(
  persist(
    (set) => ({
      serviceCredentials: { username: "", password: "" },
      completeQuizzes: false,
      completePdfAssignments: false,
      allowExternalResearch: true,
      customInstructions: "",
      setConfiguration: (newConfig) => set(newConfig),
    }),
    {
      name: "configuration-storage",
      version: 2,
      migrate: (persistedState) => {
        const migrated = { ...(persistedState as object) };
        Reflect.deleteProperty(migrated, "timePerWord");
        return migrated as configurationStore;
      },
    },
  ),
);

export function useConfiguration() {
  const { setConfiguration: updateStore, ...configStore } =
    useConfigurationStore((state) => state);
  const updateMutation = useMutation({
    mutationFn: updateConfiguration,
    mutationKey: ["update-configuration"],
  });
  const configQuery = useQuery({
    queryKey: ["configuration"],
    queryFn: getConfiguration,
  });
  // const updateMutation = api.configuration.update.useMutation();
  // const configQuery = api.configuration.get.useQuery();

  const debounced = useDebounce(JSON.stringify(configStore), 1000);

  useEffect(() => {
    if (
      configQuery.isFetched &&
      configQuery.data &&
      configQuery.data !== "Unauthorized"
    )
      updateStore(nullsToUndefined(configQuery.data));
  }, [configQuery.data, configQuery.isFetched, updateStore]);

  useEffect(() => {
    if (
      debounced === JSON.stringify(configStore) &&
      configQuery.isFetched &&
      !isEqual(JSON.parse(debounced), configQuery.data)
    ) {
      console.log("Updating DB");
      updateMutation.mutate({
        ...configStore.serviceCredentials,
        ...configStore,
      });
    }
  }, [debounced]);

  function setConfiguration(
    newConfig: Partial<Omit<configurationStore, "setConfiguration">>,
  ) {
    updateStore(newConfig);
  }

  return { ...configStore, setConfiguration };
}
