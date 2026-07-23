import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listDatasets } from "../api/datasets";

export function useSelectedDataset(projectId: number) {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetParam = searchParams.get("dataset");
  const datasetId = datasetParam !== null ? Number(datasetParam) : NaN;

  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => listDatasets(projectId),
    enabled: Number.isFinite(projectId),
  });

  // If no dataset is specified in the URL (e.g. arrived via a sidebar nav
  // link rather than a per-dataset "Explore" button), default to the most
  // recently uploaded one so the page is never a dead end.
  useEffect(() => {
    if (!Number.isFinite(datasetId) && datasets && datasets.length > 0) {
      setSearchParams({ dataset: String(datasets[0].id) }, { replace: true });
    }
  }, [datasetId, datasets, setSearchParams]);

  const dataset = datasets?.find((d) => d.id === datasetId);

  function selectDataset(newId: number) {
    setSearchParams({ dataset: String(newId) });
  }

  return { datasetId, dataset, datasets, datasetsLoading, selectDataset };
}
